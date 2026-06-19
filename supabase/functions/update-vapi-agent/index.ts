import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

function normalize(p: string | null | undefined): string {
  return (p ?? '').replace(/\D/g, '')
}

function buildPrompt(c: Record<string, unknown>): string {
  const businessName = (c.business_name as string) ?? 'the business'
  const industry = (c.industry as string) ?? 'service business'
  const tone = (c.tone as string) ?? 'Friendly'
  const includeName = c.include_business_name as boolean
  const questions = (c.intake_questions as string[] | null) ?? []

  const lines: string[] = []
  lines.push(`You are a professional AI receptionist for ${includeName ? businessName : 'a ' + industry + ' business'}.`)
  lines.push(`Industry: ${industry}.`)
  lines.push(`Tone: ${tone}. Speak naturally, warmly, and concisely.`)
  lines.push('')
  lines.push('Your job is to answer the call, capture lead information, and let the caller know someone will follow up shortly.')
  lines.push('')
  if (questions.length) {
    lines.push('Ask the caller the following questions, one at a time, in a natural conversational way:')
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
    lines.push('')
  }
  lines.push('Call flow:')
  lines.push('1. Greet the caller warmly.')
  lines.push('2. Ask how you can help today.')
  lines.push('3. Collect the intake info above.')
  lines.push('4. Confirm the details back to them.')
  lines.push('5. Let them know the team will follow up shortly and thank them.')
  lines.push('')
  lines.push('Never invent pricing, availability, or promises. If unsure, say the team will follow up.')
  return lines.join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    const body = await req.json().catch(() => ({}))
    const clientId = body?.client_id as string | undefined
    if (!clientId) {
      return new Response(JSON.stringify({ ok: false, error: 'client_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: client, error: cErr } = await admin
      .from('callcapture_clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle()
    if (cErr || !client) {
      return new Response(JSON.stringify({ ok: false, error: cErr?.message ?? 'Client not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Authorization: owner OR super admin
    const { data: isAdmin } = await admin.rpc('is_current_user_super_admin' as never).then((r) => ({ data: r.data }), () => ({ data: false }))
    const owner = client.user_id === userId
    // Fall back: check super admin via a direct lookup since RPC runs with service role
    let allowed = owner
    if (!allowed) {
      const { data: me } = await admin
        .from('callcapture_clients')
        .select('is_super_admin')
        .eq('user_id', userId)
        .maybeSingle()
      allowed = !!me?.is_super_admin || !!isAdmin
    }
    if (!allowed) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const targetNumber = normalize(client.assigned_callcapture_number) || normalize(client.business_phone)
    if (!targetNumber) {
      return new Response(JSON.stringify({ ok: false, error: 'No phone number assigned to this client' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Look up Vapi phone numbers
    const phoneRes = await fetch('https://api.vapi.ai/phone-number', {
      headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
    })
    if (!phoneRes.ok) {
      const text = await phoneRes.text()
      return new Response(JSON.stringify({ ok: false, error: `Vapi phone-number lookup failed: ${phoneRes.status} ${text}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const phones = await phoneRes.json() as Array<{ number?: string; assistantId?: string }>
    const match = phones.find((p) => normalize(p.number) === targetNumber || normalize(p.number).endsWith(targetNumber) || targetNumber.endsWith(normalize(p.number)))
    const assistantId = match?.assistantId
    if (!assistantId) {
      return new Response(JSON.stringify({ ok: false, error: `No Vapi assistant attached to ${client.assigned_callcapture_number || client.business_phone}` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const systemPrompt = buildPrompt(client)
    let firstMessage = (client.greeting as string | null) ?? ''
    if (!firstMessage && client.industry === 'med_spa') {
      firstMessage = `Thank you for calling ${client.business_name}, your personal concierge is here. How may I assist you today?`
    }
    if (!firstMessage) {
      firstMessage = `Thanks for calling ${client.business_name}, how can I help you today?`
    }

    const patchRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstMessage,
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }],
        },
      }),
    })
    if (!patchRes.ok) {
      const text = await patchRes.text()
      return new Response(JSON.stringify({ ok: false, error: `Vapi update failed: ${patchRes.status} ${text}`, assistant_id: assistantId }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true, assistant_id: assistantId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
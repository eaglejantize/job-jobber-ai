import { createClient } from 'npm:@supabase/supabase-js@2'
import { logVoiceSync } from '../_shared/voice-sync-log.ts'
import { resolveVoiceForClient } from '../_shared/voice-resolution.ts'
import { buildIndustryDefaultGreeting } from '../_shared/industry-definition.ts'

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
  const style = c.conversation_style as string | null
  const personality = c.ai_personality as string | null
  if (style) lines.push(`Conversation style: ${style}.`)
  if (personality) lines.push(`Personality: ${personality}`)
  const language = (c.language as string) || 'en-US'
  lines.push(`Language: ${language}.`)
  lines.push('')

  const services = (c.services as string[] | null) ?? []
  if (services.length) {
    lines.push('Services offered:')
    services.forEach((s) => lines.push(`- ${s}`))
    lines.push('')
  }

  const brands = (c.brands_serviced as string[] | null) ?? []
  if (brands.length) {
    lines.push(`Brands serviced: ${brands.join(', ')}.`)
    lines.push('')
  }

  const hours = c.business_hours_schedule as Record<string, { open: string; close: string; closed: boolean }> | null
  if (hours) {
    const list = Object.entries(hours)
      .map(([d, h]) => (h.closed ? `${d}: Closed` : `${d}: ${h.open}-${h.close}`))
      .join(', ')
    lines.push(`Business hours: ${list}.`)
    lines.push('')
  }

  const sa = c.service_area as { cities?: string[]; zips?: string[]; radius_miles?: number } | null
  if (sa && (sa.cities?.length || sa.zips?.length || sa.radius_miles)) {
    const parts: string[] = []
    if (sa.cities?.length) parts.push(`Cities: ${sa.cities.join(', ')}`)
    if (sa.zips?.length) parts.push(`Zips: ${sa.zips.join(', ')}`)
    if (sa.radius_miles) parts.push(`Radius: ${sa.radius_miles} miles`)
    lines.push(`Service area — ${parts.join(' · ')}.`)
    lines.push('')
  }

  if (c.emergency_services) {
    const notes = (c.emergency_rules as { notes?: string } | null)?.notes || ''
    lines.push(`Emergency service: AVAILABLE. ${notes}`)
    lines.push('')
  }

  const scheduling = c.scheduling_enabled as boolean | null
  const schedMode = c.scheduling_mode as string | null
  if (scheduling) {
    lines.push(`Scheduling mode: ${schedMode || 'intake_only'}.`)
    if (c.diagnostic_fee != null) lines.push(`Diagnostic / service fee: $${c.diagnostic_fee}.`)
    if (schedMode === 'transfer_to_office' && c.transfer_number) {
      lines.push(`If the caller wants to book, transfer to ${c.transfer_number}.`)
    }
    lines.push('')
  }

  const faqs = (c.faqs as Array<{ q: string; a: string }> | null) ?? []
  if (faqs.length) {
    lines.push('Frequently asked questions (answer using these):')
    faqs.forEach((f) => lines.push(`Q: ${f.q}\nA: ${f.a}`))
    lines.push('')
  }

  if (c.company_policies) {
    lines.push(`Company policies: ${c.company_policies}`)
    lines.push('')
  }
  if (c.warranty_terms) {
    lines.push(`Warranty: ${c.warranty_terms}`)
    lines.push('')
  }
  if (c.service_area_notes) {
    lines.push(`Service area notes: ${c.service_area_notes}`)
    lines.push('')
  }
  if (c.knowledge_base) {
    lines.push('Knowledge base:')
    lines.push(String(c.knowledge_base))
    lines.push('')
  }

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

    const resolvedVoice = await resolveVoiceForClient(admin, client)

    const systemPrompt = buildPrompt(client)
    let firstMessage = (client.greeting as string | null) ?? ''
    if (!firstMessage) {
      firstMessage = buildIndustryDefaultGreeting(client.industry as string | null, client.business_name as string | null)
    }

    // Attach calendar tools so the assistant can offer real availability and book.
    const toolsUrl = `${SUPABASE_URL}/functions/v1/vapi-tools`
    const webhookUrl = `${SUPABASE_URL}/functions/v1/vapi-webhook`
    const webhookSecret = Deno.env.get('VAPI_WEBHOOK_SECRET') ?? ''
    const tools = [
      {
        type: 'function', async: false,
        function: {
          name: 'findSlots',
          description: "Get real available appointment times from the business's Google Calendar. Call this before offering times to the caller.",
          parameters: {
            type: 'object',
            properties: {
              days: { type: 'number', description: 'How many days out to search (1-14). Default 5.' },
              max: { type: 'number', description: 'Max number of slots to return (1-10). Default 6.' },
            },
          },
        },
        server: { url: toolsUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) },
      },
      {
        type: 'function', async: false,
        function: {
          name: 'bookSlot',
          description: "Book the chosen appointment on the business's Google Calendar. Use exact ISO start/end times returned by findSlots.",
          parameters: {
            type: 'object',
            required: ['start_iso', 'end_iso', 'customer_name', 'customer_phone'],
            properties: {
              start_iso: { type: 'string', description: 'ISO 8601 start datetime from findSlots.' },
              end_iso: { type: 'string', description: 'ISO 8601 end datetime from findSlots.' },
              customer_name: { type: 'string' },
              customer_phone: { type: 'string', description: 'E.164 if possible.' },
              customer_email: { type: 'string' },
              customer_address: { type: 'string' },
              service: { type: 'string' },
              notes: { type: 'string' },
            },
          },
        },
        server: { url: toolsUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) },
      },
    ]

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
          tools,
        },
        voice: {
          provider: resolvedVoice.provider,
          voiceId: resolvedVoice.providerVoiceId,
        },
        server: { url: webhookUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) },
        serverMessages: ['status-update', 'transcript', 'end-of-call-report', 'conversation-update', 'tool-calls'],
        metadata: { client_id: clientId, user_id: userId },
      }),
    })
    if (!patchRes.ok) {
      const text = await patchRes.text()
      await admin.from('callcapture_clients').update({
        last_vapi_sync_at: new Date().toISOString(),
        last_vapi_sync_status: `error: ${patchRes.status} ${text.slice(0, 200)}`,
        voice_provider: resolvedVoice.provider,
        voice_provider_voice_id: resolvedVoice.providerVoiceId,
        voice_provider_agent_id: assistantId,
        voice_sync_status: 'failed',
        voice_last_sync_at: new Date().toISOString(),
        voice_last_sync_error: `Vapi update failed: ${patchRes.status}`,
        voice_phone_number_snapshot: client.assigned_callcapture_number ?? client.business_phone ?? null,
      } as never).eq('id', clientId)
      await logVoiceSync(admin, {
        clientId,
        voiceCatalogId: resolvedVoice.selectedVoiceCatalogId,
        action: 'update-vapi-agent',
        status: 'failed',
        voiceProvider: resolvedVoice.provider,
        providerVoiceId: resolvedVoice.providerVoiceId,
        providerAgentId: assistantId,
        phoneNumberSnapshot: client.assigned_callcapture_number ?? client.business_phone ?? null,
        errorMessage: `Vapi update failed: ${patchRes.status}`,
        detail: { mismatch: resolvedVoice.mismatch, mismatchReason: resolvedVoice.mismatchReason },
      })
      return new Response(JSON.stringify({ ok: false, error: `Vapi update failed: ${patchRes.status} ${text}`, assistant_id: assistantId }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const syncStatus = resolvedVoice.mismatch ? 'failed' : 'synced'
    const syncError = resolvedVoice.mismatch ? resolvedVoice.mismatchReason : null

    await admin.from('callcapture_clients').update({
      last_vapi_sync_at: new Date().toISOString(),
      last_vapi_sync_status: 'ok',
      voice_provider: resolvedVoice.provider,
      voice_provider_voice_id: resolvedVoice.providerVoiceId,
      voice_provider_agent_id: assistantId,
      voice_sync_status: syncStatus,
      voice_last_sync_at: new Date().toISOString(),
      voice_last_sync_error: syncError,
      voice_phone_number_snapshot: client.assigned_callcapture_number ?? client.business_phone ?? null,
    } as never).eq('id', clientId)

    await logVoiceSync(admin, {
      clientId,
      voiceCatalogId: resolvedVoice.selectedVoiceCatalogId,
      action: 'update-vapi-agent',
      status: syncStatus,
      voiceProvider: resolvedVoice.provider,
      providerVoiceId: resolvedVoice.providerVoiceId,
      providerAgentId: assistantId,
      phoneNumberSnapshot: client.assigned_callcapture_number ?? client.business_phone ?? null,
      errorMessage: syncError,
      detail: { mismatch: resolvedVoice.mismatch, mismatchReason: resolvedVoice.mismatchReason },
    })

    return new Response(JSON.stringify({ ok: true, assistant_id: assistantId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
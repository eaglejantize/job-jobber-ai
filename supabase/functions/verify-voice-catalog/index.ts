// Verification helper (super-admin only) used to prove which voices actually
// work end-to-end before seeding callcapture_voice_catalog. It:
//   1. Lists Vapi native + ElevenLabs voices via Vapi's own voice-library.
//   2. Optionally accepts an explicit `candidates` list to test.
//   3. Creates a scratch Vapi assistant, PATCHes voice, GETs assistant, and
//      checks that the returned voice fields match.
//   4. HEAD-fetches the preview URL and confirms audio content.
//   5. Returns a verification table matching correction #7.
// Nothing here writes to the catalog; seeding is a separate manual step.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

type Candidate = { provider: string; provider_voice_id: string; display_name?: string }

type VerifyRow = {
  display_name: string
  provider: string
  provider_voice_id: string
  provider_lookup: 'pass' | 'fail'
  preview_url: string | null
  preview_playback: 'pass' | 'fail' | 'skipped'
  vapi_update: 'pass' | 'fail' | 'skipped'
  vapi_reread: 'pass' | 'fail' | 'skipped'
  verified_active: boolean
  notes: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function vapi(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, body }
}

async function checkPreview(url: string | null): Promise<'pass' | 'fail' | 'skipped'> {
  if (!url) return 'skipped'
  try {
    const head = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' } })
    if (!head.ok) return 'fail'
    const type = head.headers.get('content-type') ?? ''
    const buf = await head.arrayBuffer()
    if (!type.toLowerCase().startsWith('audio/') && !type.toLowerCase().includes('mpeg') && !type.toLowerCase().includes('mp4')) {
      // Some CDNs serve application/octet-stream; accept if there's a body.
      if (buf.byteLength < 128) return 'fail'
    }
    return buf.byteLength > 0 ? 'pass' : 'fail'
  } catch {
    return 'fail'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401)
    const userId = claims.claims.sub as string

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { data: me } = await admin
      .from('callcapture_clients')
      .select('is_super_admin')
      .eq('user_id', userId)
      .maybeSingle()
    if (!me?.is_super_admin) return json({ error: 'Forbidden — super admin only' }, 403)

    if (!VAPI_API_KEY) return json({ error: 'VAPI_API_KEY not configured' }, 500)

    const body = (await req.json().catch(() => ({}))) as { candidates?: Candidate[]; listOnly?: boolean }

    // Step 1: enumerate what Vapi thinks is available.
    const voiceList = await vapi('/voice')
    if (!voiceList.ok) {
      return json({ error: 'Vapi /voice failed', status: voiceList.status, body: voiceList.body }, 502)
    }
    const rawList = Array.isArray(voiceList.body)
      ? (voiceList.body as unknown[])
      : ((voiceList.body as { voices?: unknown[]; data?: unknown[] })?.voices
          ?? (voiceList.body as { data?: unknown[] })?.data
          ?? [])

    // Also fetch Vapi voice-library which exposes ElevenLabs, PlayHT, etc.
    const libResp = await vapi('/voice-library?limit=200').catch(() => ({ ok: false, status: 0, body: null }))
    const libRaw = libResp.ok
      ? (Array.isArray(libResp.body)
          ? (libResp.body as unknown[])
          : ((libResp.body as { data?: unknown[]; results?: unknown[] })?.data
              ?? (libResp.body as { results?: unknown[] })?.results
              ?? []))
      : []

    const availableIndex = new Map<string, { provider: string; provider_voice_id: string; preview_url: string | null; name: string }>()
    for (const raw of rawList) {
      const v = raw as Record<string, unknown>
      const id = String(v.id ?? v.voiceId ?? v.voice_id ?? v.name ?? '')
      if (!id) continue
      availableIndex.set(`vapi:${id.toLowerCase()}`, {
        provider: 'vapi',
        provider_voice_id: id,
        preview_url: (v.previewUrl ?? v.preview_url ?? null) as string | null,
        name: String(v.name ?? id),
      })
    }
    for (const raw of libRaw) {
      const v = raw as Record<string, unknown>
      const provider = String(v.provider ?? v.voiceProvider ?? '').toLowerCase()
      const id = String(v.voiceId ?? v.providerId ?? v.provider_voice_id ?? v.id ?? '')
      if (!provider || !id) continue
      const key = `${provider}:${id.toLowerCase()}`
      if (!availableIndex.has(key)) {
        availableIndex.set(key, {
          provider,
          provider_voice_id: id,
          preview_url: (v.previewUrl ?? v.preview_url ?? v.sampleUrl ?? null) as string | null,
          name: String(v.name ?? v.displayName ?? id),
        })
      }
    }

    if (body.listOnly) {
      return json({
        available_count: availableIndex.size,
        available: Array.from(availableIndex.values()),
      })
    }

    const candidates: Candidate[] = body.candidates ?? Array.from(availableIndex.values()).slice(0, 24).map((v) => ({
      provider: v.provider,
      provider_voice_id: v.provider_voice_id,
      display_name: v.name,
    }))

    // Step 2: create a scratch assistant we can PATCH repeatedly.
    const seedProvider = candidates.find((c) => c.provider === 'vapi') ?? candidates[0]
    const scratchRes = await vapi('/assistant', {
      method: 'POST',
      body: JSON.stringify({
        name: `voice-verify-${Date.now()}`,
        model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'verify' }] },
        voice: { provider: seedProvider.provider, voiceId: seedProvider.provider_voice_id },
      }),
    })
    if (!scratchRes.ok) {
      return json({ error: 'Could not create scratch Vapi assistant', status: scratchRes.status, body: scratchRes.body }, 502)
    }
    const scratch = scratchRes.body as { id: string }
    const assistantId = scratch.id

    const rows: VerifyRow[] = []
    try {
      for (const cand of candidates) {
        const key = `${cand.provider.toLowerCase()}:${cand.provider_voice_id.toLowerCase()}`
        const found = availableIndex.get(key) ?? null
        const previewUrl = found?.preview_url ?? null
        const row: VerifyRow = {
          display_name: cand.display_name ?? found?.name ?? cand.provider_voice_id,
          provider: cand.provider,
          provider_voice_id: cand.provider_voice_id,
          provider_lookup: found ? 'pass' : 'fail',
          preview_url: previewUrl,
          preview_playback: 'skipped',
          vapi_update: 'skipped',
          vapi_reread: 'skipped',
          verified_active: false,
          notes: '',
        }

        row.preview_playback = await checkPreview(previewUrl)

        const patch = await vapi(`/assistant/${assistantId}`, {
          method: 'PATCH',
          body: JSON.stringify({ voice: { provider: cand.provider, voiceId: cand.provider_voice_id } }),
        })
        row.vapi_update = patch.ok ? 'pass' : 'fail'
        if (!patch.ok) {
          row.notes = `patch ${patch.status}: ${JSON.stringify(patch.body).slice(0, 240)}`
        } else {
          const reread = await vapi(`/assistant/${assistantId}`)
          if (!reread.ok) {
            row.vapi_reread = 'fail'
            row.notes = `reread ${reread.status}`
          } else {
            const v = (reread.body as { voice?: { provider?: string; voiceId?: string } })?.voice
            const providerMatch = String(v?.provider ?? '').toLowerCase() === cand.provider.toLowerCase()
            const idMatch = String(v?.voiceId ?? '') === cand.provider_voice_id
            row.vapi_reread = providerMatch && idMatch ? 'pass' : 'fail'
            if (!providerMatch || !idMatch) {
              row.notes = `reread mismatch: got provider=${v?.provider} voiceId=${v?.voiceId}`
            }
          }
        }

        row.verified_active =
          row.provider_lookup === 'pass'
          && row.preview_playback === 'pass'
          && row.vapi_update === 'pass'
          && row.vapi_reread === 'pass'

        rows.push(row)
      }
    } finally {
      await vapi(`/assistant/${assistantId}`, { method: 'DELETE' }).catch(() => {})
    }

    const passed = rows.filter((r) => r.verified_active)
    return json({
      available_count: availableIndex.size,
      tested: rows.length,
      passed: passed.length,
      rows,
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
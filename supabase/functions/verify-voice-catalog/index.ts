// Verification helper (super-admin only). Proves which voices work end-to-end
// before seeding callcapture_voice_catalog. Does NOT write to catalog, does
// NOT touch tenant assistants — only a fresh scratch assistant it creates
// and tears down itself.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const MAX_CANDIDATES = 40
const CANDIDATE_PAUSE_MS = 150

type Candidate = { provider: string; provider_voice_id: string; display_name?: string }

type PreviewCheck = {
  result: 'pass' | 'fail' | 'skipped'
  status: number | null
  content_type: string | null
  method: 'HEAD' | 'GET' | null
  reason: string
}

type VerifyRow = {
  display_name: string
  provider: string
  provider_voice_id: string
  provider_lookup: 'pass' | 'fail'
  preview_url: string | null
  preview_status: number | null
  preview_content_type: string | null
  preview_playback: 'pass' | 'fail' | 'skipped'
  vapi_update: 'pass' | 'fail' | 'skipped'
  vapi_reread: 'pass' | 'fail' | 'skipped'
  verified_active: boolean
  failure_reason: string
}

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
  /xi-api-key[^A-Za-z0-9]+[A-Za-z0-9_-]{16,}/gi,
]
function redact(input: unknown): string {
  let s = typeof input === 'string' ? input : JSON.stringify(input ?? '')
  for (const re of SECRET_PATTERNS) s = s.replace(re, '[REDACTED]')
  if (VAPI_API_KEY) s = s.split(VAPI_API_KEY).join('[REDACTED]')
  if (SERVICE_KEY) s = s.split(SERVICE_KEY).join('[REDACTED]')
  if (ANON_KEY) s = s.split(ANON_KEY).join('[REDACTED]')
  return s.length > 240 ? s.slice(0, 240) + '…' : s
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

function detectAudioSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  // ID3 (MP3)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  // MP3 frame sync 0xFFEx
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true
  // RIFF (WAV)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true
  // OggS
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true
  // MP4/M4A: bytes 4..7 == 'ftyp'
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true
  // fLaC
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) return true
  return false
}

function classifyContentType(ct: string): 'audio' | 'ambiguous' | 'reject' {
  const t = ct.toLowerCase().split(';')[0].trim()
  if (!t) return 'ambiguous'
  if (t.startsWith('audio/')) return 'audio'
  if (t === 'application/ogg' || t === 'video/mp4' || t === 'application/mp4') return 'audio'
  if (t === 'application/octet-stream' || t === 'binary/octet-stream') return 'ambiguous'
  if (t.startsWith('text/') || t === 'application/json' || t === 'application/xml' || t.includes('html') || t.includes('xml')) return 'reject'
  return 'ambiguous'
}

async function fetchSample(url: string, method: 'HEAD' | 'GET'): Promise<{
  status: number | null
  contentType: string
  bytes: Uint8Array
  error?: string
}> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(url, {
      method,
      headers: method === 'GET' ? { Range: 'bytes=0-2047' } : {},
      signal: controller.signal,
    })
    clearTimeout(timer)
    const contentType = res.headers.get('content-type') ?? ''
    let bytes = new Uint8Array()
    if (method === 'GET') {
      const buf = await res.arrayBuffer()
      bytes = new Uint8Array(buf)
    } else {
      // Drain HEAD response body to avoid resource leak
      await res.body?.cancel().catch(() => {})
    }
    return { status: res.status, contentType, bytes }
  } catch (e) {
    return { status: null, contentType: '', bytes: new Uint8Array(), error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkPreview(url: string | null): Promise<PreviewCheck> {
  if (!url) return { result: 'skipped', status: null, content_type: null, method: null, reason: 'no preview url from provider' }

  // Attempt 1: HEAD
  const head = await fetchSample(url, 'HEAD')
  const headOk = head.status !== null && head.status >= 200 && head.status < 300
  const headCls = classifyContentType(head.contentType)

  // Retry with GET when HEAD is unusable
  const shouldRetryGet =
    head.status === null // network error
    || head.status === 405
    || head.status === 403
    || head.status === 404 // diagnostic only
    || (headOk && headCls === 'ambiguous') // need body to inspect signature
    || (headOk && headCls === 'reject' && head.contentType === '') // no content-type header

  let final = head
  let method: 'HEAD' | 'GET' = 'HEAD'
  if (shouldRetryGet) {
    const got = await fetchSample(url, 'GET')
    final = got
    method = 'GET'
  }

  const status = final.status
  const ct = final.contentType
  if (status === null) {
    return { result: 'fail', status: null, content_type: null, method, reason: `network error: ${redact(final.error ?? 'unknown')}` }
  }
  if (status < 200 || status >= 300) {
    return { result: 'fail', status, content_type: ct || null, method, reason: `http ${status}` }
  }
  const cls = classifyContentType(ct)
  if (cls === 'reject') {
    return { result: 'fail', status, content_type: ct || null, method, reason: `rejected content-type ${ct || '(none)'}` }
  }
  if (cls === 'audio') {
    return { result: 'pass', status, content_type: ct || null, method, reason: 'audio content-type' }
  }
  // ambiguous: require signature. HEAD gave no bytes; if we only did HEAD, fall through with a GET.
  if (method === 'HEAD') {
    const got = await fetchSample(url, 'GET')
    if (got.status === null || got.status < 200 || got.status >= 300) {
      return { result: 'fail', status: got.status, content_type: got.contentType || null, method: 'GET', reason: `http ${got.status ?? 'error'} on GET fallback` }
    }
    const gotCls = classifyContentType(got.contentType)
    if (gotCls === 'reject') return { result: 'fail', status: got.status, content_type: got.contentType || null, method: 'GET', reason: `rejected content-type ${got.contentType}` }
    if (gotCls === 'audio' || detectAudioSignature(got.bytes)) {
      return { result: 'pass', status: got.status, content_type: got.contentType || null, method: 'GET', reason: gotCls === 'audio' ? 'audio content-type' : 'audio signature detected' }
    }
    return { result: 'fail', status: got.status, content_type: got.contentType || null, method: 'GET', reason: 'no audio signature in body' }
  }
  if (detectAudioSignature(final.bytes)) {
    return { result: 'pass', status, content_type: ct || null, method, reason: 'audio signature detected' }
  }
  return { result: 'fail', status, content_type: ct || null, method, reason: 'no audio signature in body' }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

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

    // Vapi voice-library is the enumeration source. It returns entries for
    // every provider Vapi accepts (vapi native, 11labs, playht, etc). There
    // is no separate /voice endpoint.
    const libResp = await vapi('/voice-library?limit=500').catch(() => ({ ok: false, status: 0, body: null }))
    if (!libResp.ok) {
      return json({ error: 'Vapi /voice-library failed', status: libResp.status, body: redact(libResp.body) }, 502)
    }
    const libRaw = Array.isArray(libResp.body)
      ? (libResp.body as unknown[])
      : ((libResp.body as { data?: unknown[]; results?: unknown[] })?.data
          ?? (libResp.body as { results?: unknown[] })?.results
          ?? [])
    const rawList: unknown[] = []

    type Avail = { provider: string; provider_voice_id: string; preview_url: string | null; name: string }
    const availableIndex = new Map<string, Avail>()
    const vapiNative: Avail[] = []
    const elevenLabs: Avail[] = []
    const otherProviders: Avail[] = []

    for (const raw of rawList) {
      const v = raw as Record<string, unknown>
      const id = String(v.id ?? v.voiceId ?? v.voice_id ?? v.name ?? '').trim()
      if (!id) continue
      const entry: Avail = {
        provider: 'vapi',
        provider_voice_id: id,
        preview_url: (v.previewUrl ?? v.preview_url ?? null) as string | null,
        name: String(v.name ?? id),
      }
      const key = `vapi:${id.toLowerCase()}`
      if (!availableIndex.has(key)) {
        availableIndex.set(key, entry)
        vapiNative.push(entry)
      }
    }
    for (const raw of libRaw) {
      const v = raw as Record<string, unknown>
      const provider = String(v.provider ?? v.voiceProvider ?? '').toLowerCase()
      const id = String(v.voiceId ?? v.providerId ?? v.provider_voice_id ?? v.id ?? '').trim()
      if (!provider || !id) continue
      const key = `${provider}:${id.toLowerCase()}`
      if (availableIndex.has(key)) continue
      const entry: Avail = {
        provider,
        provider_voice_id: id,
        preview_url: (v.previewUrl ?? v.preview_url ?? v.sampleUrl ?? null) as string | null,
        name: String(v.name ?? v.displayName ?? id),
      }
      availableIndex.set(key, entry)
      if (provider === 'vapi') vapiNative.push(entry)
      else if (provider === '11labs' || provider === 'elevenlabs') elevenLabs.push(entry)
      else otherProviders.push(entry)
    }

    if (body.listOnly) {
      return json({
        available_count: availableIndex.size,
        vapi_native: vapiNative.length,
        elevenlabs: elevenLabs.length,
        other: otherProviders.length,
        sample: Array.from(availableIndex.values()).slice(0, 60),
      })
    }

    // Build candidate list: interleave providers so both are represented; dedupe; cap.
    const seen = new Set<string>()
    const candidates: Candidate[] = []
    const pushIfNew = (a: Avail) => {
      const key = `${a.provider.toLowerCase()}:${a.provider_voice_id.trim().toLowerCase()}`
      if (seen.has(key)) return
      if (candidates.length >= MAX_CANDIDATES) return
      seen.add(key)
      candidates.push({ provider: a.provider, provider_voice_id: a.provider_voice_id, display_name: a.name })
    }

    if (body.candidates && body.candidates.length) {
      for (const c of body.candidates) {
        const key = `${c.provider.toLowerCase()}:${c.provider_voice_id.trim().toLowerCase()}`
        if (seen.has(key)) continue
        if (candidates.length >= MAX_CANDIDATES) break
        seen.add(key)
        candidates.push(c)
      }
    } else {
      // Interleave vapi + elevenlabs for balanced coverage
      const maxLen = Math.max(vapiNative.length, elevenLabs.length, otherProviders.length)
      for (let i = 0; i < maxLen && candidates.length < MAX_CANDIDATES; i++) {
        if (i < vapiNative.length) pushIfNew(vapiNative[i])
        if (i < elevenLabs.length) pushIfNew(elevenLabs[i])
        if (i < otherProviders.length && candidates.length < MAX_CANDIDATES) pushIfNew(otherProviders[i])
      }
    }

    if (candidates.length === 0) {
      return json({ error: 'No candidate voices available from provider', available_count: availableIndex.size }, 502)
    }

    // Create scratch assistant. Seed with a Vapi-native voice we already know about.
    const seed = vapiNative[0]
      ?? (candidates.find((c) => c.provider.toLowerCase() === 'vapi') as Candidate | undefined)
      ?? candidates[0]
    const seedVoice = { provider: seed.provider, voiceId: seed.provider_voice_id }

    const scratchRes = await vapi('/assistant', {
      method: 'POST',
      body: JSON.stringify({
        name: `voice-verify-${Date.now()}`,
        model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'verify' }] },
        voice: seedVoice,
      }),
    })
    if (!scratchRes.ok) {
      return json({
        error: 'Could not create scratch Vapi assistant',
        status: scratchRes.status,
        body: redact(scratchRes.body),
      }, 502)
    }
    const assistantId = (scratchRes.body as { id: string }).id

    const rows: VerifyRow[] = []
    const safety = {
      scratch_assistant_id: assistantId,
      seed_voice: seedVoice,
      restore_attempted: false,
      restored: false,
      restore_verified: false,
      delete_attempted: false,
      deleted: false,
      reasons: [] as string[],
    }

    try {
      for (const cand of candidates) {
        const key = `${cand.provider.toLowerCase()}:${cand.provider_voice_id.trim().toLowerCase()}`
        const found = availableIndex.get(key) ?? null
        const previewUrl = found?.preview_url ?? null
        const row: VerifyRow = {
          display_name: cand.display_name ?? found?.name ?? cand.provider_voice_id,
          provider: cand.provider,
          provider_voice_id: cand.provider_voice_id,
          provider_lookup: found ? 'pass' : 'fail',
          preview_url: previewUrl,
          preview_status: null,
          preview_content_type: null,
          preview_playback: 'skipped',
          vapi_update: 'skipped',
          vapi_reread: 'skipped',
          verified_active: false,
          failure_reason: '',
        }

        const preview = await checkPreview(previewUrl)
        row.preview_playback = preview.result
        row.preview_status = preview.status
        row.preview_content_type = preview.content_type
        if (preview.result !== 'pass') row.failure_reason = `preview: ${preview.reason}`

        const patch = await vapi(`/assistant/${assistantId}`, {
          method: 'PATCH',
          body: JSON.stringify({ voice: { provider: cand.provider, voiceId: cand.provider_voice_id } }),
        })
        row.vapi_update = patch.ok ? 'pass' : 'fail'
        if (!patch.ok) {
          const r = `vapi PATCH ${patch.status}: ${redact(patch.body)}`
          row.failure_reason = row.failure_reason ? `${row.failure_reason}; ${r}` : r
        } else {
          const reread = await vapi(`/assistant/${assistantId}`)
          if (!reread.ok) {
            row.vapi_reread = 'fail'
            const r = `vapi GET ${reread.status}`
            row.failure_reason = row.failure_reason ? `${row.failure_reason}; ${r}` : r
          } else {
            const v = (reread.body as { voice?: { provider?: string; voiceId?: string } })?.voice
            const providerMatch = String(v?.provider ?? '').toLowerCase() === cand.provider.toLowerCase()
            const idMatch = String(v?.voiceId ?? '') === cand.provider_voice_id
            row.vapi_reread = providerMatch && idMatch ? 'pass' : 'fail'
            if (!providerMatch || !idMatch) {
              const r = `reread mismatch: provider=${redact(v?.provider ?? '')} voiceId=${redact(v?.voiceId ?? '')}`
              row.failure_reason = row.failure_reason ? `${row.failure_reason}; ${r}` : r
            }
          }
        }

        row.verified_active =
          row.provider_lookup === 'pass'
          && row.preview_playback === 'pass'
          && row.vapi_update === 'pass'
          && row.vapi_reread === 'pass'

        rows.push(row)
        await sleep(CANDIDATE_PAUSE_MS)
      }
    } finally {
      // Cleanup: independently guarded operations.
      try {
        safety.restore_attempted = true
        const restore = await vapi(`/assistant/${assistantId}`, {
          method: 'PATCH',
          body: JSON.stringify({ voice: seedVoice }),
        })
        safety.restored = restore.ok
        if (!restore.ok) safety.reasons.push(`restore PATCH ${restore.status}: ${redact(restore.body)}`)
      } catch (e) {
        safety.reasons.push(`restore threw: ${redact(e instanceof Error ? e.message : String(e))}`)
      } finally {
        try {
          const reread = await vapi(`/assistant/${assistantId}`)
          if (reread.ok) {
            const v = (reread.body as { voice?: { provider?: string; voiceId?: string } })?.voice
            const providerMatch = String(v?.provider ?? '').toLowerCase() === seedVoice.provider.toLowerCase()
            const idMatch = String(v?.voiceId ?? '') === seedVoice.voiceId
            safety.restore_verified = providerMatch && idMatch
            if (!safety.restore_verified) safety.reasons.push(`restore verify mismatch: provider=${redact(v?.provider ?? '')} voiceId=${redact(v?.voiceId ?? '')}`)
          } else {
            safety.reasons.push(`restore verify GET ${reread.status}`)
          }
        } catch (e) {
          safety.reasons.push(`restore verify threw: ${redact(e instanceof Error ? e.message : String(e))}`)
        } finally {
          try {
            safety.delete_attempted = true
            const del = await vapi(`/assistant/${assistantId}`, { method: 'DELETE' })
            safety.deleted = del.ok
            if (!del.ok) safety.reasons.push(`delete ${del.status}: ${redact(del.body)}`)
          } catch (e) {
            safety.reasons.push(`delete threw: ${redact(e instanceof Error ? e.message : String(e))}`)
          }
        }
      }
    }

    const passed = rows.filter((r) => r.verified_active).length
    return json({
      available_count: availableIndex.size,
      vapi_native_count: vapiNative.length,
      elevenlabs_count: elevenLabs.length,
      tested: rows.length,
      passed,
      passed_min_12: passed >= 12,
      rows,
      safety,
    })
  } catch (e) {
    return json({ error: redact(e instanceof Error ? e.message : String(e)) }, 500)
  }
})
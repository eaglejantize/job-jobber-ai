// Vapi-native-only voice verifier (super-admin). No enumeration endpoint call,
// no fabricated preview URLs, no external providers. Validates each candidate
// by PATCHing a dedicated scratch assistant + reading it back, then restores
// and deletes the scratch assistant.

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

const CANDIDATE_PAUSE_MS = 150

// Hardcoded Vapi-native candidate list. No enumeration endpoint exists.
const VAPI_NATIVE_CANDIDATES = [
  'Emma', 'Nico', 'Sagar', 'Kai', 'Neil', 'Clara',
  'Godfrey', 'Layla', 'Sid', 'Naina', 'Elliot',
]

type VerifyRow = {
  display_name: string
  provider: 'vapi'
  provider_voice_id: string
  scratch_patch: 'pass' | 'fail'
  assistant_reread: 'pass' | 'fail' | 'skipped'
  preview_method: 'scratch_assistant_configured'
  preview_playback: 'skipped_no_programmatic_source'
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

    // Dedupe candidate list (case-insensitive by voiceId) but preserve given order.
    const seen = new Set<string>()
    const candidates: string[] = []
    for (const name of VAPI_NATIVE_CANDIDATES) {
      const k = name.trim().toLowerCase()
      if (!k || seen.has(k)) continue
      seen.add(k)
      candidates.push(name.trim())
    }

    // Seed scratch assistant with the first candidate; if creation fails, try
    // the next one until one succeeds (some IDs may be rejected outright).
    let assistantId = ''
    let seedVoice = { provider: 'vapi' as const, voiceId: '' }
    const seedAttempts: Array<{ voiceId: string; status: number; body: string }> = []
    for (const name of candidates) {
      const attempt = await vapi('/assistant', {
        method: 'POST',
        body: JSON.stringify({
          name: `voice-verify-${Date.now()}`,
          model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'verify' }] },
          voice: { provider: 'vapi', voiceId: name },
        }),
      })
      if (attempt.ok) {
        assistantId = (attempt.body as { id: string }).id
        seedVoice = { provider: 'vapi', voiceId: name }
        break
      }
      seedAttempts.push({ voiceId: name, status: attempt.status, body: redact(attempt.body) })
    }
    if (!assistantId) {
      return json({
        error: 'Could not create scratch Vapi assistant with any candidate voice',
        seed_attempts: seedAttempts,
      }, 502)
    }

    const rows: VerifyRow[] = []
    const safety = {
      scratch_assistant_id: assistantId,
      seed_voice: seedVoice,
      seed_attempts_failed: seedAttempts,
      restore_attempted: false,
      restored: false,
      restore_verified: false,
      delete_attempted: false,
      deleted: false,
      reasons: [] as string[],
    }

    try {
      for (const name of candidates) {
        const row: VerifyRow = {
          display_name: name,
          provider: 'vapi',
          provider_voice_id: name,
          scratch_patch: 'fail',
          assistant_reread: 'skipped',
          preview_method: 'scratch_assistant_configured',
          preview_playback: 'skipped_no_programmatic_source',
          verified_active: false,
          failure_reason: '',
        }

        const patch = await vapi(`/assistant/${assistantId}`, {
          method: 'PATCH',
          body: JSON.stringify({ voice: { provider: 'vapi', voiceId: name } }),
        })
        if (!patch.ok) {
          row.scratch_patch = 'fail'
          row.failure_reason = `vapi PATCH ${patch.status}: ${redact(patch.body)}`
        } else {
          row.scratch_patch = 'pass'
          const reread = await vapi(`/assistant/${assistantId}`)
          if (!reread.ok) {
            row.assistant_reread = 'fail'
            row.failure_reason = `vapi GET ${reread.status}: ${redact(reread.body)}`
          } else {
            const v = (reread.body as { voice?: { provider?: string; voiceId?: string } })?.voice
            const providerMatch = String(v?.provider ?? '').toLowerCase() === 'vapi'
            const idMatch = String(v?.voiceId ?? '').toLowerCase() === name.toLowerCase()
            row.assistant_reread = providerMatch && idMatch ? 'pass' : 'fail'
            if (!providerMatch || !idMatch) {
              row.failure_reason = `reread mismatch: provider=${redact(v?.provider ?? '')} voiceId=${redact(v?.voiceId ?? '')}`
            }
          }
        }

        row.verified_active = row.scratch_patch === 'pass' && row.assistant_reread === 'pass'
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

    const verified = rows.filter((r) => r.verified_active).length
    return json({
      candidates_tested: rows.length,
      verified,
      passed_min_12: verified >= 12,
      note: 'preview_playback is not confirmed in this run; verified_active reflects PATCH + re-read only. Audible preview requires an approved outbound test-call or in-browser webCall mechanism.',
      rows,
      safety,
    })
  } catch (e) {
    return json({ error: redact(e instanceof Error ? e.message : String(e)) }, 500)
  }
})
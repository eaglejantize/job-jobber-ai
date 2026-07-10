import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "verify-voice-catalog";
const EXPECTED_EMAIL = "eaglejantize@gmail.com";

function redact(input: string): string {
  let s = input;
  s = s.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  s = s.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[REDACTED_JWT]");
  s = s.replace(/(apikey"\s*:\s*")[^"]+(")/gi, "$1[REDACTED]$2");
  s = s.replace(/(authorization"\s*:\s*")[^"]+(")/gi, "$1[REDACTED]$2");
  return s;
}

type Diag = {
  hasSession: boolean;
  userEmail: string | null;
  hasAccessToken: boolean;
  tokenTail: string | null;
  authHeaderSent: boolean;
};

type RunResult = {
  httpStatus: number | null;
  ok: boolean;
  body: unknown;
  rawText: string;
  error?: string;
  diag: Diag;
};

export default function VoiceVerificationRunner() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setSessionEmail(data.session?.user.email ?? null);
    })();
  }, []);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const session = sessData.session;
      if (!session) {
        setResult({
          httpStatus: null,
          ok: false,
          body: null,
          rawText: "",
          error: "You must sign in again before running verification.",
          diag: { hasSession: false, userEmail: null, hasAccessToken: false, tokenTail: null, authHeaderSent: false },
        });
        return;
      }

      const token = session.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const diag: Diag = {
        hasSession: true,
        userEmail: session.user.email ?? null,
        hasAccessToken: !!token,
        tokenTail: token ? token.slice(-4) : null,
        authHeaderSent: !!token,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anon,
        },
        body: JSON.stringify({}),
      });
      const rawText = await res.text();
      let body: unknown = rawText;
      try { body = JSON.parse(rawText); } catch { /* keep text */ }
      setResult({ httpStatus: res.status, ok: res.ok, body, rawText, diag });
    } catch (e) {
      setResult({
        httpStatus: null,
        ok: false,
        body: null,
        rawText: "",
        error: redact(e instanceof Error ? e.message : String(e)),
        diag: { hasSession, userEmail: sessionEmail, hasAccessToken: false, tokenTail: null, authHeaderSent: false },
      });
    } finally {
      setRunning(false);
    }
  }

  const emailMismatch = sessionEmail && sessionEmail.toLowerCase() !== EXPECTED_EMAIL;

  const b = (result?.body ?? {}) as {
    rows?: Array<Record<string, unknown>>;
    safety?: Record<string, unknown>;
    candidates_tested?: number;
    verified?: number;
    passed_min_12?: boolean;
    note?: string;
    error?: string;
  };
  const rows = b.rows ?? [];

  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Voice Verification (temporary)</h2>
        <p className="text-sm text-slate-400">
          Temporary diagnostic — invokes <code className="text-slate-300">{FUNCTION_NAME}</code> with the current
          authenticated session. Remove after voice catalog is approved.
        </p>
      </div>

      <div className="text-xs text-slate-300 space-y-1 border border-slate-700 rounded-md p-3 bg-slate-900/40">
        <div>Signed in as: <span className="font-mono text-white">{sessionEmail ?? "—"}</span></div>
        <div>Session present: <span className="font-mono">{String(hasSession)}</span></div>
        {emailMismatch && (
          <div className="text-amber-400">
            Warning: signed-in email is not {EXPECTED_EMAIL}. Server-side super-admin check will still apply.
          </div>
        )}
      </div>

      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 disabled:opacity-50"
      >
        {running && <Loader2 className="h-4 w-4 animate-spin" />}
        Run Vapi Voice Verification
      </button>

      {result && (
        <div className="space-y-4">
          {result.error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 p-3 text-sm">
              {result.error}
            </div>
          )}

          <div className="text-xs border border-slate-700 rounded-md p-3 bg-slate-900/40">
            <div className="font-semibold text-slate-300 mb-1">Diagnostics</div>
            <div className="font-mono text-slate-300 space-y-0.5">
              <div>HTTP status: <span className="text-white">{result.httpStatus ?? "—"}</span></div>
              <div>getSession() returned session: {String(result.diag.hasSession)}</div>
              <div>Authenticated user email: {result.diag.userEmail ?? "—"}</div>
              <div>Access token present: {String(result.diag.hasAccessToken)} {result.diag.tokenTail ? `(…${result.diag.tokenTail})` : ""}</div>
              <div>Authorization bearer header sent: {String(result.diag.authHeaderSent)}</div>
            </div>
          </div>

          {typeof result.httpStatus === "number" && result.httpStatus >= 400 && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs">
              <div className="font-semibold text-red-300 mb-1">Server response body (redacted)</div>
              <pre className="whitespace-pre-wrap text-red-200 font-mono">{redact(result.rawText)}</pre>
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-auto rounded-md border border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase">
                  <tr>
                    {["display_name","provider","provider_voice_id","scratch_patch","assistant_reread","preview_method","preview_playback","verified_active","failure_reason"].map(h => (
                      <th key={h} className="text-left px-2 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-200 font-mono">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {["display_name","provider","provider_voice_id","scratch_patch","assistant_reread","preview_method","preview_playback","verified_active","failure_reason"].map(k => (
                        <td key={k} className="px-2 py-1.5 align-top">{String((r as Record<string, unknown>)[k] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {b.safety && (
            <div className="text-xs border border-slate-700 rounded-md p-3 bg-slate-900/40">
              <div className="font-semibold text-slate-300 mb-1">Safety cleanup</div>
              <pre className="whitespace-pre-wrap text-slate-300 font-mono">{redact(JSON.stringify(b.safety, null, 2))}</pre>
            </div>
          )}

          {(b.candidates_tested !== undefined || b.verified !== undefined) && (
            <div className="text-xs border border-slate-700 rounded-md p-3 bg-slate-900/40 space-y-0.5 font-mono text-slate-200">
              <div>candidates_tested: {String(b.candidates_tested ?? "—")}</div>
              <div>verified: {String(b.verified ?? "—")}</div>
              <div>passed_min_12: {String(b.passed_min_12 ?? "—")}</div>
              {b.note && <div className="text-slate-400 mt-1">note: {b.note}</div>}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-slate-400 hover:text-white">Complete JSON response</summary>
            <pre className="mt-2 whitespace-pre-wrap text-slate-300 font-mono border border-slate-700 rounded-md p-3 bg-slate-900/40">
              {redact(typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2))}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
// Shared Google Calendar helper. Uses the Lovable workspace connector (test mode)
// when per-tenant OAuth tokens are not yet set on the tenant row.

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export interface CalendarAuth {
  // per-tenant OAuth access token, when present
  accessToken?: string | null;
  // when no tenant token, fall back to workspace connector
  useWorkspaceConnector?: boolean;
}

function authHeaders(auth: CalendarAuth): Record<string, string> {
  if (auth.accessToken) {
    return { Authorization: `Bearer ${auth.accessToken}` };
  }
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connKey = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!lovableKey || !connKey) {
    throw new Error("Google Calendar not configured (LOVABLE_API_KEY / GOOGLE_CALENDAR_API_KEY missing)");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

function calendarBase(auth: CalendarAuth): string {
  // Per-tenant tokens hit Google directly; workspace connector goes through gateway.
  return auth.accessToken
    ? "https://www.googleapis.com/calendar/v3"
    : GATEWAY;
}

export async function freeBusy(
  auth: CalendarAuth,
  calendarId: string,
  timeMinIso: string,
  timeMaxIso: string,
  timeZone: string,
): Promise<Array<{ start: string; end: string }>> {
  const r = await fetch(`${calendarBase(auth)}/freeBusy`, {
    method: "POST",
    headers: { ...authHeaders(auth), "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      timeZone,
      items: [{ id: calendarId }],
    }),
  });
  if (!r.ok) throw new Error(`freeBusy ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const busy = j?.calendars?.[calendarId]?.busy ?? [];
  return busy as Array<{ start: string; end: string }>;
}

export interface BookEventInput {
  calendarId: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  attendeeEmail?: string | null;
  location?: string | null;
}

export async function createEvent(auth: CalendarAuth, input: BookEventInput) {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: input.timeZone },
    end: { dateTime: input.endIso, timeZone: input.timeZone },
  };
  if (input.location) body.location = input.location;
  if (input.attendeeEmail) body.attendees = [{ email: input.attendeeEmail }];
  const url = `${calendarBase(auth)}/calendars/${encodeURIComponent(input.calendarId)}/events`;
  const r = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(auth), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`createEvent ${r.status}: ${await r.text()}`);
  return await r.json();
}

// Generate candidate slot starts on the hour/half-hour within business hours
// for the next N days, filter out any that overlap with busy intervals.
export function generateCandidateSlots(opts: {
  fromIso: string;
  days: number;
  durationMinutes: number;
  businessHours?: { start: string; end: string } | null; // local "HH:MM"
  stepMinutes?: number;
}): Array<{ startIso: string; endIso: string }> {
  const step = opts.stepMinutes ?? 30;
  const from = new Date(opts.fromIso);
  const slots: Array<{ startIso: string; endIso: string }> = [];
  const startH = parseInt((opts.businessHours?.start ?? "08:00").split(":")[0], 10);
  const startM = parseInt((opts.businessHours?.start ?? "08:00").split(":")[1], 10);
  const endH = parseInt((opts.businessHours?.end ?? "18:00").split(":")[0], 10);
  const endM = parseInt((opts.businessHours?.end ?? "18:00").split(":")[1], 10);

  for (let d = 0; d < opts.days; d++) {
    const day = new Date(from);
    day.setUTCDate(from.getUTCDate() + d);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends by default
    const dayStart = new Date(day);
    dayStart.setUTCHours(startH, startM, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setUTCHours(endH, endM, 0, 0);
    let cursor = new Date(Math.max(dayStart.getTime(), from.getTime()));
    // round up to next step
    const minutes = cursor.getUTCMinutes();
    const rem = minutes % step;
    if (rem !== 0) cursor.setUTCMinutes(minutes + (step - rem), 0, 0);
    while (cursor.getTime() + opts.durationMinutes * 60000 <= dayEnd.getTime()) {
      const end = new Date(cursor.getTime() + opts.durationMinutes * 60000);
      slots.push({ startIso: cursor.toISOString(), endIso: end.toISOString() });
      cursor = new Date(cursor.getTime() + step * 60000);
    }
  }
  return slots;
}

export function filterAvailable(
  slots: Array<{ startIso: string; endIso: string }>,
  busy: Array<{ start: string; end: string }>,
): Array<{ startIso: string; endIso: string }> {
  return slots.filter((s) => {
    const sStart = new Date(s.startIso).getTime();
    const sEnd = new Date(s.endIso).getTime();
    return !busy.some((b) => {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      return sStart < bEnd && sEnd > bStart;
    });
  });
}

export async function resolveAuthForClient(
  client: { google_oauth_access_token?: string | null; google_oauth_expires_at?: string | null } | null,
): Promise<CalendarAuth> {
  // TODO (production): refresh per-tenant OAuth tokens when expired.
  if (client?.google_oauth_access_token) {
    return { accessToken: client.google_oauth_access_token };
  }
  return { useWorkspaceConnector: true };
}
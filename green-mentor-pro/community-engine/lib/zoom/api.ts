/**
 * Minimal Zoom REST client (Server-to-Server OAuth) — just enough to pull a
 * past meeting's poll results into the admin hub.
 *
 * Zoom has no webhook for polls and no live-results endpoint: answers become
 * readable only after the meeting ends, via GET /past_meetings/{id}/polls,
 * and can lag the ending by a few minutes. So this is a pull, triggered by
 * the "Sync from Zoom" button in the Webinars panel.
 *
 * Credentials come from an internal Server-to-Server OAuth app
 * (marketplace.zoom.us → Develop → Server-to-Server OAuth; activation is
 * immediate, no marketplace review) with a scope that covers past-meeting
 * polls — classic `meeting:read:admin`, or granular
 * `meeting:read:list_past_polls:admin`. These are separate from the
 * platform's ZOOM_SDK_KEY/SECRET, which only sign embed-join signatures.
 */

const TOKEN_URL = "https://zoom.us/oauth/token";
const API_BASE = "https://api.zoom.us/v2";

export function isZoomApiConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_S2S_ACCOUNT_ID && process.env.ZOOM_S2S_CLIENT_ID && process.env.ZOOM_S2S_CLIENT_SECRET
  );
}

/** A Zoom API failure the route can map onto a sensible HTTP response. */
export class ZoomApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ZoomApiError";
    this.status = status;
  }
}

// S2S tokens last an hour; cache per server instance with a safety margin so
// every sync click doesn't mint a fresh one.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const accountId = process.env.ZOOM_S2S_ACCOUNT_ID;
  const clientId = process.env.ZOOM_S2S_CLIENT_ID;
  const clientSecret = process.env.ZOOM_S2S_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new ZoomApiError(503, "Zoom API credentials are not configured on the server.");
  }

  const url = `${TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    reason?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new ZoomApiError(
      502,
      `Zoom would not issue an access token (${body.reason ?? `HTTP ${res.status}`}) — check the S2S app credentials.`
    );
  }
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.token;
}

/** One flattened answer from Zoom's respondent-centric poll report. */
export interface ZoomPollAnswer {
  name: string | null;
  email: string | null;
  question: string;
  answer: string;
  /** ISO timestamp when Zoom includes one (`date_time`), else null. */
  answeredAt: string | null;
}

interface PastMeetingPollsResponse {
  questions?: {
    name?: string;
    email?: string;
    question_details?: { question?: string; answer?: string; date_time?: string }[];
  }[];
}

/**
 * Poll answers for a past meeting, flattened to one row per
 * (respondent, question). `meetingNumber` is the same number learners join
 * with (community_webinars.zoom_meeting_number); Zoom resolves it to the
 * meeting's most recent instance, which is the webinar that just ended as
 * long as each webinar gets its own Zoom meeting.
 *
 * Returns [] when the meeting exists but has no poll answers (yet) — Zoom's
 * results can take a few minutes after the meeting ends to appear.
 */
export async function fetchPastMeetingPollAnswers(meetingNumber: string): Promise<ZoomPollAnswer[]> {
  const mn = meetingNumber.replace(/\s+/g, "");
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/past_meetings/${encodeURIComponent(mn)}/polls`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new ZoomApiError(
      404,
      `Zoom has no poll results for meeting ${mn} yet. The meeting may still be running, may not have ended long enough ago (results can take a few minutes), or no poll was launched.`
    );
  }
  const body = (await res.json().catch(() => ({}))) as PastMeetingPollsResponse & { message?: string };
  if (!res.ok) {
    throw new ZoomApiError(502, `Zoom API error (HTTP ${res.status}): ${body.message ?? "unknown error"}`);
  }

  const answers: ZoomPollAnswer[] = [];
  for (const respondent of body.questions ?? []) {
    for (const detail of respondent.question_details ?? []) {
      const question = detail.question?.trim();
      const answer = detail.answer?.trim();
      if (!question || !answer) continue; // unanswered slots carry empty strings
      answers.push({
        name: respondent.name?.trim() || null,
        email: respondent.email?.trim() || null,
        question,
        answer,
        answeredAt: detail.date_time ?? null,
      });
    }
  }
  return answers;
}

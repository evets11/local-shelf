import { BadRequestError, ExpiredResultError, RateLimitedError } from "@/lib/spydus/client";

/** Error JSON: { error: short message, code }. The UI can show `error` as-is. */
export function errorResponse(e: unknown, tag: string): Response {
  const json = (status: number, code: string, error: string) =>
    Response.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });
  if (e instanceof BadRequestError) return json(400, "bad_request", e.message);
  if (e instanceof RateLimitedError) return json(429, "rate_limited", e.message);
  if (e instanceof ExpiredResultError) return json(410, "expired", e.message);
  console.error(`[${tag}]`, e);
  return json(502, "upstream", "Library catalogue unavailable, try again shortly");
}

const MAX_AGE = 30 * 24 * 3600; // 30 days

export const PUBLIC_CACHE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": `public, max-age=${MAX_AGE}, immutable`,
} as const;

export const NO_CACHE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
} as const;

export function jsonResponse(
  data: unknown,
  cache: "public" | "none",
): Response {
  return new Response(JSON.stringify(data), {
    headers: cache === "public" ? PUBLIC_CACHE_HEADERS : NO_CACHE_HEADERS,
  });
}

export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

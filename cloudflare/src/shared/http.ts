export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function errorResponse(status: number, message: string, details?: unknown): Response {
  return jsonResponse(
    {
      error: message,
      details: details ?? null
    },
    status
  );
}

export async function parseJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text) {
    throw new Error("Request body is required");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

export function base64UrlEncode(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(b64);
  const bytes = new Uint8Array(decoded.length);
  for (let idx = 0; idx < decoded.length; idx += 1) {
    bytes[idx] = decoded.charCodeAt(idx);
  }
  return bytes;
}

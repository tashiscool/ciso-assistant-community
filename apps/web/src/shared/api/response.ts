import { ApiError } from './error';

function asErrorRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Parses the transport response, without asserting a feature's business contract. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown;
  let parsed = false;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
      parsed = true;
    } catch {
      // Opaque error pages and malformed responses must not leak their raw body.
    }
  }

  if (!response.ok) {
    const record = parsed ? asErrorRecord(payload) : null;
    const message = nonEmptyString(record?.message) ?? nonEmptyString(record?.error);
    throw new ApiError(response.status, message ?? `Request failed: ${response.status}`, {
      code: nonEmptyString(record?.code) ?? nonEmptyString(record?.error),
      details: record?.details,
    });
  }

  if ((response.status === 204 || response.status === 205) && !text.trim()) {
    return undefined as T;
  }

  if (!parsed) {
    throw new ApiError(
      response.status,
      text.trim() ? 'The server returned an invalid JSON response.' : 'The server returned an empty response.',
      { code: text.trim() ? 'invalid_json_response' : 'empty_response' },
    );
  }

  return payload as T;
}

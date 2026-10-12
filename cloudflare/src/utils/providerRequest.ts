export type ProviderRequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal | null;
};

export const DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

export class ProviderRequestError extends Error {
  readonly code: 'provider_request_timeout' | 'provider_request_aborted';

  constructor(code: 'provider_request_timeout' | 'provider_request_aborted') {
    super(code === 'provider_request_timeout' ? 'Provider request timed out.' : 'Provider request was cancelled.');
    this.name = 'ProviderRequestError';
    this.code = code;
  }
}

/** Keep response consumption inside the deadline; do not return an unread Response. */
export async function providerRequest<T>(
  request: (signal: AbortSignal) => Promise<Response>,
  consume: (response: Response) => T | Promise<T>,
  options: ProviderRequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new RangeError('Provider request timeout must be a positive supported integer.');
  }
  if (options.signal?.aborted) throw new ProviderRequestError('provider_request_aborted');
  const deadlineAt = Date.now() + timeoutMs;
  const controller = new AbortController();
  let rejectDeadline: (error: ProviderRequestError) => void;
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const cancel = (code: ProviderRequestError['code']) => {
    if (controller.signal.aborted) return;
    const error = new ProviderRequestError(code);
    rejectDeadline(error);
    controller.abort(error);
  };
  const onCallerAbort = () => cancel('provider_request_aborted');
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => cancel('provider_request_timeout'), timeoutMs);
  const ensureActive = () => {
    if (Date.now() >= deadlineAt) cancel('provider_request_timeout');
    if (controller.signal.aborted) throw controller.signal.reason;
  };
  const operation = Promise.resolve().then(async () => {
    ensureActive();
    const response = await request(controller.signal);
    try {
      ensureActive();
    } catch (error) {
      void response.body?.cancel().catch(() => {});
      throw error;
    }
    const value = await consume(response);
    ensureActive();
    return value;
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}

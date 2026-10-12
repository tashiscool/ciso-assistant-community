const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The responsive command seeds data, so its target must be a local origin. */
export function assertLoopbackBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Responsive QA requires a valid HTTP(S) loopback origin.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.username || url.password || url.search || url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new Error('Responsive QA seeds local data and only accepts HTTP(S) loopback origins without credentials, paths, queries, or fragments.');
  }
  return url.origin;
}

export function isUnexpectedResponseFailure(status, responseUrl, baseUrl) {
  if (status >= 500) return true;
  if (status < 400) return false;
  try {
    const url = new URL(responseUrl);
    return url.origin === new URL(baseUrl).origin && (url.pathname === '/_api' || url.pathname.startsWith('/_api/'));
  } catch {
    return true;
  }
}

export function evaluateResponsiveResult({
  hasAppContent,
  maxOverflow,
  maxAllowedOverflow,
  width,
  usesRegoviseShell,
  openNavigationButtonVisible,
  mobileNavOpened,
  consoleErrors = [],
  pageErrors = [],
  failedResponses = [],
  failedRequests = [],
}) {
  const failureReasons = [];
  if (!hasAppContent) failureReasons.push('Expected application content was not rendered.');
  if (!Number.isFinite(maxOverflow) || maxOverflow > maxAllowedOverflow) failureReasons.push('The page exceeds its allowed horizontal overflow.');
  if (width < 768 && usesRegoviseShell && !(openNavigationButtonVisible && mobileNavOpened)) failureReasons.push('Mobile navigation could not be opened.');
  if (consoleErrors.length) failureReasons.push('Unexpected console errors were recorded.');
  if (pageErrors.length) failureReasons.push('Unexpected page errors were recorded.');
  if (failedResponses.length) failureReasons.push('Unexpected failed HTTP responses were recorded.');
  if (failedRequests.length) failureReasons.push('Failed network requests were recorded.');
  return { passed: failureReasons.length === 0, failureReasons };
}

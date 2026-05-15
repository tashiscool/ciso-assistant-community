export type AuthProtocol = 'none' | 'oidc' | 'saml' | 'cloudflare-access';

export type OidcConfigRecord = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  providerType: string | null;
  authProtocol: AuthProtocol;
  clientId: string | null;
  callbackUrl: string | null;
  metadataUrl: string | null;
  domainHint: string | null;
  buttonLabel: string | null;
  rolesClaim: string | null;
  emailClaim: string | null;
  givenNameClaim: string | null;
  familyNameClaim: string | null;
  usernameClaim: string | null;
  groupSyncEnabled: boolean;
  loginEnforced: boolean;
  allowLocalFallback: boolean;
  jitProvisioningEnabled: boolean;
  jitDefaultRoleNames: string[];
};

export type OidcAuthTransactionRecord = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  providerType: string;
  authProtocol: AuthProtocol;
  nextPath: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
  expiresAt: string;
};

type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwkSet = {
  keys?: JsonWebKey[];
};

export type OidcIdentityClaims = {
  issuer: string;
  subject: string;
  email: string | null;
  preferredUsername: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  roleNames: string[];
  rawClaims: Record<string, unknown>;
};

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function normalizeClaimPath(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? '').trim();
  return normalized || fallback;
}

function readNestedClaim(source: Record<string, unknown>, path: string): unknown {
  const parts = normalizeClaimPath(path, path)
    .split('.')
    .map((item) => item.trim())
    .filter(Boolean);

  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function readStringClaim(source: Record<string, unknown>, path: string | null | undefined): string | null {
  const value = readNestedClaim(source, normalizeClaimPath(path, ''));
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function readStringArrayClaim(source: Record<string, unknown>, path: string | null | undefined): string[] {
  const value = readNestedClaim(source, normalizeClaimPath(path, 'roles'));
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeHostedDomain(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized || null;
}

export function normalizeAuthProtocol(value: string | null | undefined): AuthProtocol {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'oidc' || normalized === 'oauth' || normalized === 'oauth2') {
    return 'oidc';
  }
  if (normalized === 'saml') {
    return 'saml';
  }
  if (normalized === 'cloudflare-access') {
    return 'cloudflare-access';
  }
  return 'none';
}

export function normalizeNextPath(value: string | null | undefined): string {
  const next = (value ?? '').trim();
  if (!next || !next.startsWith('/')) {
    return '/';
  }
  return next;
}

export function isRunnableOidcConfig(config: OidcConfigRecord | null | undefined): boolean {
  const clientId = config?.clientId?.trim() ?? '';
  const normalizedClientId = clientId.toLowerCase();
  const isPlaceholderClientId =
    !clientId ||
    normalizedClientId === 'google-client-demo' ||
    normalizedClientId === 'client-id-demo' ||
    normalizedClientId === 'demo-client-id';

  return Boolean(
    config &&
      config.authProtocol === 'oidc' &&
      !isPlaceholderClientId &&
      config.metadataUrl?.trim() &&
      config.callbackUrl?.trim(),
  );
}

export function randomBase64Url(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function createPkceChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest));
}

async function loadDiscoveryDocument(metadataUrl: string): Promise<OidcDiscoveryDocument> {
  const response = await fetch(metadataUrl, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OIDC discovery failed (${response.status}).`);
  }

  const payload = (await response.json()) as Partial<OidcDiscoveryDocument>;
  if (
    !payload.authorization_endpoint ||
    !payload.token_endpoint ||
    !payload.jwks_uri ||
    !payload.issuer
  ) {
    throw new Error('OIDC discovery response is missing required endpoints.');
  }

  return {
    issuer: payload.issuer,
    authorization_endpoint: payload.authorization_endpoint,
    token_endpoint: payload.token_endpoint,
    jwks_uri: payload.jwks_uri,
  };
}

export async function buildOidcAuthorizationUrl(
  config: OidcConfigRecord,
  transaction: OidcAuthTransactionRecord,
): Promise<string> {
  if (!config.metadataUrl?.trim() || !config.clientId?.trim()) {
    throw new Error('OIDC sign-in is not configured for this workspace.');
  }

  const discovery = await loadDiscoveryDocument(config.metadataUrl.trim());
  const challenge = await createPkceChallenge(transaction.codeVerifier);
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set('client_id', config.clientId.trim());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('redirect_uri', transaction.redirectUri);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', transaction.id);
  url.searchParams.set('nonce', transaction.nonce);

  if (config.domainHint?.trim()) {
    url.searchParams.set('domain_hint', config.domainHint.trim());
    url.searchParams.set('hd', config.domainHint.trim());
  }

  return url.toString();
}

function parseJwtHeader(token: string): JwtHeader {
  const [header] = token.split('.', 3);
  if (!header) {
    throw new Error('The identity token was malformed.');
  }

  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(header))) as JwtHeader;
  } catch {
    throw new Error('The identity token header was not valid JSON.');
  }
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.', 3);
  if (!payload) {
    throw new Error('The identity token was malformed.');
  }

  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Record<string, unknown>;
  } catch {
    throw new Error('The identity token payload was not valid JSON.');
  }
}

async function importVerificationKey(jwk: JsonWebKey, algorithm: string): Promise<CryptoKey> {
  if (algorithm === 'RS256') {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify'],
    );
  }

  if (algorithm === 'RS384') {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-384',
      },
      false,
      ['verify'],
    );
  }

  if (algorithm === 'RS512') {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-512',
      },
      false,
      ['verify'],
    );
  }

  throw new Error(`OIDC algorithm ${algorithm} is not supported.`);
}

async function verifyJwtSignature(
  token: string,
  jwksUri: string,
  expectedKid: string | undefined,
  algorithm: string,
): Promise<void> {
  const response = await fetch(jwksUri, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`JWKS lookup failed (${response.status}).`);
  }

  const jwks = (await response.json()) as JwkSet;
  const jwk =
    jwks.keys?.find((item) => {
      const candidateKid = (item as JsonWebKey & { kid?: string }).kid;
      return Boolean(candidateKid && expectedKid && candidateKid === expectedKid);
    }) ??
    jwks.keys?.[0];

  if (!jwk) {
    throw new Error('No matching verification key was available for the identity token.');
  }

  const key = await importVerificationKey(jwk, algorithm);
  const [headerPart, payloadPart, signaturePart] = token.split('.', 3);
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error('The identity token was malformed.');
  }

  const signedData = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signature = fromBase64Url(signaturePart);
  const verified = await crypto.subtle.verify(
    algorithm.startsWith('RS')
      ? {
          name: 'RSASSA-PKCS1-v1_5',
        }
      : {
          name: 'RSASSA-PKCS1-v1_5',
        },
    key,
    signature,
    signedData,
  );

  if (!verified) {
    throw new Error('The identity token signature was not accepted.');
  }
}

function validateJwtTimes(payload: Record<string, unknown>): void {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === 'number' ? payload.exp : Number.NaN;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null;

  if (!Number.isFinite(exp) || exp <= nowSeconds) {
    throw new Error('The identity token has expired.');
  }

  if (typeof nbf === 'number' && nbf > nowSeconds + 60) {
    throw new Error('The identity token is not valid yet.');
  }
}

function validateAudience(payload: Record<string, unknown>, clientId: string): void {
  const aud = payload.aud;
  if (typeof aud === 'string') {
    if (aud !== clientId) {
      throw new Error('The identity token audience did not match this workspace.');
    }
    return;
  }

  if (Array.isArray(aud) && aud.includes(clientId)) {
    return;
  }

  throw new Error('The identity token audience did not match this workspace.');
}

function validateHostedDomain(
  payload: Record<string, unknown>,
  config: OidcConfigRecord,
  resolvedEmail: string | null,
): void {
  const expectedDomain = normalizeHostedDomain(config.domainHint);
  if (!expectedDomain) {
    return;
  }

  const hostedDomainClaim = normalizeHostedDomain(
    typeof payload.hd === 'string' ? payload.hd : null,
  );
  const emailDomain = normalizeHostedDomain(resolvedEmail?.split('@').pop() ?? null);

  if (hostedDomainClaim === expectedDomain || emailDomain === expectedDomain) {
    return;
  }

  throw new Error(`This workspace only accepts ${expectedDomain} Google Workspace identities.`);
}

export async function completeOidcCodeExchange(
  config: OidcConfigRecord,
  transaction: OidcAuthTransactionRecord,
  code: string,
): Promise<OidcIdentityClaims> {
  if (!config.metadataUrl?.trim() || !config.clientId?.trim()) {
    throw new Error('OIDC sign-in is not configured for this workspace.');
  }

  const discovery = await loadDiscoveryDocument(config.metadataUrl.trim());
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId.trim(),
      redirect_uri: transaction.redirectUri,
      code_verifier: transaction.codeVerifier,
    }),
  });

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as
    | {
        id_token?: string;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!tokenResponse.ok || !tokenPayload?.id_token) {
    throw new Error(tokenPayload?.error_description || 'The OIDC provider did not return an identity token.');
  }

  const header = parseJwtHeader(tokenPayload.id_token);
  const payload = parseJwtPayload(tokenPayload.id_token);
  const algorithm = header.alg?.trim() || '';
  if (!algorithm.startsWith('RS')) {
    throw new Error(`Unsupported OIDC signing algorithm ${algorithm || 'unknown'}.`);
  }

  await verifyJwtSignature(tokenPayload.id_token, discovery.jwks_uri, header.kid, algorithm);
  validateJwtTimes(payload);
  validateAudience(payload, config.clientId.trim());

  const issuer = typeof payload.iss === 'string' ? payload.iss.trim() : '';
  if (!issuer || issuer !== discovery.issuer) {
    throw new Error('The identity token issuer did not match the configured provider.');
  }

  const nonce = typeof payload.nonce === 'string' ? payload.nonce.trim() : '';
  if (!nonce || nonce !== transaction.nonce) {
    throw new Error('The identity token nonce did not match the initiated sign-in request.');
  }

  const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!subject) {
    throw new Error('The identity token did not contain a stable subject identifier.');
  }

  const email =
    readStringClaim(payload, config.emailClaim) ??
    readStringClaim(payload, 'email') ??
    readStringClaim(payload, config.usernameClaim) ??
    readStringClaim(payload, 'preferred_username');
  validateHostedDomain(payload, config, email);
  const givenName =
    readStringClaim(payload, config.givenNameClaim) ?? readStringClaim(payload, 'given_name');
  const familyName =
    readStringClaim(payload, config.familyNameClaim) ?? readStringClaim(payload, 'family_name');
  const preferredUsername =
    readStringClaim(payload, config.usernameClaim) ?? readStringClaim(payload, 'preferred_username');
  const displayName = readStringClaim(payload, 'name');
  const roleNames = readStringArrayClaim(payload, config.rolesClaim);

  return {
    issuer,
    subject,
    email,
    preferredUsername,
    givenName,
    familyName,
    displayName,
    roleNames,
    rawClaims: payload,
  };
}

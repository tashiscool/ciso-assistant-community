import type { EnvBindings } from '../types/env';

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

function getTenantConfigSecret(env: EnvBindings): string {
  const configuredSecret = env.BOOTSTRAP_SETUP_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }
  if (env.APP_ENV !== 'production') {
    return 'regovise-local-tenant-config-secret';
  }
  throw new Error('Tenant configuration encryption is unavailable in this runtime.');
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptTenantConfigSecret(env: EnvBindings, plaintext: string): Promise<string> {
  const key = await deriveAesKey(getTenantConfigSecret(env));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptTenantConfigSecret(
  env: EnvBindings,
  serialized: string | null | undefined,
): Promise<string | null> {
  const normalized = serialized?.trim();
  if (!normalized) {
    return null;
  }

  const [version, ivPart, cipherPart] = normalized.split('.', 3);
  if (version !== 'v1' || !ivPart || !cipherPart) {
    throw new Error('Stored tenant configuration secret is malformed.');
  }

  const key = await deriveAesKey(getTenantConfigSecret(env));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(cipherPart),
  );

  return new TextDecoder().decode(decrypted);
}

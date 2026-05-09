import { useCallback, useEffect, useState } from 'react';

const TENANT_STORAGE_KEY = 'ciso-assistant.edge.tenant-id';
const USER_STORAGE_KEY = 'ciso-assistant.edge.user-id';
const AUTH_MODE_STORAGE_KEY = 'ciso-assistant.edge.auth-mode';
const IDENTITY_EVENT = 'ciso-assistant-edge-identity-change';
const LOOPBACK_AUTO_SESSION_SUPPRESS_KEY = 'ciso-assistant.edge.loopback-auto-session-suppressed';
const AUTH_ENTRY_PATHS = new Set(['/login', '/auth/callback', '/setup/initialize', '/admin/recover']);

function normalizePathname(pathname: string | null | undefined): string {
  const value = (pathname ?? '').trim();
  if (!value) {
    return '/';
  }

  if (value === '/') {
    return '/';
  }

  const normalized = value.replace(/\/+$/g, '');
  return normalized || '/';
}

export type EdgeIdentity = {
  tenantId: string;
  userId: string;
};

export type EdgeAuthMode = 'headers' | 'session' | 'anonymous';

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.endsWith('.localhost')
  );
}

export function canUseHeaderIdentity(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return isLoopbackHost(window.location.hostname);
}

export function isAuthEntryPath(pathname: string | null | undefined): boolean {
  return AUTH_ENTRY_PATHS.has(normalizePathname(pathname));
}

export function isLogoutPath(pathname: string | null | undefined): boolean {
  return normalizePathname(pathname) === '/logout';
}

export function clearLoopbackAutoSessionSuppression() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(LOOPBACK_AUTO_SESSION_SUPPRESS_KEY);
}

export function suppressLoopbackAutoSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(LOOPBACK_AUTO_SESSION_SUPPRESS_KEY, '1');
}

export function isLoopbackAutoSessionSuppressed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.sessionStorage.getItem(LOOPBACK_AUTO_SESSION_SUPPRESS_KEY) === '1';
}

function getDefaultAuthMode(): EdgeAuthMode {
  return canUseHeaderIdentity() ? 'headers' : 'anonymous';
}

function getDefaultIdentity(): EdgeIdentity {
  return {
    tenantId: import.meta.env.VITE_DEFAULT_TENANT_ID ?? 'tenant-demo',
    userId: import.meta.env.VITE_DEFAULT_USER_ID ?? 'user-demo',
  };
}

function readStorageValue(key: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  return window.localStorage.getItem(key) ?? fallback;
}

function readAuthModeValue(): EdgeAuthMode {
  if (typeof window === 'undefined') {
    return getDefaultAuthMode();
  }

  const stored = window.localStorage.getItem(AUTH_MODE_STORAGE_KEY);
  if (stored === 'session' || stored === 'anonymous') {
    return stored;
  }

  if (stored === 'headers') {
    return canUseHeaderIdentity() ? 'headers' : 'anonymous';
  }

  return getDefaultAuthMode();
}

export function getEdgeIdentity(): EdgeIdentity {
  const defaults = getDefaultIdentity();
  return {
    tenantId: readStorageValue(TENANT_STORAGE_KEY, defaults.tenantId),
    userId: readStorageValue(USER_STORAGE_KEY, defaults.userId),
  };
}

export function getEdgeAuthMode(): EdgeAuthMode {
  return readAuthModeValue();
}

export function setEdgeAuthMode(mode: EdgeAuthMode): EdgeAuthMode {
  if (typeof window === 'undefined') {
    return mode;
  }

  window.localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
  if (mode === 'anonymous') {
    suppressLoopbackAutoSession();
  } else {
    clearLoopbackAutoSessionSuppression();
  }
  window.dispatchEvent(new CustomEvent(IDENTITY_EVENT));
  return mode;
}

export function setEdgeIdentity(next: Partial<EdgeIdentity>): EdgeIdentity {
  const current = getEdgeIdentity();
  const updated: EdgeIdentity = {
    tenantId: next.tenantId?.trim() || current.tenantId,
    userId: next.userId?.trim() || current.userId,
  };

  window.localStorage.setItem(TENANT_STORAGE_KEY, updated.tenantId);
  window.localStorage.setItem(USER_STORAGE_KEY, updated.userId);
  if (readAuthModeValue() === 'anonymous' && canUseHeaderIdentity()) {
    window.localStorage.setItem(AUTH_MODE_STORAGE_KEY, 'headers');
  }
  clearLoopbackAutoSessionSuppression();
  window.dispatchEvent(new CustomEvent(IDENTITY_EVENT));

  return updated;
}

export function resetEdgeIdentity(
  mode: EdgeAuthMode = getDefaultAuthMode(),
): EdgeIdentity {
  const defaults = getDefaultIdentity();

  window.localStorage.setItem(TENANT_STORAGE_KEY, defaults.tenantId);
  window.localStorage.setItem(USER_STORAGE_KEY, defaults.userId);
  window.localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
  if (mode === 'anonymous') {
    suppressLoopbackAutoSession();
  } else {
    clearLoopbackAutoSessionSuppression();
  }
  window.dispatchEvent(new CustomEvent(IDENTITY_EVENT));

  return defaults;
}

export function useEdgeAuthMode() {
  const [authMode, setAuthMode] = useState<EdgeAuthMode>(() => getEdgeAuthMode());

  useEffect(() => {
    const syncAuthMode = () => setAuthMode(getEdgeAuthMode());

    window.addEventListener('storage', syncAuthMode);
    window.addEventListener(IDENTITY_EVENT, syncAuthMode as EventListener);

    return () => {
      window.removeEventListener('storage', syncAuthMode);
      window.removeEventListener(IDENTITY_EVENT, syncAuthMode as EventListener);
    };
  }, []);

  return {
    authMode,
    setAuthMode: (mode: EdgeAuthMode) => {
      const updated = setEdgeAuthMode(mode);
      setAuthMode(updated);
    },
  };
}

export function useEdgeIdentity() {
  const [identity, setIdentity] = useState<EdgeIdentity>(() => getEdgeIdentity());
  const [authMode, setAuthMode] = useState<EdgeAuthMode>(() => getEdgeAuthMode());

  useEffect(() => {
    const syncIdentity = () => {
      setIdentity(getEdgeIdentity());
      setAuthMode(getEdgeAuthMode());
    };

    window.addEventListener('storage', syncIdentity);
    window.addEventListener(IDENTITY_EVENT, syncIdentity as EventListener);

    return () => {
      window.removeEventListener('storage', syncIdentity);
      window.removeEventListener(IDENTITY_EVENT, syncIdentity as EventListener);
    };
  }, []);

  const applyIdentity = useCallback((next: Partial<EdgeIdentity>) => {
    const updated = setEdgeIdentity(next);
    setIdentity(updated);
    setAuthMode(getEdgeAuthMode());
  }, []);

  const applyAuthMode = useCallback((mode: EdgeAuthMode) => {
    const updated = setEdgeAuthMode(mode);
    setAuthMode(updated);
  }, []);

  return {
    identity,
    authMode,
    setIdentity: applyIdentity,
    setAuthMode: applyAuthMode,
  };
}

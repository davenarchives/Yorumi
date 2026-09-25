import { getRuntimePlatform } from '../platform/runtime';

const explicitApiBase = String(import.meta.env.VITE_API_URL || '').trim();
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const runtimePlatform = getRuntimePlatform();

const getResolvedApiBase = () => {
  if (!explicitApiBase) {
    if (runtimePlatform === 'electron' || isLocalHost) {
      return 'http://localhost:3001/api';
    }

    // Android/iOS will ultimately use direct in-app source adapters. Until a
    // source is migrated, an explicitly configured API remains available for
    // development without changing the Electron backend contract.
    return `${origin}/api`;
  }

  try {
    const explicitUrl = new URL(explicitApiBase, origin);
    return explicitUrl.toString().replace(/\/+$/, '');
  } catch {
    if (explicitApiBase.startsWith('/')) {
      return `${origin}${explicitApiBase}`.replace(/\/+$/, '');
    }
  }

  return explicitApiBase.replace(/\/+$/, '');
};

export const API_BASE = getResolvedApiBase();
export const API_ORIGIN = API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');
export const USES_LOCAL_SOURCES = runtimePlatform === 'android' || runtimePlatform === 'ios';

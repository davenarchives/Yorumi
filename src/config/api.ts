const explicitApiBase = String(import.meta.env.VITE_API_URL || '').trim();
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';

const getResolvedApiBase = () => {
  if (!explicitApiBase) {
    return isLocalHost || isElectron ? 'http://localhost:3001/api' : `${origin}/api`;
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

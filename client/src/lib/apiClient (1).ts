// Attaches the signed-in user's token to every same-origin /api request and
// sends the user back to the login page when the server rejects the session.

const TOKEN_KEYS = ['smarthospital_token', 'medisaas_token'];
const SESSION_KEYS = [...TOKEN_KEYS, 'smarthospital_user', 'medisaas_user', 'smarthospital_subscription'];

// Endpoints whose 401 responses are expected (wrong password etc.) and must not end the session
const PUBLIC_PREFIXES = ['/api/auth/login', '/api/auth/recover-credentials', '/api/public/'];

const getToken = () => {
  try {
    for (const key of TOKEN_KEYS) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
  } catch {
    // storage unavailable (private mode) — continue unauthenticated
  }
  return null;
};

const resolvePath = (input: RequestInfo | URL): string | null => {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
};

let redirecting = false;

export function installApiClient() {
  if (typeof window === 'undefined' || (window as any).__apiClientInstalled) return;
  (window as any).__apiClientInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = resolvePath(input);
    if (!path || !path.startsWith('/api/')) return nativeFetch(input, init);

    const token = getToken();
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    const response = await nativeFetch(input, { ...init, headers });

    const isPublic = PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
    if (response.status === 401 && token && !isPublic && !redirecting) {
      redirecting = true;
      try {
        SESSION_KEYS.forEach(key => localStorage.removeItem(key));
      } catch {
        // ignore
      }
      window.location.assign('/login?session=expired');
    }

    return response;
  };
}

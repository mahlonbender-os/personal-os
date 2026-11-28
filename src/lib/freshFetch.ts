/** Browser fetch that skips the HTTP cache. Pass fresh to bypass the server sheet cache too. */

type FreshInit = RequestInit & { fresh?: boolean };

export function freshFetch(input: string, init?: FreshInit): Promise<Response> {
  const { fresh, headers, ...rest } = init || {};
  const url = new URL(input, window.location.origin);
  url.searchParams.set('_', String(Date.now()));
  if (fresh) url.searchParams.set('fresh', '1');
  const nextHeaders = new Headers(headers);
  nextHeaders.set('Cache-Control', 'no-cache');
  nextHeaders.set('Pragma', 'no-cache');
  return fetch(url.toString(), { ...rest, cache: 'no-store', headers: nextHeaders });
}

export function clearStorageKeys(keys: string[]) {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Private mode can throw. Refresh still hits the network.
  }
}

export function clearStoragePrefix(prefix: string) {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    });
  } catch {
    // Ignore a blocked cache.
  }
}

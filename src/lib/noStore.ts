/** Response headers that keep finance JSON off the browser cache and the Vercel CDN. */
export const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache',
  Expires: '0',
};

export function freshRequested(request: Request): boolean {
  try {
    return new URL(request.url).searchParams.get('fresh') === '1';
  } catch {
    return false;
  }
}

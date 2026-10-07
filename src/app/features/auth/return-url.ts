/**
 * `returnUrl` comes from the query string, so an attacker can plant it in a sign-in link.
 * Only paths inside the app are allowed (not `//evil.com` or `https://...`).
 */
export function safeReturnUrl(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
}

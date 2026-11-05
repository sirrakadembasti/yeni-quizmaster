import { describe, it, expect } from 'vitest';
import { httpSecurity } from '../../utils/http-security';

describe('HTTP school LAN and HTTPS security headers', () => {
  for (const secure of [false, true]) it(`keeps resource URLs compatible with ${secure ? 'HTTPS' : 'HTTP'}`, () => {
    const headers = new Map<string, string>();
    let continued = false;
    httpSecurity(secure)({} as any, { setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value), removeHeader: () => {} } as any, () => { continued = true; });
    expect(continued).toBe(true);
    const csp = headers.get('content-security-policy')!;
    expect(csp.includes('upgrade-insecure-requests')).toBe(secure);
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });
});

import { describe, it, expect } from 'vitest';
import { getSelfRegistrationWarnings } from '../../utils/registration';

const publicConfig = { publicUrl: 'https://sinav.okul.k12.tr', trustProxyHops: 1 };

describe('açık kayıt uyarıları', () => {
  it('kayıt kapalıysa uyarı yoktur', () => {
    expect(getSelfRegistrationWarnings({ ALLOW_SELF_REGISTRATION: 'false' }, publicConfig)).toEqual([]);
  });

  it('localhost kurulumunda uyarı yoktur', () => {
    expect(getSelfRegistrationWarnings({}, { publicUrl: 'http://localhost:5173', trustProxyHops: 0 })).toEqual([]);
    expect(getSelfRegistrationWarnings({}, { publicUrl: 'http://127.0.0.1:5173', trustProxyHops: 0 })).toEqual([]);
  });

  it('herkese açık adreste açık kayıt uyarısı verir', () => {
    const warnings = getSelfRegistrationWarnings({}, publicConfig);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ALLOW_SELF_REGISTRATION=false');
  });

  it('herkese açık adreste güvenilir proxy 0 ise IP sınırı uyarısı da verir', () => {
    const warnings = getSelfRegistrationWarnings({}, { ...publicConfig, trustProxyHops: 0 });
    expect(warnings).toHaveLength(2);
    expect(warnings[1]).toContain('TRUST_PROXY_HOPS');
  });
});

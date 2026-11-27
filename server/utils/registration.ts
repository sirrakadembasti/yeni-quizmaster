// Açık (kendi kendine) kayıt varsayılan olarak açıktır; yalnız ALLOW_SELF_REGISTRATION=false ile kapanır.
export function isSelfRegistrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.ALLOW_SELF_REGISTRATION ?? '').trim().toLowerCase() !== 'false';
}

// Herkese açık adreste açık kayıt ve IP sınırının doğru çalışması için yöneticiye gösterilecek uyarılar.
export function getSelfRegistrationWarnings(
  env: NodeJS.ProcessEnv,
  config: { publicUrl: string; trustProxyHops: number },
): string[] {
  if (!isSelfRegistrationEnabled(env)) return [];
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(config.publicUrl.trim());
  if (isLocal) return [];

  const warnings = [
    'Öğrenci kendi kendine kaydı açık ve uygulama herkese açık bir adreste. Okul ağı dışından erişilebiliyorsa server/.env içine ALLOW_SELF_REGISTRATION=false yazıp sunucuyu yeniden başlatın.',
  ];
  if (config.trustProxyHops === 0) {
    warnings.push(
      'Güvenilir proxy sayısı (TRUST_PROXY_HOPS) 0. Uygulama bir ters proxy arkasındaysa kayıt IP sınırı tüm kullanıcıları tek IP sayar; proxy yoksa sorun yoktur.',
    );
  }
  return warnings;
}

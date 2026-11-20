// Açık (kendi kendine) kayıt varsayılan olarak açıktır; yalnız ALLOW_SELF_REGISTRATION=false ile kapanır.
export function isSelfRegistrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.ALLOW_SELF_REGISTRATION ?? '').trim().toLowerCase() !== 'false';
}

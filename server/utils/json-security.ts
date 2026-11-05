const SENSITIVE_JSON_FIELDS = new Set([
  "password",
  "resetToken",
  "resetTokenExpiry",
  "emailVerificationToken",
  "sessionVersion",
]);

/**
 * Express calls this replacer for every nested JSON response value. Keeping the
 * deny-list here prevents relation includes from exposing authentication data
 * while preserving the application's existing response shapes.
 */
export function secureJsonReplacer(key: string, value: unknown): unknown {
  if (SENSITIVE_JSON_FIELDS.has(key)) {
    return undefined;
  }

  return value;
}

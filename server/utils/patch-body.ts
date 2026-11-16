/**
 * PATCH gövdelerinde yalnızca istemcinin gerçekten gönderdiği alanları korur.
 *
 * Zod 4, `.partial()` ile isteğe bağlı yapılan alanlarda da `.default()` değerlerini uygular
 * (Zod 3'te uygulamazdı). Doğrulanmış veriyi olduğu gibi güncellemeye verirsek, gönderilmeyen
 * alanlar (status, difficulty, assignedClassIds, contentType...) sessizce varsayılana sıfırlanır.
 */
export function onlySentKeys<T extends Record<string, unknown>>(data: T, body: unknown): Partial<T> {
  if (!body || typeof body !== "object") return {};
  const sent = body as Record<string, unknown>;
  const result: Partial<T> = {};
  for (const key of Object.keys(data) as Array<keyof T & string>) {
    if (Object.prototype.hasOwnProperty.call(sent, key)) result[key] = data[key];
  }
  return result;
}

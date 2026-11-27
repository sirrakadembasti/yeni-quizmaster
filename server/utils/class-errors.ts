import type { Response } from 'express';

// Depo iki biçimde hata fırlatır: `new Error('KOD')` ve `Object.assign(new Error(açıklama), { code: 'KOD' })`.
// İkisi de aynı kodla okunur.
function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : error.message;
}

export function respondToClassError(error: unknown, res: Response): boolean {
  const code = errorCode(error);
  const messages: Record<string, string> = {
    CLASS_CAPACITY_EXCEEDED: 'Sınıf kapasitesi dolu. Kapasiteyi artırın veya başka bir sınıf seçin.',
    INVALID_CLASS_CAPACITY: 'Sınıf kapasitesi pozitif bir tam sayı olmalıdır.',
    INVALID_STUDENT: 'Geçerli bir öğrenci seçin.',
    INVALID_CLASS_TEACHER: 'Aktif bir öğretmen seçin.',
    CLASS_NOT_FOUND: 'Sınıf bulunamadı.',
    CLASS_EXISTS: 'Bu isimde bir sınıf zaten mevcut.',
  };
  if (code === 'CLASS_NOT_EMPTY') {
    // Depo, neyin boşaltılması gerektiğini anlatan kendi iletisini taşır.
    res.status(409).json({ message: (error as Error).message });
    return true;
  }
  if (!messages[code]) return false;
  res.status(code === 'CLASS_NOT_FOUND' ? 404 : 400).json({ message: messages[code] });
  return true;
}

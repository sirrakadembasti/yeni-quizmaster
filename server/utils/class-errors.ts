import type { Response } from 'express';

export function respondToClassError(error: unknown, res: Response): boolean {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    CLASS_CAPACITY_EXCEEDED: 'Sınıf kapasitesi dolu. Kapasiteyi artırın veya başka bir sınıf seçin.',
    INVALID_CLASS_CAPACITY: 'Sınıf kapasitesi pozitif bir tam sayı olmalıdır.',
    INVALID_STUDENT: 'Geçerli bir öğrenci seçin.',
    INVALID_CLASS_TEACHER: 'Aktif bir öğretmen seçin.',
    CLASS_NOT_FOUND: 'Sınıf bulunamadı.',
  };
  if (!messages[code]) return false;
  res.status(code === 'CLASS_NOT_FOUND' ? 404 : 400).json({ message: messages[code] });
  return true;
}

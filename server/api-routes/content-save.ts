import { z } from 'zod';
import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { storage } from '../storage';
import { canAssignClasses } from '../utils/class-authorization';
import { questionImageUrlSchema } from '../utils/upload-paths';
import { getIO } from '../socket';
import { logger } from '../utils/logger';
import { shouldNotifyAdminAboutQuiz } from '../utils/notification-policy';
import { hasInvalidQuestions } from '../utils/question-validation';

const schema = z.object({
  title: z.string().trim().min(3).max(100), description: z.string().max(500).nullable().default(null),
  categoryId: z.string().uuid().nullable().optional(), category: z.string().nullable().optional(),
  difficulty: z.enum(['easy','medium','hard']).default('medium'),
  timeLimit: z.number().int().positive().nullable().default(null), shuffleQuestions: z.boolean().default(false),
  status: z.enum(['draft','published','archived']).default('draft'), assignedClassIds: z.array(z.string().uuid()).default([]),
  questions: z.array(z.object({ id: z.string().min(1).max(100).optional(), text: z.string().trim().min(1),
    type: z.string().default('multiple-choice'), options: z.array(z.string()).default([]),
    correctAnswer: z.string().nullable().optional(), config: z.record(z.any()).nullable().optional(),
    imageUrl: questionImageUrlSchema.nullable().optional(), order: z.number().int().default(0),
  })),
});

async function notify(actor: NonNullable<AuthRequest['user']>, quiz: any, created: boolean, published: boolean) {
  // Notifications and audit logs occur after commit; failure must not make the
  // editor retry a save that has already succeeded.
  try {
    await storage.createLog(actor.id, created ? 'CREATE_QUIZ' : 'UPDATE_QUIZ', `Saved content: ${quiz.title}`);
    const label = quiz.contentType === 'survey' ? 'Anket' : 'Sınav';
    const deliver = async (userId: string, title: string, message: string, type: string) => {
      const notification = await storage.createNotification({ userId, title, message, type });
      try { getIO().to(`user_${userId}`).emit('notification', notification); }
      catch (error) { logger.warn({ err: error }, 'Saved notification could not be delivered live'); }
    };
    if (actor.role === 'teacher' && (created || published)) {
      const admins = (await storage.getAllUsers()).filter(user => shouldNotifyAdminAboutQuiz(actor.role, user.role));
      for (const admin of admins) await deliver(admin.id, `Öğretmen ${label} ${published ? 'Yayınladı' : 'Oluşturdu'}`, `${actor.name}, "${quiz.title}" adlı içeriği ${published ? 'yayınladı' : 'oluşturdu'}.`, 'quiz');
    }
    if (published) {
      const studentIds = new Set<string>();
      for (const classroom of quiz.assignedClasses || []) {
        for (const student of await storage.getStudentsByClass(classroom.id)) studentIds.add(student.id);
      }
      for (const id of studentIds) await deliver(id, `Yeni ${label}`, `"${quiz.title}" yayımlandı.`, 'info');
    }
  } catch (error) { logger.error({ err: error }, 'Content saved but post-save notification/log failed'); }
}

export function saveContentHandler(contentType: 'exam' | 'survey') {
  return async (req: AuthRequest, res: Response) => {
    try {
      if (!z.string().uuid().safeParse(req.params.id).success && !await storage.getQuiz(req.params.id)) return res.status(400).json({ message: 'Geçersiz içerik kimliği.' });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'İçerik bilgileri veya sorular geçersiz.' });
      const { questions, category, ...settings } = parsed.data;
      const invalid = hasInvalidQuestions(contentType, questions);
      if (invalid || (settings.status === 'published' && !questions.length)) return res.status(400).json({ message: 'Yayınlamak için geçerli sorular gereklidir.' });
      if (!await canAssignClasses(req.user!.role, req.user!.id, settings.assignedClassIds)) return res.status(403).json({ message: 'Yalnızca yetkili olduğunuz sınıflara atama yapabilirsiniz.' });
      let categoryId = settings.categoryId;
      if (!categoryId && category) categoryId = (await storage.getAllCategories()).find(c => c.name.toLowerCase() === category.toLowerCase())?.id || null;
      const saved = await storage.saveContent(req.params.id, { ...settings, categoryId: categoryId || null, contentType,
        timeLimit: contentType === 'survey' ? null : settings.timeLimit, shuffleQuestions: contentType === 'survey' ? false : settings.shuffleQuestions, createdBy: req.user!.id },
        questions.map(q => ({ ...q, quizId: req.params.id, correctAnswer: contentType === 'survey' ? null : q.correctAnswer })), req.user!);
      await notify(req.user!, saved.quiz, saved.created, saved.published);
      return res.json({ [contentType === 'survey' ? 'survey' : 'quiz']: saved.quiz, questions: saved.questions });
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'CONTENT_FORBIDDEN') return res.status(403).json({ message: 'Bu içeriği düzenleme yetkiniz yok.' });
      if (message === 'CONTENT_TYPE_MISMATCH') return res.status(404).json({ message: 'İçerik bulunamadı.' });
      if (message === 'INVALID_QUESTION_ID' || message === 'CONTENT_EMPTY') return res.status(400).json({ message: 'Geçersiz soru kimliği veya boş içerik.' });
      if (message === 'CONTENT_HAS_RESPONSES') return res.status(409).json({ message: 'Katılım başladıktan sonra sorular değiştirilemez. Yeni bir sınav/anket oluşturun.' });
      logger.error({ err: error }, 'Atomic content save failed');
      return res.status(500).json({ message: 'İçerik kaydedilemedi.' });
    }
  };
}

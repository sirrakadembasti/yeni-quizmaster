import { Prisma, PrismaClient, type AcademicYear } from '@prisma/client';

/** July 15 00:05 interpreted with Europe/Istanbul timezone rules. */
export function getYearSchedule(label: string): Date {
  const match = /^(\d{4})-(\d{4})$/.exec(label);
  if (!match || Number(match[1]) < 2000 || Number(match[2]) > 2100 || Number(match[2]) !== Number(match[1]) + 1) {
    throw new Error('Academic year must be consecutive YYYY-YYYY years within 2000..2100');
  }
  const nominal = Date.UTC(Number(match[2]), 6, 15, 0, 5);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(nominal));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)!.value);
  const localAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return new Date(nominal - (localAsUtc - nominal));
}

/** Initialize only the installed period; overdue persisted years belong to the worker. */
export async function getOrCreateActiveYear(db: PrismaClient, now: Date = new Date()): Promise<AcademicYear> {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid academic year initialization time');
  const existing = await db.academicYear.findFirst({ where: { status: 'active' } });
  if (existing) return existing;

  const localYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(now));
  const previousLabel = `${String(localYear - 1).padStart(4, '0')}-${String(localYear).padStart(4, '0')}`;
  const startYear = now < getYearSchedule(previousLabel) ? localYear - 1 : localYear;
  const label = `${String(startYear).padStart(4, '0')}-${String(startYear + 1).padStart(4, '0')}`;
  try {
    return await db.academicYear.create({ data: { label, status: 'active', opensAt: now, scheduledCloseAt: getYearSchedule(label) } });
  } catch (error) {
    // Both the label and singleton partial index protect concurrent first requests.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await db.academicYear.findFirst({ where: { status: 'active' } });
      if (winner) return winner;
    }
    throw error;
  }
}

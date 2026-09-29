export type UserRole = "admin" | "teacher" | "student" | string;

export function shouldNotifyAdminAboutQuiz(actorRole: UserRole, recipientRole: UserRole) {
  return actorRole === "teacher" && recipientRole === "admin";
}

export function shouldNotifyQuizOwnerOfSubmission(ownerRole: UserRole) {
  return ownerRole === "teacher";
}

export function isValidTeacherAnnouncementTarget(
  targetRole?: string | null,
  targetClassId?: string | null
) {
  return targetRole === "student" && Boolean(targetClassId);
}

export function matchesAnnouncementRecipient(input: {
  recipientId: string;
  recipientRole: UserRole;
  recipientClassId?: string | null;
  creatorId: string;
  targetRole?: string | null;
  targetClassId?: string | null;
}) {
  if (input.recipientId === input.creatorId) return false;
  if (input.targetClassId && input.recipientClassId !== input.targetClassId) return false;
  return !input.targetRole || input.targetRole === "all" || input.recipientRole === input.targetRole;
}

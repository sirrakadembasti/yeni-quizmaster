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

type AnnouncementAudience = {
  recipientId: string;
  recipientRole: UserRole;
  recipientClassId?: string | null;
  recipientLinkedStudentClassIds?: readonly string[];
  recipientActive?: boolean;
  creatorId: string;
  targetRole?: string | null;
  targetClassId?: string | null;
};

export function matchesAnnouncementAudience(input: AnnouncementAudience) {
  if (input.recipientRole === "parent" && input.recipientActive === false) return false;
  if (input.targetClassId) {
    const matchesClass = input.recipientRole === "parent"
      ? (input.recipientLinkedStudentClassIds || []).includes(input.targetClassId)
      : input.recipientClassId === input.targetClassId;
    if (!matchesClass) return false;
  }
  return !input.targetRole || input.targetRole === "all" || input.recipientRole === input.targetRole;
}

export function matchesAnnouncementRecipient(input: AnnouncementAudience) {
  return input.recipientId !== input.creatorId && matchesAnnouncementAudience(input);
}

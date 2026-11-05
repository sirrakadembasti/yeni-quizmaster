import { describe, expect, it } from "vitest";
import {
  matchesAnnouncementRecipient,
  matchesAnnouncementAudience,
  isValidTeacherAnnouncementTarget,
  shouldNotifyAdminAboutQuiz,
  shouldNotifyQuizOwnerOfSubmission,
} from "../../utils/notification-policy";

describe("notification policy", () => {
  it("notifies admins only for teacher quiz actions", () => {
    expect(shouldNotifyAdminAboutQuiz("teacher", "admin")).toBe(true);
    expect(shouldNotifyAdminAboutQuiz("student", "admin")).toBe(false);
    expect(shouldNotifyAdminAboutQuiz("admin", "admin")).toBe(false);
  });

  it("sends quiz submissions only to the teacher owner", () => {
    expect(shouldNotifyQuizOwnerOfSubmission("teacher")).toBe(true);
    expect(shouldNotifyQuizOwnerOfSubmission("admin")).toBe(false);
    expect(shouldNotifyQuizOwnerOfSubmission("student")).toBe(false);
  });

  it("matches announcement role and class without notifying the creator", () => {
    const base = {
      recipientId: "student-1",
      recipientRole: "student",
      recipientClassId: "class-a",
      creatorId: "teacher-1",
      targetRole: "student",
      targetClassId: "class-a",
    };
    expect(matchesAnnouncementRecipient(base)).toBe(true);
    expect(matchesAnnouncementRecipient({ ...base, recipientClassId: "class-b" })).toBe(false);
    expect(matchesAnnouncementRecipient({ ...base, recipientId: "teacher-1" })).toBe(false);
  });

  it("allows teachers to target only students in a selected class", () => {
    expect(isValidTeacherAnnouncementTarget("student", "class-a")).toBe(true);
    expect(isValidTeacherAnnouncementTarget("teacher", "class-a")).toBe(false);
    expect(isValidTeacherAnnouncementTarget("all", "class-a")).toBe(false);
    expect(isValidTeacherAnnouncementTarget("student", null)).toBe(false);
  });

  it("targets a parent through children's classes rather than the parent's own class", () => {
    const parent = { recipientId: "parent-1", recipientRole: "parent", recipientClassId: null,
      recipientLinkedStudentClassIds: ["class-a", "class-b", "class-a"], creatorId: "admin-1",
      targetRole: "parent", targetClassId: "class-a" };
    expect(matchesAnnouncementRecipient(parent)).toBe(true);
    expect(matchesAnnouncementRecipient({ ...parent, targetClassId: "class-c" })).toBe(false);
    expect(matchesAnnouncementRecipient({ ...parent, recipientLinkedStudentClassIds: [], recipientClassId: "class-a" })).toBe(false);
    expect(matchesAnnouncementRecipient({ ...parent, recipientId: "admin-1" })).toBe(false);
    expect(matchesAnnouncementAudience({ ...parent, recipientId: "admin-1" })).toBe(true);
    expect(matchesAnnouncementRecipient({ ...parent, recipientActive: false })).toBe(false);
    expect(matchesAnnouncementRecipient({ ...parent, targetRole: "student" })).toBe(false);
    expect(matchesAnnouncementRecipient({ ...parent, targetRole: "all" })).toBe(true);
  });
});

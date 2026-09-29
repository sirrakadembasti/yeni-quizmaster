import { describe, expect, it } from "vitest";
import {
  matchesAnnouncementRecipient,
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
});

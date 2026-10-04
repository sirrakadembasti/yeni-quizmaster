import { describe, expect, it } from "vitest";
import { isQuizVisibleToStudent } from "../../utils/quiz-scope-policy";

describe("student and guardian quiz scope", () => {
  const quiz = { status: "published", contentType: "exam", assignedClasses: [{ id: "class-a" }, { id: "class-b" }] };
  it("includes unassigned published exams only for classless students", () => {
    expect(isQuizVisibleToStudent({ ...quiz, assignedClasses: [] }, null)).toBe(true);
    expect(isQuizVisibleToStudent({ ...quiz, assignedClasses: [] }, "class-a")).toBe(false);
    expect(isQuizVisibleToStudent({ status: "published", contentType: "exam" }, undefined)).toBe(true);
  });
  it("matches any assigned class and excludes unrelated and classless students", () => {
    expect(isQuizVisibleToStudent(quiz, "class-a")).toBe(true);
    expect(isQuizVisibleToStudent(quiz, "class-b")).toBe(true);
    expect(isQuizVisibleToStudent(quiz, "class-c")).toBe(false);
    expect(isQuizVisibleToStudent(quiz, null)).toBe(false);
  });
  it("excludes drafts, archived exams, and surveys regardless of assignments", () => {
    expect(isQuizVisibleToStudent({ ...quiz, status: "draft" }, "class-a")).toBe(false);
    expect(isQuizVisibleToStudent({ ...quiz, status: "archived" }, "class-a")).toBe(false);
    expect(isQuizVisibleToStudent({ ...quiz, contentType: "survey" }, "class-a")).toBe(false);
    expect(isQuizVisibleToStudent({ ...quiz, contentType: "survey", assignedClasses: [] }, null)).toBe(false);
  });
  it("excludes material and unknown content types even in the child's assigned class", () => {
    expect(isQuizVisibleToStudent({ ...quiz, contentType: "material" }, "class-a")).toBe(false);
    expect(isQuizVisibleToStudent({ ...quiz, contentType: "quiz" }, "class-a")).toBe(false);
    expect(isQuizVisibleToStudent({ status: "published" }, null)).toBe(false);
  });
});

import { storage } from "../storage";

export async function getAuthorizedClassIds(role: string, userId: string): Promise<Set<string>> {
  if (role === "admin") {
    return new Set((await storage.getAllClasses()).map((classroom) => classroom.id));
  }
  if (role !== "teacher") return new Set();
  return new Set((await storage.getClassesByTeacher(userId)).map((classroom) => classroom.id));
}

export async function canAccessClass(role: string, userId: string, classId: string): Promise<boolean> {
  if (role === "admin") return true;
  return (await getAuthorizedClassIds(role, userId)).has(classId);
}

export async function canAssignClasses(
  role: string,
  userId: string,
  classIds: string[],
): Promise<boolean> {
  if (role === "admin" || classIds.length === 0) return true;

  const manageableIds = await getAuthorizedClassIds(role, userId);
  return classIds.every((classId) => manageableIds.has(classId));
}

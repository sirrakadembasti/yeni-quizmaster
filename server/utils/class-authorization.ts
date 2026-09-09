import { storage } from "../storage";

export async function canAssignClasses(
  role: string,
  userId: string,
  classIds: string[],
): Promise<boolean> {
  if (role === "admin" || classIds.length === 0) return true;

  const manageableClasses = await storage.getClassesByTeacher(userId);
  const manageableIds = new Set(manageableClasses.map((classroom) => classroom.id));
  return classIds.every((classId) => manageableIds.has(classId));
}

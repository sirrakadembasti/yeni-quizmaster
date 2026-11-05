type QuizScope = {
  status: string;
  contentType?: string | null;
  assignedClasses?: { id: string }[] | null;
};

export function isQuizVisibleToStudent(quiz: QuizScope, studentClassId?: string | null) {
  if (quiz.status !== "published" || quiz.contentType !== "exam") return false;
  const assignedClasses = quiz.assignedClasses || [];
  return assignedClasses.length === 0
    ? !studentClassId
    : assignedClasses.some(classroom => classroom.id === studentClassId);
}

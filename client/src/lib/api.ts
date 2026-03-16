const API_BASE = '/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  classId?: string | null;
  createdAt: string;
  classNo?: string | null;
  assignedCategories?: { id: string; name: string }[];
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: string;
  timeLimit?: number;
  shuffleQuestions: boolean;
  createdBy: string;
  status: string;
  createdAt: string;
  questionCount?: number;
  participantCount?: number;
  assignedClasses?: Class[];
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: string;
  options?: string[];
  correctAnswer: string;
  order: number;
  createdAt: string;
}

export interface QuizWithDetails extends Quiz {
  questions?: Question[];
  questionCount?: number;
  participantCount?: number;
}

export interface StudentResultDetail {
  result: {
    id: string;
    status: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeTaken: number;
    submittedAt: string;
  };
  quiz: {
    id: string;
    title: string;
    description?: string;
  };
  questions: Array<{
    id: string;
    text: string;
    type: string;
    options?: string[];
    correctAnswer: string;
    studentAnswer?: string;
    isCorrect: boolean;
  }>;
}

export interface StudentResult {
  id: string;
  studentId: string;
  quizId: string;
  answers: Record<string, string>;
  score: number;
  timeTaken?: number;
  completedAt: string;
  correctAnswersCount?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  quiz?: Quiz;
  quizTitle?: string;
  submittedAt: string;
  student?: User;
}

// Interface definitions for API requests
export interface CreateQuizInput {
  title: string;
  description?: string;
  category: string;
  difficulty?: string;
  timeLimit?: number;
  shuffleQuestions?: boolean;
  status?: 'draft' | 'published' | 'archived';
  assignedClassIds?: string[];
  questions?: Array<{
    text: string;
    type: 'multiple-choice' | 'true-false' | 'short-answer';
    options?: string[];
    correctAnswer: string;
    order?: number;
  }>;
}

export interface UpdateQuizInput extends Partial<CreateQuizInput> {}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  teacherId: string;
  maxStudents?: number;
  createdAt: string;
  assignedCategories?: { id: string; name: string }[];
}

export interface DashboardStats {
  totalQuizzes: number;
  totalStudents: number;
  totalTeachers: number;
  totalResults: number;
  averageStudentScore: number;
}

export interface StudentStats {
  completedQuizzes: number;
  averageScore: number;
  totalStudyTime: number;
  recentResults: StudentResult[];
}

export interface AIQuestion {
  text: string;
  type: 'multiple-choice';
  options: string[];
  correctAnswer: string;
  correctAnswerIndex?: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

// Auth APIs
export const authApi = {
  async register(name: string, email: string, password: string, classNo?: string, classId?: string) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, classNo, classId }),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  async logout() {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async getCurrentUser() {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },
  async updateProfile(name?: string, email?: string) {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },
};

// User Management APIs
export const userApi = {
  async getAllUsers() {
    const response = await fetch(`${API_BASE}/users`, {
      credentials: 'include',
    });
    return handleResponse<{ users: User[] }>(response);
  },

  async updateUserRole(userId: string, role: string) {
    const response = await fetch(`${API_BASE}/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async assignCategoryToTeacher(teacherId: string, categoryId: string) {
    const response = await fetch(`${API_BASE}/users/${teacherId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeCategoryFromTeacher(teacherId: string, categoryId: string) {
    const response = await fetch(`${API_BASE}/users/${teacherId}/categories/${categoryId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },
};

// Quiz APIs
export const quizApi = {
  async getAllQuizzes() {
    const response = await fetch(`${API_BASE}/quizzes`, {
      credentials: 'include',
    });
    return handleResponse<{ quizzes: QuizWithDetails[] }>(response);
  },

  async getQuiz(id: string) {
    const response = await fetch(`${API_BASE}/quizzes/${id}`, {
      credentials: 'include',
    });
    return handleResponse<{ quiz: Quiz; questions: Question[] }>(response);
  },

  async createQuiz(quiz: CreateQuizInput) {
    const response = await fetch(`${API_BASE}/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quiz),
      credentials: 'include',
    });
    return handleResponse<{ quiz: Quiz; questions: Question[] }>(response);
  },

  async updateQuiz(id: string, quiz: UpdateQuizInput) {
    const response = await fetch(`${API_BASE}/quizzes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quiz),
      credentials: 'include',
    });
    return handleResponse<{ quiz: Quiz }>(response);
  },

  async deleteQuiz(id: string) {
    const response = await fetch(`${API_BASE}/quizzes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async addQuestions(quizId: string, questions: Partial<Question>[]) {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questions),
      credentials: 'include',
    });
    return handleResponse<{ questions: Question[] }>(response);
  },

  async getQuestionsByQuiz(quizId: string) {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}`, {
      credentials: 'include',
    });
    const data = await handleResponse<{ quiz: Quiz; questions: Question[] }>(response);
    return data.questions;
  },

  // Student quiz endpoints
  async getStudentQuizzes() {
    const response = await fetch(`${API_BASE}/student/quizzes`, {
      credentials: 'include',
    });
    return handleResponse<{ quizzes: Quiz[] }>(response);
  },

  async startQuiz(quizId: string) {
    const response = await fetch(`${API_BASE}/student/quiz/${quizId}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{
      resultId: string;
      quiz: { id: string; title: string; description?: string; timeLimit?: number; totalQuestions: number };
      questions: Array<{ id: string; text: string; type: string; options?: string[] }>;
      existingAnswers?: Record<string, string>;
    }>(response);
  },

  async submitAnswer(resultId: string, questionId: string, selectedOption: string) {
    const response = await fetch(`${API_BASE}/student/quiz/${resultId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedOption }),
      credentials: 'include',
    });
    return handleResponse<{ message: string; isCorrect: boolean }>(response);
  },

  async submitQuiz(resultId: string) {
    const response = await fetch(`${API_BASE}/student/quiz/${resultId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{
      message: string;
      score: number;
      totalQuestions: number;
      correctAnswers: number;
      timeTaken: number;
    }>(response);
  },
};

// Category APIs
export const categoryApi = {
  async getAllCategories() {
    const response = await fetch(`${API_BASE}/categories`, {
      credentials: 'include',
    });
    return handleResponse<Category[]>(response);
  },

  async createCategory(name: string, description?: string, color?: string) {
    const response = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color }),
      credentials: 'include',
    });
    return handleResponse<Category>(response);
  },

  async deleteCategory(id: string) {
    const response = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },
};

// AI APIs
export const aiApi = {
  async generateQuestions(
    topic: string, 
    count: number = 3, 
    difficulty: string = "medium", 
    model: string = "gemini-1.5-flash",
    customBaseUrl?: string,
    customApiKey?: string
  ) {
    const response = await fetch(`${API_BASE}/ai/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topic, 
        count, 
        difficulty, 
        model,
        customBaseUrl,
        customApiKey
      }),
      credentials: 'include',
    });
    return handleResponse<{ questions: AIQuestion[] }>(response);
  },

  async testAIConfig(config: { baseUrl?: string; apiKey?: string; model?: string }) {
    const response = await fetch(`${API_BASE}/ai/test-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string; details?: string }>(response);
  }
};

// Result APIs
export const resultApi = {
  async getStudentResults(studentId?: string) {
    const url = studentId ? `${API_BASE}/student/results?studentId=${studentId}` : `${API_BASE}/student/results`;
    const response = await fetch(url, {
      credentials: 'include',
    });
    return handleResponse<{ results: StudentResult[] }>(response);
  },

  async getResultDetail(resultId: string) {
    const response = await fetch(`${API_BASE}/student/results/${resultId}`, {
      credentials: 'include',
    });
    return handleResponse<{
      result: { id: string; status: string; score: number; correctAnswers: number; totalQuestions: number; timeTaken: number; submittedAt: string };
      quiz: { id: string; title: string; description?: string };
      questions: Array<{
        id: string;
        text: string;
        type: string;
        options?: string[];
        correctAnswer: string;
        studentAnswer?: string;
        isCorrect: boolean;
      }>;
    }>(response);
  },

  async getQuizResults(quizId: string) {
    const response = await fetch(`${API_BASE}/results/quiz/${quizId}`, {
      credentials: 'include',
    });
    return handleResponse<{ results: StudentResult[] }>(response);
  },
};

// Dashboard APIs
export const dashboardApi = {
  async getAdminStats() {
    const response = await fetch(`${API_BASE}/dashboard/stats`, {
      credentials: 'include',
    });
    return handleResponse<{ stats: DashboardStats }>(response);
  },
  async getTeacherStats() {
    const response = await fetch(`${API_BASE}/teacher/dashboard/stats`, {
      credentials: 'include',
    });
    return handleResponse<{ stats: DashboardStats }>(response);
  },
};

// Class APIs
export const classApi = {
  async getAllClasses() {
    const response = await fetch(`${API_BASE}/classes`, {
      credentials: 'include',
    });
    return handleResponse<{ classes: Class[] }>(response);
  },

  async getTeacherClasses() {
    const response = await fetch(`${API_BASE}/classes`, {
      credentials: 'include',
    });
    return handleResponse<{ classes: Class[] }>(response);
  },

  async getClass(id: string) {
    const response = await fetch(`${API_BASE}/classes/${id}`, {
      credentials: 'include',
    });
    return handleResponse<{ class: Class; students: User[] }>(response);
  },

  async createClass(classData: { name: string; description?: string; teacherId: string; maxStudents?: number }) {
    const response = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData),
      credentials: 'include',
    });
    return handleResponse<Class>(response);
  },

  async assignStudentToClass(classId: string, studentId: string) {
    const response = await fetch(`${API_BASE}/classes/${classId}/students/${studentId}`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeStudentFromClass(classId: string, studentId: string) {
    const response = await fetch(`${API_BASE}/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async assignCategoryToClass(classId: string, categoryId: string) {
    const response = await fetch(`${API_BASE}/classes/${classId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeCategoryFromClass(classId: string, categoryId: string) {
    const response = await fetch(`${API_BASE}/classes/${classId}/categories/${categoryId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },
};

// Admin APIs
export const adminApi = {
  async getLogs() {
    const response = await fetch(`${API_BASE}/admin/logs`, {
      credentials: 'include',
    });
    return handleResponse<{ logs: any[] }>(response);
  },
};

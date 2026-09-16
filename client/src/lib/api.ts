const API_BASE = '/api';

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = (async () => {
    try {
      const res = await window.fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Server returns { csrfToken: '...' } — read the correct field
        csrfToken = data.csrfToken ?? data.token ?? null;
        return csrfToken;
      }
    } catch (err) {
      console.warn("Failed to fetch CSRF token");
    } finally {
      csrfPromise = null;
    }
    return null;
  })();

  return csrfPromise;
}

export async function refreshCsrfToken() {
  csrfToken = null;
  return await getCsrfToken();
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    const token = await getCsrfToken();
    if (token) {
      options.headers = {
        ...options.headers,
        'x-csrf-token': token
      };
    }
  }
  
  let response = await window.fetch(url, options);

  // Automatically retry once if CSRF token is invalid
  if (response.status === 403) {
    const clonedResponse = response.clone();
    try {
      const errorData = await clonedResponse.json();
      if (errorData.message === "invalid csrf token") {
        console.warn("CSRF Token invalid, refreshing and retrying...");
        csrfToken = null; // Clear global token
        csrfPromise = null; // Clear global promise lock
        const newToken = await getCsrfToken();
        if (newToken) {
          const newHeaders = {
            ...(options.headers || {}),
            'x-csrf-token': newToken
          };
          response = await window.fetch(url, {
            ...options,
            headers: newHeaders
          });
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  return response;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  classId?: string | null;
  createdAt: string;
  classNo?: string | null;
  studentNo?: number | null;
  phoneNumber?: string | null;
  address?: string | null;
  parentName?: string | null;
  parentRelation?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  parentAddress?: string | null;
  class?: any;
  assignedCategories?: { id: string; name: string }[];
  assignedCategoryIds?: string[];
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
  publishedAt?: string | null;
  audienceSize?: number | null;
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
  correctAnswer?: string | null;
  config?: Record<string, any> | null;
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
    correctAnswer?: string | null;
    config?: Record<string, any> | null;
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
    correctAnswer?: string | null;
    config?: Record<string, any> | null;
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
  teacherId?: string; // Legacy/Alias
  classTeacherId?: string | null;
  classTeacher?: User;
  teachers?: User[];
  teacherAssignments?: any[];
  maxStudents?: number;
  createdAt: string;
  assignedCategories?: { id: string; name: string }[];
  _count?: { students: number };
}

export interface DashboardStats {
  totalQuizzes: number;
  totalStudents: number;
  totalTeachers: number;
  totalResults: number;
  averageStudentScore: number;
}

export interface DashboardQuizOverview {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  assignedStudents: number;
  participants: number;
  participationRate: number;
}

export interface ClassAnalyticsItem {
  classId: string;
  className: string;
  studentCount: number;
  participantCount: number;
  completedCount: number;
  averageScore: number;
  participationRate: number;
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
    const error = await response.json().catch(() => ({ message: 'İstek başarısız oldu.' }));
    throw new Error(error.message || `İstek ${response.status} koduyla başarısız oldu.`);
  }
  return response.json();
}

// Auth APIs
export const authApi = {
  async register(name: string, email: string, password: string, classNo?: string, classId?: string) {
    const response = await apiFetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, classNo, classId }),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  async login(email: string, password: string) {
    const response = await apiFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  async logout() {
    const response = await apiFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async forgotPassword(email: string) {
    const response = await apiFetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async resetPassword(token: string, password: string) {
    const response = await apiFetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async getCurrentUser() {
    const response = await apiFetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },
  async updateProfile(name?: string, email?: string) {
    const response = await apiFetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },
  
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await apiFetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },
};

// User Management APIs
export const userApi = {
  async getAllUsers() {
    const response = await apiFetch(`${API_BASE}/users`, {
      credentials: 'include',
    });
    return handleResponse<{ users: User[] }>(response);
  },

  async getUser(userId: string) {
    const response = await apiFetch(`${API_BASE}/users/${userId}`, {
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  async createUser(data: Partial<User> & { password?: string }) {
    const response = await apiFetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  async updateUser(userId: string, data: Partial<User> & { password?: string }) {
    const response = await apiFetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return handleResponse<{ user: User }>(response);
  },

  async deleteUser(userId: string) {
    const response = await apiFetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async updateUserRole(userId: string, role: string) {
    const response = await apiFetch(`${API_BASE}/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async assignCategoryToTeacher(teacherId: string, categoryId: string) {
    const response = await apiFetch(`${API_BASE}/users/${teacherId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeCategoryFromTeacher(teacherId: string, categoryId: string) {
    const response = await apiFetch(`${API_BASE}/users/${teacherId}/categories/${categoryId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },
};

// Quiz APIs
export const quizApi = {
  async getAllQuizzes() {
    const response = await apiFetch(`${API_BASE}/quizzes`, {
      credentials: 'include',
    });
    return handleResponse<{ quizzes: QuizWithDetails[] }>(response);
  },

  async getAllAdminQuizzes() {
    const response = await apiFetch(`${API_BASE}/admin/quizzes`, {
      credentials: 'include',
    });
    return handleResponse<{ quizzes: QuizWithDetails[] }>(response);
  },

  async getQuiz(id: string) {
    const response = await apiFetch(`${API_BASE}/quizzes/${id}`, {
      credentials: 'include',
    });
    return handleResponse<{ quiz: Quiz; questions: Question[] }>(response);
  },

  async createQuiz(quiz: CreateQuizInput) {
    const response = await apiFetch(`${API_BASE}/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quiz),
      credentials: 'include',
    });
    return handleResponse<{ quiz: Quiz; questions: Question[] }>(response);
  },

  async updateQuiz(id: string, quiz: UpdateQuizInput) {
    const response = await apiFetch(`${API_BASE}/quizzes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quiz),
      credentials: 'include',
    });
    return handleResponse<{ quiz: Quiz }>(response);
  },

  async deleteQuiz(id: string) {
    const response = await apiFetch(`${API_BASE}/quizzes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async addQuestions(quizId: string, questions: Partial<Question>[]) {
    const response = await apiFetch(`${API_BASE}/quizzes/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questions),
      credentials: 'include',
    });
    return handleResponse<{ questions: Question[] }>(response);
  },

  async getQuestionsByQuiz(quizId: string) {
    const response = await apiFetch(`${API_BASE}/quizzes/${quizId}`, {
      credentials: 'include',
    });
    const data = await handleResponse<{ quiz: Quiz; questions: Question[] }>(response);
    return data.questions;
  },

  // Student quiz endpoints
  async getStudentQuizzes() {
    const response = await apiFetch(`${API_BASE}/student/quizzes`, {
      credentials: 'include',
    });
    return handleResponse<{ quizzes: Quiz[] }>(response);
  },

  async startQuiz(quizId: string) {
    const response = await apiFetch(`${API_BASE}/student/quiz/${quizId}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{
      resultId: string;
      quiz: { id: string; title: string; description?: string; timeLimit?: number; totalQuestions: number };
      questions: Array<{ id: string; text: string; type: string; options?: string[] }>;
      existingAnswers?: Record<string, string>;
      remainingSeconds?: number | null;
    }>(response);
  },

  async prepareQuizOffline(quizId: string) {
    const response = await apiFetch(`${API_BASE}/student/quiz/${quizId}/prepare-offline`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{
      resultId: string;
      quiz: Quiz;
      questions: Array<{ id: string; text: string; type: string; options?: string[] }>;
      existingAnswers?: Record<string, string>;
      remainingSeconds: null;
      preparedAt: string;
    }>(response);
  },

  async submitAnswer(resultId: string, questionId: string, selectedOption: string) {
    const response = await apiFetch(`${API_BASE}/student/quiz/${resultId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedOption }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async submitQuiz(resultId: string, answers?: Record<string, string>) {
    const response = await apiFetch(`${API_BASE}/student/quiz/${resultId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
      credentials: 'include',
    });
    return handleResponse<{
      message: string;
      score: number;
      totalQuestions: number;
      correctAnswers: number;
      timeTaken: number;
      acceptedQueuedAnswers: boolean;
    }>(response);
  },
};

// Category APIs
export const categoryApi = {
  async getAllCategories() {
    const response = await apiFetch(`${API_BASE}/categories`, {
      credentials: 'include',
    });
    return handleResponse<Category[]>(response);
  },

  async createCategory(name: string, description?: string, color?: string) {
    const response = await apiFetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color }),
      credentials: 'include',
    });
    return handleResponse<Category>(response);
  },

  async updateCategory(id: string, name: string, description?: string, color?: string) {
    const response = await apiFetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color }),
      credentials: 'include',
    });
    return handleResponse<Category>(response);
  },

  async deleteCategory(id: string) {
    const response = await apiFetch(`${API_BASE}/categories/${id}`, {
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
    const response = await apiFetch(`${API_BASE}/ai/generate-questions`, {
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
    const response = await apiFetch(`${API_BASE}/ai/test-config`, {
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
    const response = await apiFetch(url, {
      credentials: 'include',
    });
    return handleResponse<{ results: StudentResult[] }>(response);
  },

  async getResultDetail(resultId: string) {
    const response = await apiFetch(`${API_BASE}/student/results/${resultId}`, {
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
        correctAnswer?: string | null;
    config?: Record<string, any> | null;
        studentAnswer?: string;
        isCorrect: boolean;
      }>;
    }>(response);
  },

  async getQuizResults(quizId: string) {
    const response = await apiFetch(`${API_BASE}/results/quiz/${quizId}`, {
      credentials: 'include',
    });
    return handleResponse<{ results: StudentResult[] }>(response);
  },
};

// Dashboard APIs
export const dashboardApi = {
  async getAdminStats() {
    const response = await apiFetch(`${API_BASE}/dashboard/stats`, {
      credentials: 'include',
    });
    return handleResponse<{ stats: DashboardStats }>(response);
  },
  async getTeacherStats() {
    const response = await apiFetch(`${API_BASE}/dashboard/stats`, {
      credentials: 'include',
    });
    return handleResponse<{ stats: DashboardStats }>(response);
  },
  async getOverview() {
    const response = await apiFetch(`${API_BASE}/dashboard/overview`, { credentials: 'include' });
    return handleResponse<{ recentQuizzes: DashboardQuizOverview[] }>(response);
  },
};

export const analyticsApi = {
  async getClassAnalytics(filters: { classId?: string; startDate?: string; endDate?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.classId && filters.classId !== 'all') params.set('classId', filters.classId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    const query = params.toString();
    const response = await apiFetch(`${API_BASE}/analytics/classes${query ? `?${query}` : ''}`, {
      credentials: 'include',
    });
    return handleResponse<{
      classes: ClassAnalyticsItem[];
      filters: { classId: string | null; startDate: string; endDate: string };
    }>(response);
  },
};

// Class APIs
export const classApi = {
  async getAllClasses() {
    const response = await apiFetch(`${API_BASE}/classes`, {
      credentials: 'include',
    });
    return handleResponse<{ classes: Class[] }>(response);
  },

  async getTeacherClasses() {
    const response = await apiFetch(`${API_BASE}/classes`, {
      credentials: 'include',
    });
    return handleResponse<{ classes: Class[] }>(response);
  },

  async getClass(id: string) {
    const response = await apiFetch(`${API_BASE}/classes/${id}`, {
      credentials: 'include',
    });
    return handleResponse<{ class: Class; students: User[] }>(response);
  },

  async createClass(classData: { name: string; description?: string; teacherId?: string; classTeacherId?: string; maxStudents?: number }) {
    const response = await apiFetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData),
      credentials: 'include',
    });
    return handleResponse<Class>(response);
  },

  async updateClass(classId: string, classData: { name?: string; description?: string; classTeacherId?: string | null; maxStudents?: number }) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(classData),
      credentials: 'include',
    });
    return handleResponse<Class>(response);
  },

  async deleteClass(classId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async assignTeacherToClass(classId: string, teacherId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeTeacherFromClass(classId: string, teacherId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}/teachers/${teacherId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async assignStudentToClass(classId: string, studentId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeStudentFromClass(classId: string, studentId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async assignTeacherToClassWithCourse(classId: string, teacherId: string, categoryId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}/teachers-with-course`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, categoryId }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeTeacherFromClassWithCourse(assignmentId: string) {
    const response = await apiFetch(`${API_BASE}/classes/teacher-course/${assignmentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async assignCategoryToClass(classId: string, categoryId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId }),
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  async removeCategoryFromClass(classId: string, categoryId: string) {
    const response = await apiFetch(`${API_BASE}/classes/${classId}/categories/${categoryId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },
};

// Admin APIs
export const adminApi = {
  async getLogs(filters?: { role?: string, userId?: string, action?: string, startDate?: string, endDate?: string, page?: number, limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await apiFetch(`${API_BASE}/admin/logs?${params.toString()}`, {
      credentials: "include",
    });
    return handleResponse<{ logs: any[] }>(response);
  },
  async getLogsMe() {
    const response = await apiFetch(`${API_BASE}/admin/logs/me`, {
      credentials: "include",
    });
    return handleResponse<{ logs: any[] }>(response);
  },
  async archiveYear(academicYear: string) {
    const response = await apiFetch(`${API_BASE}/admin/archive`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academicYear }),
      credentials: "include",
    });
    return handleResponse<{ message: string, quizzesArchived: number, resultsArchived: number }>(response);
  },
  async promoteStudents(promotions: { fromClassId: string, toClassId: string | null }[]) {
    const response = await apiFetch(`${API_BASE}/admin/promote-students`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promotions }),
      credentials: "include",
    });
    return handleResponse<{ message: string, totalPromoted: number }>(response);
  }
};

// Notification APIs
export const notificationApi = {
  async getNotifications(page = 1, limit = 20) {
    const response = await apiFetch(`${API_BASE}/notifications?page=${page}&limit=${limit}`, {
      credentials: "include",
    });
    return handleResponse<{ notifications: any[]; pagination: { page: number; limit: number; total: number; unread: number; totalPages: number } }>(response);
  },
  async markAsRead() {
    const response = await apiFetch(`${API_BASE}/notifications/mark-read`, {
      method: "POST",
      credentials: "include",
    });
    return handleResponse<{ success: boolean }>(response);
  },
  async getUserNotifications(page = 1, limit = 100) {
    return this.getNotifications(page, limit);
  },
  async markAllAsRead() {
    return this.markAsRead();
  },
  async deleteNotification(id: string) {
    const response = await apiFetch(`${API_BASE}/notifications/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse<{ success: boolean }>(response);
  },
  async getPreferences() {
    const response = await apiFetch(`${API_BASE}/notifications/preferences`, {
      credentials: "include",
    });
    return handleResponse<{ muted: boolean }>(response);
  },
  async updatePreferences(muted: boolean) {
    const response = await apiFetch(`${API_BASE}/notifications/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted }),
      credentials: "include",
    });
    return handleResponse<{ muted: boolean }>(response);
  }
};

// Announcement APIs
export const announcementApi = {
  async getAllAnnouncements() {
    const response = await apiFetch(`${API_BASE}/announcements`, {
      credentials: "include",
    });
    return handleResponse<{ announcements: any[] }>(response);
  },
  async createAnnouncement(data: { title: string, content: string, targetRole?: string, targetClassId?: string | null }) {
    const response = await apiFetch(`${API_BASE}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return handleResponse<any>(response);
  },
  async deleteAnnouncement(id: string) {
    const response = await apiFetch(`${API_BASE}/announcements/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  }
};


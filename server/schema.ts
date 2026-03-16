// User type
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'student';
  classNo?: string | null; // Student class number
  classId?: string | null;
  createdAt: string;
}

export interface InsertUser {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'teacher' | 'student';
  classNo?: string | null;
  classId?: string | null;
}

// ActionLog type
export interface ActionLog {
  id: string;
  userId: string;
  action: string;
  details?: string | null;
  createdAt: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

// Class type
export interface Class {
  id: string;
  name: string;
  description?: string | null;
  maxStudents?: number | null;
  createdAt: string;
  teachers?: User[];
}

export interface InsertClass {
  name: string;
  description?: string | null;
  teacherId: string;
  maxStudents?: number | null;
}

// Quiz type
export interface Quiz {
  id: string;
  title: string;
  description?: string;
  category: string;
  categoryId?: string | null;
  difficulty: string;
  timeLimit?: number;
  shuffleQuestions: boolean;
  createdBy: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
}

export interface InsertQuiz {
  title: string;
  description?: string;
  category?: string;
  categoryId?: string | null;
  difficulty?: string;
  timeLimit?: number;
  shuffleQuestions?: boolean;
  createdBy: string;
  status?: 'draft' | 'published' | 'archived';
}

// Question type
export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer: string;
  imageUrl?: string | null;
  order: number;
  createdAt: string;
}

export interface InsertQuestion {
  quizId: string;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer: string;
  imageUrl?: string | null;
  order: number;
}

// StudentResult type
export interface StudentResult {
  id: string;
  studentId: string;
  quizId: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  answers?: Record<string, any>;
  score?: number;
  correctAnswersCount?: number;
  totalQuestions?: number;
  timeTaken?: number;
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  quiz?: Quiz;
  student?: User;
}

export interface InsertStudentResult {
  studentId: string;
  quizId: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  answers?: Record<string, any>;
  score?: number;
  correctAnswersCount?: number;
  totalQuestions?: number;
  timeTaken?: number;
  startedAt?: Date;
  submittedAt?: Date;
  completedAt?: Date;
}

// Category type
export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface InsertCategory {
  name: string;
  description?: string;
}

// Zod validation schemas
import { z } from "zod";

export const insertUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  classNo: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
});

export const insertQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  difficulty: z.string().optional(),
  timeLimit: z.number().optional(),
  shuffleQuestions: z.boolean().optional(),
  createdBy: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const insertQuestionSchema = z.object({
  quizId: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(['multiple-choice', 'true-false', 'short-answer']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  order: z.number(),
});

export const insertStudentResultSchema = z.object({
  studentId: z.string().min(1),
  quizId: z.string().min(1),
  status: z.enum(['in_progress', 'completed', 'abandoned']),
  answers: z.record(z.any()).optional(),
  score: z.number().optional(),
  correctAnswersCount: z.number().optional(),
  totalQuestions: z.number().optional(),
  timeTaken: z.number().optional(),
  startedAt: z.date().optional(),
  submittedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export const insertActionLogSchema = z.object({
  userId: z.string().min(1),
  action: z.string().min(1),
  details: z.string().optional().nullable(),
});

// Dummy table objects for drizzle-orm compatibility
export const users = {};
export const quizzes = {};
export const questions = {};
export const studentResults = {};
export const categories = {};
export const actionLogs = {};

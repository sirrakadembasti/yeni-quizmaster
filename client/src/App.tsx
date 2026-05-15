import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { NotificationListener } from "@/components/NotificationListener";

// Pages
import HomePage from "@/pages/home";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import QuizzesPage from "@/pages/quizzes";
import CreateQuizPage from "@/pages/create-quiz";
import StatisticsPage from "@/pages/results";
import StudentsPage from "@/pages/students";
import SettingsPage from "@/pages/settings";
import StudentDashboard from "@/pages/student-dashboard";
import StudentStatsPage from "@/pages/student-stats";
import StudentQuizzesPage from "@/pages/student-quizzes";
import StudentResultsPage from "@/pages/student-results";
import StudentQuizPage from "@/pages/student-quiz";
import QuizResultDetailPage from "@/pages/quiz-result-detail";
import TeachersPage from "@/pages/teachers";
import TeacherDetailPage from "@/pages/teacher-detail";
import AuthPage from "@/pages/auth";
import AdminManagementPage from "@/pages/admin-management";
import ClassListPage from "@/pages/classlist";
import ClassDetailPage from "@/pages/class-detail";
import AdminClassDetailPage from "@/pages/admin-class-detail";
import AdminQuizzesPage from "@/pages/admin-quizzes";
import ResetPasswordPage from "@/pages/reset-password";
import ArchivePage from "@/pages/admin/archive";
import AnnouncementsPage from "@/pages/announcements";

/**
 * Public routes accessible without authentication
 */
function PublicRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/:rest*">
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

/**
 * Routes for students
 */
function StudentRoutes() {
  return (
    <Switch>
      <Route path="/" component={StudentDashboard} />
      <Route path="/student/dashboard" component={StudentDashboard} />
      <Route path="/student/quizzes" component={StudentQuizzesPage} />
      <Route path="/student/quiz/:quizId" component={StudentQuizPage} />
      <Route path="/student/results" component={StudentResultsPage} />
      <Route path="/student/result/:resultId" component={QuizResultDetailPage} />
      <Route path="/my-quizzes" component={StudentQuizzesPage} />
      <Route path="/my-results" component={StudentResultsPage} />
      <Route path="/my-stats" component={StudentStatsPage} />
      <Route path="/announcements" component={AnnouncementsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/student-quizzes/:quizId">{(params: any) => <Redirect to={`/student/quiz/${params.quizId}`} />}</Route>    
      <Route path="/:rest*">
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

/**
 * Routes for teacher role
 */
function TeacherRoutes() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/quizzes" component={QuizzesPage} />
      <Route path="/quizzes/:id" component={CreateQuizPage} />
      <Route path="/create-quiz" component={CreateQuizPage} />
      <Route path="/student/quiz/:quizId" component={StudentQuizPage} />
      <Route path="/student/result/:resultId" component={QuizResultDetailPage} />
      <Route path="/student/results" component={StudentResultsPage} />
      <Route path="/results" component={StatisticsPage} />
      <Route path="/my-stats" component={StudentStatsPage} />
      <Route path="/students" component={StudentsPage} />
      <Route path="/classlist" component={ClassListPage} />
      <Route path="/classes/:id" component={ClassDetailPage} />
      <Route path="/announcements" component={AnnouncementsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/student-quizzes/:quizId">{(params: any) => <Redirect to={`/student/quiz/${params.quizId}`} />}</Route>
      <Route path="/:rest*">
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

/**
 * Routes for admin role
 */
function AdminRoutes() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/quizzes" component={QuizzesPage} />
      <Route path="/admin-quizzes" component={AdminQuizzesPage} />
      <Route path="/quizzes/:id" component={CreateQuizPage} />
      <Route path="/create-quiz" component={CreateQuizPage} />
      <Route path="/student/quiz/:quizId" component={StudentQuizPage} />
      <Route path="/student/result/:resultId" component={QuizResultDetailPage} />
      <Route path="/student/results" component={StudentResultsPage} />
      <Route path="/results" component={StatisticsPage} />
      <Route path="/my-stats" component={StudentStatsPage} />
      <Route path="/students" component={StudentsPage} />
      <Route path="/classlist" component={ClassListPage} />
      <Route path="/classes/:id" component={ClassDetailPage} />
      <Route path="/admin/classes/:id" component={AdminClassDetailPage} />
      <Route path="/teachers" component={TeachersPage} />
      <Route path="/teachers/:id" component={TeacherDetailPage} />
      <Route path="/management" component={AdminManagementPage} />
      <Route path="/archive" component={ArchivePage} />
      <Route path="/announcements" component={AnnouncementsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/student-quizzes/:quizId">{(params: any) => <Redirect to={`/student/quiz/${params.quizId}`} />}</Route>    
      <Route path="/:rest*">
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

function Router() {
  const { role, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-300">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PublicRoutes />;
  }

  if (role === 'student') return <StudentRoutes />;
  if (role === 'teacher') return <TeacherRoutes />;
  return <AdminRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <NotificationListener />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";

import HomePage from "@/pages/home";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import QuizzesPage from "@/pages/quizzes";
import CreateQuizPage from "@/pages/create-quiz";
import ResultsPage from "@/pages/results";
import StudentsPage from "@/pages/students";
import SettingsPage from "@/pages/settings";
import StudentDashboard from "@/pages/student-dashboard";
import StudentStatsPage from "@/pages/student-stats";
import StudentQuizzesPage from "@/pages/student-quizzes";
import StudentResultsPage from "@/pages/student-results";
import StudentQuizPage from "@/pages/student-quiz";
import QuizResultDetailPage from "@/pages/quiz-result-detail";
import TeachersPage from "@/pages/teachers";
import AuthPage from "@/pages/auth";
import AdminManagementPage from "@/pages/admin-management";

function Router() {
  const { role, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Misafir kullanıcılar için public routes
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/:rest*">
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  // Authenticated users için protected routes
  return (
    <Switch>
      {/* Shared Routes */}
      <Route path="/student-quizzes/:quizId">{(params: any) => <Redirect to={`/student/quiz/${params.quizId}`} />}</Route>
      <Route path="/settings" component={SettingsPage} />
      
      {/* Role Based Conditional Routing */}
      {role === 'student' ? (
        <>
           <Route path="/" component={StudentDashboard} />
           <Route path="/student/dashboard" component={StudentDashboard} />
           <Route path="/student/quizzes" component={StudentQuizzesPage} />
           <Route path="/student/quiz/:quizId" component={StudentQuizPage} />
           <Route path="/student/results" component={StudentResultsPage} />
           <Route path="/student/result/:resultId" component={QuizResultDetailPage} />
           <Route path="/my-quizzes" component={StudentQuizzesPage} />
           <Route path="/my-results" component={StudentResultsPage} />
           <Route path="/my-stats" component={StudentStatsPage} />
           <Route path="/settings" component={SettingsPage} />
           <Route path="/:rest*">
              <Redirect to="/" />
           </Route>
        </>
      ) : (
        <>
          <Route path="/" component={DashboardPage} />
          <Route path="/quizzes" component={QuizzesPage} />
          <Route path="/quizzes/:id" component={CreateQuizPage} />
          <Route path="/create-quiz" component={CreateQuizPage} />
          <Route path="/student/quiz/:quizId" component={StudentQuizPage} />
          <Route path="/student/result/:resultId" component={QuizResultDetailPage} />
          <Route path="/student/results" component={StudentResultsPage} />
          <Route path="/results" component={ResultsPage} />
          <Route path="/students" component={StudentsPage} />
          <Route path="/teachers" component={TeachersPage} />
          <Route path="/management" component={AdminManagementPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/:rest*">
              <Redirect to="/" />
           </Route>
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

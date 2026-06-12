import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { NotificationListener } from "@/components/NotificationListener";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

// =============================================================================
// TYPES
// =============================================================================

type Role = 'admin' | 'teacher' | 'student';

interface RouteConfig {
  path: string;
  component: React.ComponentType;
  /**
   * Roles allowed to access this route.
   *   []            → public (no auth required)
   *   ['admin', …]  → must be authenticated AND have one of these roles
   */
  roles: Role[];
}

// =============================================================================
// SMART HOME — renders the correct dashboard based on auth state / role
// =============================================================================

function HomeRoute() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <HomePage />;
  if (role === 'student') return <StudentDashboard />;
  return <DashboardPage />;
}

// =============================================================================
// ROUTE REGISTRY — single source of truth for every path + its allowed roles
// =============================================================================

const ALL: Role[] = ['admin', 'teacher', 'student'];

const ROUTES: RouteConfig[] = [
  // ── Public ──────────────────────────────────────────────────────────────────
  { path: '/',               component: HomeRoute,         roles: [] },
  { path: '/auth',           component: AuthPage,          roles: [] },
  { path: '/reset-password', component: ResetPasswordPage, roles: [] },

  // ── All authenticated roles ──────────────────────────────────────────────────
  { path: '/settings',                  component: SettingsPage,       roles: ALL },
  { path: '/announcements',             component: AnnouncementsPage,  roles: ALL },
  { path: '/my-stats',                  component: StudentStatsPage,   roles: ALL },
  { path: '/student/quiz/:quizId',      component: StudentQuizPage,    roles: ALL },
  { path: '/student/result/:resultId',  component: QuizResultDetailPage, roles: ALL },
  { path: '/student/results',           component: StudentResultsPage, roles: ALL },

  // ── Student only ─────────────────────────────────────────────────────────────
  { path: '/student/dashboard', component: StudentDashboard,   roles: ['student'] },
  { path: '/student/quizzes',   component: StudentQuizzesPage, roles: ['student'] },
  { path: '/my-quizzes',        component: StudentQuizzesPage, roles: ['student'] },
  { path: '/my-results',        component: StudentResultsPage, roles: ['student'] },

  // ── Teacher + Admin ───────────────────────────────────────────────────────────
  { path: '/quizzes',       component: QuizzesPage,   roles: ['teacher', 'admin'] },
  { path: '/create-quiz',   component: CreateQuizPage, roles: ['teacher', 'admin'] },
  { path: '/quizzes/:id',   component: CreateQuizPage, roles: ['teacher', 'admin'] },
  { path: '/results',       component: StatisticsPage, roles: ['teacher', 'admin'] },
  { path: '/students',      component: StudentsPage,   roles: ['teacher', 'admin'] },
  { path: '/classlist',     component: ClassListPage,  roles: ['teacher', 'admin'] },
  { path: '/classes/:id',   component: ClassDetailPage, roles: ['teacher', 'admin'] },

  // ── Admin only ────────────────────────────────────────────────────────────────
  { path: '/admin-quizzes',     component: AdminQuizzesPage,     roles: ['admin'] },
  { path: '/admin/classes/:id', component: AdminClassDetailPage, roles: ['admin'] },
  { path: '/teachers',          component: TeachersPage,         roles: ['admin'] },
  { path: '/teachers/:id',      component: TeacherDetailPage,    roles: ['admin'] },
  { path: '/management',        component: AdminManagementPage,  roles: ['admin'] },
  { path: '/archive',           component: ArchivePage,          roles: ['admin'] },
];

// =============================================================================
// GUARD HELPERS
// =============================================================================

/**
 * Saves the intended protected URL to sessionStorage, then navigates to /auth.
 * auth.tsx reads this value after a successful login to restore the destination.
 */
function RedirectToAuth() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    const skip = ['/', '/auth', '/reset-password'];
    if (!skip.includes(location)) {
      sessionStorage.setItem('returnUrl', location);
    }
    navigate('/auth', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * Shows a "Yetkisiz Erişim" toast, then redirects the authenticated user to /.
 * Suppresses the toast for /auth so returning logged-in users aren't alarmed.
 */
function UnauthorizedRedirect() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (location !== '/auth') {
      toast({
        variant: 'destructive',
        title: 'Yetkisiz Erişim',
        description: 'Bu sayfaya erişim yetkiniz bulunmuyor.',
      });
    }
    navigate('/', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// =============================================================================
// ROUTE GUARD — central auth + role decision point
// =============================================================================

/**
 * Wraps every route rendered by the Router.
 *
 * Decision tree (loading is already resolved by the time this runs):
 *   public route + authenticated + path === /auth  → redirect to /  (silent)
 *   public route                                   → render
 *   protected + not authenticated                  → save url → /auth
 *   protected + wrong role                         → toast   → /
 *   protected + correct role                       → render
 */
function RouteGuard({ component: Component, roles }: RouteConfig) {
  const { isAuthenticated, role } = useAuth();
  const [location] = useLocation();
  const isPublic = roles.length === 0;

  if (isPublic) {
    // Prevent authenticated users from seeing the login page again
    if (isAuthenticated && location === '/auth') return <Redirect to="/" />;
    return <Component />;
  }

  if (!isAuthenticated) return <RedirectToAuth />;
  if (!(roles as string[]).includes(role)) return <UnauthorizedRedirect />;
  return <Component />;
}

// =============================================================================
// ROUTER — maps the ROUTES config to <Route> elements
// =============================================================================

function Router() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Legacy alias redirect — must be before parameterised /student/quiz/:id */}
      <Route path="/student-quizzes/:quizId">
        {(params: { quizId: string }) => (
          <Redirect to={`/student/quiz/${params.quizId}`} />
        )}
      </Route>

      {/* All application routes derived from the ROUTES registry */}
      {ROUTES.map((cfg) => (
        <Route key={cfg.path} path={cfg.path}>
          <RouteGuard {...cfg} />
        </Route>
      ))}

      {/* True 404 — nothing in ROUTES matched */}
      <Route component={NotFound} />
    </Switch>
  );
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

import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { lazy, useEffect } from "react";
import { RouteLoadBoundary } from "@/components/RouteLoadBoundary";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { NotificationListener } from "@/components/NotificationListener";
import { AcademicYearProvider, useAcademicYear } from "@/context/academic-year-context";
import { AcademicRouteBoundary } from "@/components/academic-history/AcademicRouteBoundary";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Pages
import HomePage from "@/pages/home";
import NotFound from "@/pages/not-found";
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const QuizzesPage = lazy(() => import("@/pages/quizzes"));
const CreateQuizPage = lazy(() => import("@/pages/create-quiz"));
const StatisticsPage = lazy(() => import("@/pages/results"));
const ClassStatisticsPage = lazy(() => import("@/pages/class-statistics"));
const StudentsPage = lazy(() => import("@/pages/students"));
const SettingsPage = lazy(() => import("@/pages/settings"));
import StudentDashboard from "@/pages/student-dashboard";
const StudentStatsPage = lazy(() => import("@/pages/student-stats"));
import StudentQuizzesPage from "@/pages/student-quizzes";
import StudentResultsPage from "@/pages/student-results";
import StudentQuizPage from "@/pages/student-quiz";
import QuizResultDetailPage from "@/pages/quiz-result-detail";
const TeachersPage = lazy(() => import("@/pages/teachers"));
const TeacherDetailPage = lazy(() => import("@/pages/teacher-detail"));
import AuthPage from "@/pages/auth";
const AIManagementPage = lazy(() => import("@/pages/ai-management"));
const AdminManagementPage = lazy(() => import("@/pages/admin-management"));
const ClassListPage = lazy(() => import("@/pages/classlist"));
const ClassDetailPage = lazy(() => import("@/pages/class-detail"));
const AdminClassDetailPage = lazy(() => import("@/pages/admin-class-detail"));
const AdminQuizzesPage = lazy(() => import("@/pages/admin-quizzes"));
import ResetPasswordPage from "@/pages/reset-password";
const ArchivePage = lazy(() => import("@/pages/admin/archive"));
const AnnouncementsPage = lazy(() => import("@/pages/announcements"));
const StudentSurveysPage = lazy(() => import("@/pages/student-surveys"));
const TakeSurveyPage = lazy(() => import("@/pages/take-survey"));
const SurveyResultsPage = lazy(() => import("@/pages/survey-results"));
const ParentDashboardPage = lazy(() => import("@/pages/parent-dashboard"));
const ParentResultsPage = lazy(() => import("@/pages/parent-results"));
const GuardianManagementPage = lazy(() => import("@/pages/guardian-management"));
const ServerSetupPage = lazy(() => import("@/pages/server-setup"));

// =============================================================================
// TYPES
// =============================================================================

type Role = 'admin' | 'teacher' | 'student' | 'parent';

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
  if (role === 'parent') return <ParentDashboardPage />;
  return <DashboardPage />;
}

// =============================================================================
// ROUTE REGISTRY — single source of truth for every path + its allowed roles
// =============================================================================

const ALL: Role[] = ['admin', 'teacher', 'student', 'parent'];

const ROUTES: RouteConfig[] = [
  // ── Public ──────────────────────────────────────────────────────────────────
  { path: '/',               component: HomeRoute,         roles: [] },
  { path: '/auth',           component: AuthPage,          roles: [] },
  { path: '/reset-password', component: ResetPasswordPage, roles: [] },

  // ── All authenticated roles ──────────────────────────────────────────────────
  { path: '/settings',                  component: SettingsPage,       roles: ALL },
  { path: '/announcements',             component: AnnouncementsPage,  roles: ALL },
  { path: '/my-stats',                  component: StudentStatsPage,   roles: ['student'] },
  { path: '/student/quiz/:quizId',      component: StudentQuizPage,    roles: ['student', 'teacher', 'admin'] },
  { path: '/student/result/:resultId',  component: QuizResultDetailPage, roles: ['student', 'teacher', 'admin'] },
  { path: '/student/results',           component: StudentResultsPage, roles: ['student', 'teacher', 'admin'] },

  // Parent only — linked students are read-only and enforced again by the API.
  { path: '/parent/dashboard', component: ParentDashboardPage, roles: ['parent'] },
  { path: '/parent/results', component: ParentResultsPage, roles: ['parent'] },

  // ── Student only ─────────────────────────────────────────────────────────────
  { path: '/student/dashboard', component: StudentDashboard,   roles: ['student'] },
  { path: '/student/quizzes',   component: StudentQuizzesPage, roles: ['student'] },
  { path: '/student/surveys',   component: StudentSurveysPage, roles: ['student'] },
  { path: '/student/survey/:id', component: TakeSurveyPage, roles: ['student'] },
  { path: '/my-quizzes',        component: StudentQuizzesPage, roles: ['student'] },
  { path: '/my-results',        component: StudentResultsPage, roles: ['student'] },

  // ── Teacher + Admin ───────────────────────────────────────────────────────────
  { path: '/quizzes',       component: QuizzesPage,   roles: ['teacher', 'admin'] },
  { path: '/create-quiz',   component: CreateQuizPage, roles: ['teacher', 'admin'] },
  { path: '/quizzes/:id',   component: CreateQuizPage, roles: ['teacher', 'admin'] },
  { path: '/results',       component: StatisticsPage, roles: ['teacher', 'admin'] },
  { path: '/statistics',    component: ClassStatisticsPage, roles: ['teacher', 'admin'] },
  { path: '/survey-results', component: SurveyResultsPage, roles: ['teacher', 'admin'] },
  { path: '/students',      component: StudentsPage,   roles: ['teacher', 'admin'] },
  { path: '/classlist',     component: ClassListPage,  roles: ['teacher', 'admin'] },
  { path: '/classes/:id',   component: ClassDetailPage, roles: ['teacher', 'admin'] },

  // ── Admin only ────────────────────────────────────────────────────────────────
  { path: '/admin-quizzes',     component: AdminQuizzesPage,     roles: ['admin'] },
  { path: '/admin/classes/:id', component: AdminClassDetailPage, roles: ['admin'] },
  { path: '/teachers',          component: TeachersPage,         roles: ['admin'] },
  { path: '/teachers/:id',      component: TeacherDetailPage,    roles: ['admin'] },
  { path: '/ai-management', component: AIManagementPage, roles: ['admin'] },
  { path: '/management',        component: AdminManagementPage,  roles: ['admin'] },
  { path: '/archive',           component: ArchivePage,          roles: ['admin'] },
  { path: '/server-setup',      component: ServerSetupPage,      roles: ['admin'] },
  { path: '/guardian-management', component: GuardianManagementPage, roles: ['admin'] },
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
export function RouteGuard({ component: Component, roles }: RouteConfig) {
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

function AppRouter() {
  const { loading } = useAuth();
  const [location] = useLocation();

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
    <RouteLoadBoundary route={location}><Switch>
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
    </Switch></RouteLoadBoundary>
  );
}

function LiveNotificationListener() {
  const { role } = useAuth();
  const academic = useAcademicYear();
  if (role === 'admin' && (!academic || academic.pending || academic.error || !academic.year)) return null;
  return <NotificationListener />;
}

function App() {
  const basePath = import.meta.env.BASE_URL === '/'
    ? ''
    : import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AcademicYearProvider>
          <TooltipProvider>
            <Toaster />
            <SonnerToaster />
            <LiveNotificationListener />
            <WouterRouter base={basePath}>
              <AcademicRouteBoundary>
                <AppRouter />
              </AcademicRouteBoundary>
            </WouterRouter>
          </TooltipProvider>
        </AcademicYearProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

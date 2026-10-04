import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  LogOut,
  Bell,
  BarChart3,
  ListChecks,
  UserCircle,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Archive,
  Megaphone,
  ChevronDown,
  CheckCircle2,
  Clock,
  ExternalLink,
  Menu,
  X,
  Trash2,
  Volume2,
  VolumeX,
  ClipboardList,
  ServerCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/lib/api";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { removeNotification, type NotificationPage } from "@/lib/notification-cache";
import { toast } from "sonner";
import { useAcademicYear } from '@/context/academic-year-context';
import { AcademicYearSelector } from '@/components/academic-history/AcademicYearSelector';
import { HistoricalWorkspace } from '@/components/academic-history/HistoricalWorkspace';

interface DashboardLayoutProps {
  children: ReactNode;
  hideNavigation?: boolean;
}

export function DashboardLayout({ children, hideNavigation = false }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [isMobileNavigation, setIsMobileNavigation] = useState(() => typeof window.matchMedia !== "function" || !window.matchMedia("(min-width: 1024px)").matches);
  const { user, role, logout } = useAuth();
  const academic = useAcademicYear();
  const historical = role === 'admin' && academic?.year?.status === 'closed';
  const liveContext = role !== 'admin' || !academic || (!!academic.year && !academic.pending && !academic.error && !historical);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setIsMobileNavigation(!desktop.matches);
      if (desktop.matches) setMobileNavigationOpen(false);
    };
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileNavigationOpen || hideNavigation) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const controls = () => Array.from(sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), [tabindex="0"]'));
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavigationOpen(false);
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (!sidebar.contains(event.target as Node)) controls()[0]?.focus();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", keepFocus);
      menuTriggerRef.current?.focus();
    };
  }, [mobileNavigationOpen, hideNavigation]);

  const { data: notificationsData, isPending: notificationsLoading, isError: notificationsError, isFetching: notificationsFetching, refetch: retryNotifications } = useQuery({
    queryKey: ["notifications", "nav"],
    queryFn: () => notificationApi.getUserNotifications(1, 5),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    enabled: !!user && liveContext
  });

  const { data: notificationPreferences } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => notificationApi.getPreferences(),
    enabled: !!user && liveContext
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => toast.error("Bildirimler okundu olarak işaretlenemedi. Lütfen tekrar deneyin.")
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationApi.deleteNotification(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueriesData({ queryKey: ["notifications"] });
      queryClient.setQueriesData<NotificationPage>(
        { queryKey: ["notifications"] },
        current => removeNotification(current, id)
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error("Bildirim silinemedi. Lütfen tekrar deneyin.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.refetchQueries({ queryKey: ["notifications"], type: "active" });
    }
  });

  const muteNotificationsMutation = useMutation({
    mutationFn: (muted: boolean) => notificationApi.updatePreferences(muted),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["notifications", "preferences"], preferences);
    },
    onError: () => toast.error("Bildirim tercihleri güncellenemedi. Lütfen tekrar deneyin.")
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.pagination?.unread ?? notifications.filter((n: any) => !n.isRead).length;
  const notificationsMuted = notificationPreferences?.muted ?? false;

  const menuItems = [
    { label: "Dashboard", href: role === 'student' ? "/student/dashboard" : role === 'parent' ? "/parent/dashboard" : "/", icon: LayoutDashboard },
    ...(role === 'student' ? [
      { label: "Sınavlarım", href: "/student/quizzes", icon: FileText },
      { label: "Anketlerim", href: "/student/surveys", icon: ClipboardList },
      { label: "Sonuçlarım", href: "/student/results", icon: ListChecks },
      { label: "İstatistiklerim", href: "/my-stats", icon: BarChart3 },
    ] : []),
    ...(role === 'parent' ? [
      { label: "Sınav Sonuçları", href: "/parent/results", icon: ListChecks },
    ] : []),
    ...(role === 'teacher' ? [
      { label: "Sınavlarım", href: "/quizzes", icon: FileText },
      { label: "Sınıf İstatistikleri", href: "/statistics", icon: BarChart3 },
      { label: "Sınav Sonuçları", href: "/results", icon: ListChecks },
      { label: "Anket Yönetimi", href: "/survey-results", icon: ClipboardList },
      { label: "Öğrenciler", href: "/students", icon: Users },
      { label: "Sınıflarım", href: "/classlist", icon: GraduationCap },
    ] : []),
    ...(role === 'admin' ? [
      { label: "Sınav Yönetimi", href: "/admin-quizzes", icon: ShieldCheck },
      { label: "Sınavlar", href: "/quizzes", icon: FileText },
      { label: "Sınıf İstatistikleri", href: "/statistics", icon: BarChart3 },
      { label: "Sınav Sonuçları", href: "/results", icon: ListChecks },
      { label: "Anket Yönetimi", href: "/survey-results", icon: ClipboardList },
      { label: "Öğrenciler", href: "/students", icon: Users },
      { label: "Öğretmenler", href: "/teachers", icon: Briefcase },
      { label: "Veli Eşleştirme", href: "/guardian-management", icon: UserCircle },
      { label: "Sınıflar", href: "/classlist", icon: GraduationCap },
      { label: "Yönetim", href: "/management", icon: Settings },
      { label: "Arşiv", href: "/archive", icon: Archive },
      { label: "Sunucu Durumu", href: "/server-setup", icon: ServerCog },
    ] : []),
    { label: "Duyurular", href: "/announcements", icon: Megaphone },
    { label: "Ayarlar", href: "/settings", icon: Settings },
  ];

  return (
    <div data-dashboard-shell className="flex h-screen overflow-hidden bg-background font-sans">
      {/* Sidebar */}
      {!hideNavigation && mobileNavigationOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden print:hidden"
          onClick={() => setMobileNavigationOpen(false)}
        />
      )}
      {!hideNavigation && (
      <aside ref={sidebarRef} id="dashboard-navigation" role={mobileNavigationOpen ? "dialog" : undefined} aria-modal={mobileNavigationOpen ? true : undefined} aria-label="Ana menü" aria-hidden={isMobileNavigation && !mobileNavigationOpen ? true : undefined} inert={isMobileNavigation && !mobileNavigationOpen ? true : undefined} className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/70 bg-card shadow-xl transition-transform duration-200 lg:static lg:w-64 lg:translate-x-0 lg:shadow-sm print:hidden",
        mobileNavigationOpen ? "translate-x-0" : "-translate-x-full invisible lg:visible"
      )}>
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black text-foreground tracking-tighter">
              Quiz<span className="text-indigo-600">Master</span>
            </span>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menüyü kapat" onClick={() => setMobileNavigationOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {role === 'admin' && <AcademicYearSelector />}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavigationOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors group",
                location === item.href
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                location === item.href ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
              )} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      )}

      {/* Main Content */}
      <main data-dashboard-main inert={mobileNavigationOpen ? true : undefined} aria-hidden={mobileNavigationOpen ? true : undefined} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!hideNavigation && (
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-card/95 px-4 backdrop-blur sm:px-6 lg:justify-end lg:px-8 print:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Menüyü aç"
            ref={menuTriggerRef}
            aria-expanded={mobileNavigationOpen}
            aria-controls="dashboard-navigation"
            onClick={() => setMobileNavigationOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
          {/* Notification Bell with Popover */}
          {liveContext && <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Bildirimleri aç" className="relative rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                {notificationsMuted ? <VolumeX className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-4 w-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 sm:w-96 p-0 rounded-2xl shadow-2xl border-border/60 overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-4 border-b bg-muted/20 dark:bg-muted/5 flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-wider">Bildirimler</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    aria-label={notificationsMuted ? "Bildirimlerin sesini aç" : "Bildirimleri sessize al"}
                    title={notificationsMuted ? "Bildirimlerin sesini aç" : "Bildirimleri sessize al"}
                    disabled={muteNotificationsMutation.isPending}
                    onClick={() => muteNotificationsMutation.mutate(!notificationsMuted)}
                  >
                    {notificationsMuted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] font-bold rounded-lg"
                    disabled={markAllReadMutation.isPending}
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    Hepsini Oku
                  </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                {notificationsLoading ? (
                  <div role="status" className="py-16 text-center text-xs text-muted-foreground">Bildirimler yükleniyor...</div>
                ) : notificationsError ? (
                  <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center text-xs">
                    <p>Bildirimler yüklenemedi.</p>
                    <Button variant="outline" size="sm" disabled={notificationsFetching} onClick={() => retryNotifications()}>Yeniden dene</Button>
                  </div>
                ) : notifications.length > 0 ? (
                  <div className="divide-y divide-border/40">
                    {notifications.map((n: any) => (
                      <div key={n.id} className={cn(
                        "p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-4",
                        !n.isRead && "bg-indigo-50/30 dark:bg-indigo-900/10"
                      )}>
                        <div className={cn(
                          "mt-1 p-2 rounded-lg",
                          n.type === 'announcement' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                          n.type === 'success' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        )}>
                          {n.type === 'announcement' ? <Megaphone className="h-4 w-4" /> :
                           n.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
                           <Bell className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-black leading-none">{n.title}</p>
                            <div className="flex shrink-0 items-center gap-1">
                              {!n.isRead && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Bildirimi sil"
                                disabled={deleteNotificationMutation.isPending}
                                onClick={() => deleteNotificationMutation.mutate(n.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{n.message || n.content}</p>
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3" /> {format(new Date(n.createdAt), "d MMM, HH:mm", { locale: tr })}
                            </p>
                            {n.type === 'announcement' && (
                              <Link href="/announcements" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:underline">
                                Detay <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Bell className="h-10 w-10 text-muted-foreground opacity-20 mb-3" />
                    <p className="text-xs font-bold text-muted-foreground">Henüz bildirim yok</p>
                  </div>
                )}
              </ScrollArea>
              <div className="p-3 border-t bg-slate-50 dark:bg-slate-800/20 text-center">
                <Link href="/settings?tab=notifications" className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-tighter">
                  Tüm Bildirimleri Gör
                </Link>
              </div>
            </PopoverContent>
          </Popover>}

          {/* Theme Toggle */}
          <ThemeToggle />

          <div className="h-8 w-[1px] bg-slate-100 dark:bg-slate-700 mx-1" />

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 rounded-xl px-3 py-2 h-auto text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-black text-sm text-indigo-600 dark:text-indigo-300">
                  {user?.name?.[0].toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 leading-none">{user?.name}</span>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{role === 'admin' ? 'Yönetici' : role === 'teacher' ? 'Öğretmen' : role === 'parent' ? 'Veli' : 'Öğrenci'}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl shadow-xl border-border/60 p-1.5">
              <DropdownMenuLabel className="px-3 py-2">
                <p className="text-sm font-black text-foreground">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground font-medium truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-xl cursor-pointer gap-2 font-semibold">
                <Link href="/settings">
                  <UserCircle className="h-4 w-4 text-indigo-500" />
                  Profilim
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="rounded-xl cursor-pointer gap-2 font-semibold text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
              >
                <LogOut className="h-4 w-4" />
                Güvenli Çıkış
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        )}

        <div data-print-content className="flex-1 overflow-y-auto px-3.5 py-4 custom-scrollbar sm:px-5 sm:py-5 lg:px-6">
          <div className="print-masthead hidden">
            <div>
              <strong>QuizMaster</strong>
              <span> Yönetim ve Sınav Sistemi</span>
            </div>
            <div>{user?.name} · {role === 'admin' ? 'Yönetici' : role === 'teacher' ? 'Öğretmen' : role === 'parent' ? 'Veli' : 'Öğrenci'}</div>
          </div>
          <div className="dashboard-page mx-auto w-full max-w-[1600px]">
            {role === 'admin' && academic?.pending ? <p role="status">Eğitim yılı doğrulanıyor…</p> : role === 'admin' && academic?.error ? <div role="alert"><p>{academic.error}</p><Button onClick={academic.reload}>Yeniden dene</Button>{academic.years.find(year => year.status === 'active') && <Button variant="outline" onClick={() => void academic.selectYear(academic.years.find(year => year.status === 'active')!.id)}>Aktif yıla dön</Button>}</div> : historical ? <HistoricalWorkspace /> : children}
          </div>
        </div>
      </main>
    </div>
  );
}

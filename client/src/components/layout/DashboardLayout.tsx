import { ReactNode, useState } from "react";
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
  XCircle,
  Clock,
  ExternalLink
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
import { Badge } from "@/components/ui/badge";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { user, role, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: notificationsData } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: () => notificationApi.getUserNotifications(),
    refetchInterval: 60000,
    enabled: !!user
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const menuItems = [
    { label: "Dashboard", href: role === 'student' ? "/student/dashboard" : "/", icon: LayoutDashboard },
    ...(role === 'student' ? [
      { label: "Sınavlarım", href: "/student/quizzes", icon: FileText },
      { label: "Sonuçlarım", href: "/student/results", icon: ListChecks },
      { label: "İstatistiklerim", href: "/my-stats", icon: BarChart3 },
    ] : []),
    ...(role === 'teacher' ? [
      { label: "Sınavlarım", href: "/quizzes", icon: FileText },
      { label: "İstatistikler", href: "/my-stats", icon: BarChart3 },
      { label: "Sınav Sonuçları", href: "/results", icon: ListChecks },
      { label: "Öğrenciler", href: "/students", icon: Users },
      { label: "Sınıflarım", href: "/classlist", icon: GraduationCap },
    ] : []),
    ...(role === 'admin' ? [
      { label: "Sınav Yönetimi", href: "/admin-quizzes", icon: ShieldCheck },
      { label: "Sınavlar", href: "/quizzes", icon: FileText },
      { label: "İstatistikler", href: "/my-stats", icon: BarChart3 },
      { label: "Sınav Sonuçları", href: "/results", icon: ListChecks },
      { label: "Öğrenciler", href: "/students", icon: Users },
      { label: "Eğitmenler", href: "/teachers", icon: Briefcase },
      { label: "Sınıflar", href: "/classlist", icon: GraduationCap },
      { label: "Yönetim", href: "/management", icon: Settings },
      { label: "Arşiv", href: "/archive", icon: Archive },
    ] : []),
    { label: "Duyurular", href: "/announcements", icon: Megaphone },
    { label: "Ayarlar", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white dark:bg-slate-900 flex flex-col shadow-sm print:hidden">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
              Quiz<span className="text-indigo-600">Master</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group",
                location === item.href
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600"
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-white dark:bg-slate-900 flex items-center justify-end px-8 gap-3 print:hidden">
          {/* Notification Bell with Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Bell className="h-5 w-5" />
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
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] font-bold rounded-lg"
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    Hepsini Oku
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[400px]">
                {notifications.length > 0 ? (
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
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black leading-none">{n.title}</p>
                            {!n.isRead && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
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
                <Link href="/announcements" className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-tighter">
                  Tüm Duyuruları Gör
                </Link>
              </div>
            </PopoverContent>
          </Popover>

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
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{role === 'admin' ? 'Yönetici' : role === 'teacher' ? 'Eğitmen' : 'Öğrenci'}</span>
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
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}

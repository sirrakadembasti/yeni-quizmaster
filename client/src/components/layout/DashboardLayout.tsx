import { ReactNode } from "react";
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
  Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { user, role, logout } = useAuth();

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      return res.json();
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const unreadCount = notificationsData?.notifications?.filter((n: any) => !n.isRead).length || 0;

  const menuItems = [
    { label: "Dashboard", href: role === 'student' ? "/student/dashboard" : "/", icon: LayoutDashboard },
    ...(role === 'student' ? [
      { label: "Sınavlarım", href: "/student/quizzes", icon: FileText },
      { label: "Sonuçlarım", href: "/student/results", icon: ListChecks },
      { label: "İstatistikler", href: "/my-stats", icon: BarChart3 },
    ] : []),
    ...(role === 'teacher' ? [
      { label: "Sınavlarım", href: "/quizzes", icon: FileText },
      { label: "Sonuçlar", href: "/results", icon: ListChecks },
      { label: "Öğrenciler", href: "/students", icon: Users },
      { label: "Sınıflarım", href: "/classlist", icon: GraduationCap },
    ] : []),
    ...(role === 'admin' ? [
      { label: "Sınav Yönetimi", href: "/admin-quizzes", icon: ShieldCheck },
      { label: "Sınavlar", href: "/quizzes", icon: FileText },
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
      <aside className="w-64 border-r bg-white dark:bg-slate-900 flex flex-col shadow-sm">
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
                  : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
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

        <div className="p-4 border-t bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
              {user?.name?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate leading-none">{user?.name}</p>
              <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1 tracking-widest">{role}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => logout()}
            className="w-full justify-start gap-3 mt-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 font-bold"
          >
            <LogOut className="h-5 w-5" /> Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-white dark:bg-slate-900 flex items-center justify-end px-8 gap-4">
          <div className="relative">
            <Button variant="ghost" size="icon" className="rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50" asChild>
              <Link href="/announcements">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-4 w-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </Button>
          </div>
          <div className="h-8 w-[1px] bg-slate-100 mx-2" />
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-slate-400" />
            <span className="text-xs font-black uppercase text-slate-500">{user?.name}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}

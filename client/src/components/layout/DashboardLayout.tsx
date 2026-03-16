import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  BarChart2, 
  Settings, 
  Users,
  Search,
  Bell,
  Menu,
  GraduationCap,
  History,
  Moon,
  Sun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";


interface DashboardLayoutProps {
  children: React.ReactNode;
  hideNavigation?: boolean;
}

export function DashboardLayout({ children, hideNavigation = false }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { role, user, logout } = useAuth();

  useEffect(() => {
    // Check initial theme preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return newMode;
    });
  };

  // Role based navigation config
  const adminNavigation = [
    { name: "Genel Bakış", href: "/", icon: LayoutDashboard },
    { name: "Sınavlarım", href: "/quizzes", icon: FileText },
    { name: "Yeni Sınav Oluştur", href: "/create-quiz", icon: PlusCircle },
    { name: "Sonuçlar & Analiz", href: "/results", icon: BarChart2 },
    { name: "Sınıflar", href: "/students", icon: Users },
    { name: "Öğretmenler", href: "/teachers", icon: Users },
    { name: "Ayarlar", href: "/settings", icon: Settings },
  ];

  const studentNavigation = [
    { name: "Panelim", href: "/", icon: LayoutDashboard },
    { name: "Sınavlarım", href: "/my-quizzes", icon: GraduationCap },
    { name: "Sonuçlarım", href: "/my-results", icon: History },
    { name: "İstatistikler", href: "/my-stats", icon: BarChart2 },
    { name: "Profil ve Ayarlar", href: "/settings", icon: Settings },
  ];

  // Teacher navigation: hide the full teachers management page for teacher role
  const teacherNavigation = adminNavigation.filter(item => item.name !== "Öğretmenler" && item.href !== "/teachers");

  const navigation = role === 'student' ? studentNavigation : 
                     role === 'teacher' ? teacherNavigation : 
                     adminNavigation;

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="p-6">
        <div className="flex items-center gap-2 font-heading font-bold text-2xl text-primary">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            S
          </div>
          SınavMaster
        </div>
        <div className="mt-2 px-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border border-border rounded-full px-2 py-0.5">
            {role === 'admin' ? 'Yönetici' : role === 'teacher' ? 'Öğretmen' : 'Öğrenci'} Paneli
          </span>
        </div>
      </div>
      <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="p-4 border-t border-border">
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex text-foreground print:bg-white print:text-black">
      {/* Desktop Sidebar */}
      {!hideNavigation && (
        <div className="hidden md:block w-64 shrink-0 h-screen sticky top-0 print:hidden">
          <SidebarContent />
        </div>
      )}

      {/* Mobile Sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r border-border print:hidden">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 print:w-full print:m-0 print:p-0">
        {/* Header */}
        {!hideNavigation && (
          <header className="h-16 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="relative hidden sm:block max-w-md w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={role === 'student' ? "Sınav ara..." : "Sınav veya öğrenci ara..."}
                  className="pl-9 h-9 bg-background/50 border-transparent focus:border-input focus:bg-background transition-all" 
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              
              <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-card" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1 sm:ml-0">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`} alt={user?.name || 'User'} />
                      <AvatarFallback>{user?.name?.substring(0,2).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email || ''}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation('/settings')}>Profil ve Ayarlar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={logout}>Çıkış Yap</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className={cn(
          "flex-1 p-6 md:p-8 w-full animate-in fade-in-50 duration-500 print:p-0 print:max-w-none",
          hideNavigation ? "max-w-5xl mx-auto" : "max-w-7xl mx-auto"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/lib/api";
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
  Archive,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";


import { ThemeToggle } from "./ThemeToggle";


interface DashboardLayoutProps {
  children: React.ReactNode;
  hideNavigation?: boolean;
}

export function DashboardLayout({ children, hideNavigation = false }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { role, user, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: notificationData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getNotifications(),
    refetchInterval: 30000, // Poll every 30 seconds
    enabled: !!user,
  });

  const markAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notificationData?.notifications || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Role based navigation config
  const adminNavigation = [
    { name: "Genel Bakış", href: "/", icon: LayoutDashboard },
    { name: "Yönetim Paneli", href: "/management", icon: Settings },
    { name: "Arşiv İşlemleri", href: "/archive", icon: Archive },
    { name: "Tüm Sınavlar", href: "/admin-quizzes", icon: FileText },
    { name: "Sınavlarım", href: "/quizzes", icon: FileText },
    { name: "Yeni Sınav Oluştur", href: "/create-quiz", icon: PlusCircle },
    { name: "Sınıflar", href: "/classlist", icon: Users },
    { name: "Öğrenciler", href: "/students", icon: Users },
    { name: "Öğretmenler", href: "/teachers", icon: Users },
    { name: "İstatistikler", href: "/results", icon: BarChart2 },
    { name: "Ayarlar", href: "/settings", icon: Settings },
  ];

  const studentNavigation = [
    { name: "Panelim", href: "/", icon: LayoutDashboard },
    { name: "Sınavlarım", href: "/my-quizzes", icon: GraduationCap },
    { name: "Sonuçlarım", href: "/my-results", icon: History },
    { name: "İstatistikler", href: "/my-stats", icon: BarChart2 },
    { name: "Profil ve Ayarlar", href: "/settings", icon: Settings },
  ];

  const teacherNavigation = [
    { name: "Genel Bakış", href: "/", icon: LayoutDashboard },
    { name: "Sınavlarım", href: "/quizzes", icon: FileText },
    { name: "Yeni Sınav Oluştur", href: "/create-quiz", icon: PlusCircle },
    { name: "Sınıflarım", href: "/classlist", icon: Users },
    { name: "Öğrenciler", href: "/students", icon: Users },
    { name: "İstatistikler", href: "/results", icon: BarChart2 },
    { name: "Ayarlar", href: "/settings", icon: Settings },
  ];

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
                    ? "bg-primary/10 text-primary shadow-sm dark:shadow-none"
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
    <div className="min-h-screen bg-background flex text-foreground print:bg-white dark:bg-background print:text-black">
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
          <header className="h-16 border-b border-border bg-card sticky top-0 z-30 px-6 flex items-center justify-between print:hidden">
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
              <ThemeToggle />
              
              <Popover onOpenChange={(open) => { if(open && unreadCount > 0) markAsReadMutation.mutate(); }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-card" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="p-4 border-b">
                    <h4 className="font-semibold">Bildirimler</h4>
                  </div>
                  <ScrollArea className="h-80">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-sm text-center text-muted-foreground">
                        Henüz bildiriminiz yok.
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {notifications.map((notif: any) => (
                          <div key={notif.id} className={cn("p-4 border-b text-sm transition-colors hover:bg-muted/50", !notif.isRead && "bg-primary/5")}>
                            <p className="font-medium">{notif.title}</p>
                            <p className="text-muted-foreground mt-1">{notif.message}</p>
                            <span className="text-xs text-muted-foreground mt-2 block">
                              {new Date(notif.createdAt).toLocaleString('tr-TR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              
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

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  MoreHorizontal, 
  Filter, 
  Download,
  Mail,
  UserPlus,
  Loader2
} from "lucide-react";
import { useState, useMemo } from "react";
import { userApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Teacher {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function TeachersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const teachers = useMemo(() => {
    if (!usersData?.users) return [];
    return usersData.users.filter(u => u.role === 'teacher');
  }, [usersData]);

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string, role: string }) => 
      userApi.updateUserRole(userId, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Başarılı",
        description: `Kullanıcı rolü ${variables.role} olarak güncellendi`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-800",
      });
      setShowRoleDialog(false);
      setSelectedTeacher(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Rol güncellenemedi",
      });
    }
  });

  const handleChangeRole = () => {
    if (!selectedTeacher || !newRole) return;
    updateRoleMutation.mutate({ userId: selectedTeacher.id, role: newRole });
  };

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">Öğretmenler</h1>
            <p className="text-muted-foreground mt-1">Öğretmen hesaplarını yönetin ve rol değişikliği yapın</p>
          </div>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Yeni Öğretmen
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ad veya e-posta ile ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">Toplam Öğretmen</p>
            <p className="text-2xl font-bold">{teachers.length}</p>
          </div>
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">Aktif Öğretmen</p>
            <p className="text-2xl font-bold">{teachers.length}</p>
          </div>
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">Bekleyen İstekler</p>
            <p className="text-2xl font-bold">0</p>
          </div>
        </div>

        {/* Teachers Table */}
        <div className="border rounded-lg bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Ad</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border">
                            <AvatarImage 
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${teacher.name}`}
                              alt={teacher.name}
                            />
                            <AvatarFallback>{teacher.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{teacher.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{teacher.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Öğretmen
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              setSelectedTeacher(teacher);
                              setNewRole(teacher.role);
                              setShowRoleDialog(true);
                            }}>
                              Rolü Değiştir
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              E-posta Gönder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              Sil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                      Öğretmen bulunamadı
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolü Değiştir</DialogTitle>
            <DialogDescription>
              {selectedTeacher?.name} kullanıcısının sistemdeki yetkisini güncelleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Yeni Rol</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Öğrenci</SelectItem>
                  <SelectItem value="teacher">Öğretmen</SelectItem>
                  <SelectItem value="admin">Yönetici</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              İptal
            </Button>
            <Button 
              onClick={handleChangeRole} 
              disabled={!newRole || newRole === selectedTeacher?.role || updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

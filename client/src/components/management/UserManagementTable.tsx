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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Eye 
} from "lucide-react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  classId?: string | null;
  classNo?: string | null;
  studentNo?: number | null;
  assignedCategories?: { id: string; name: string }[];
  classes?: { id: string; name: string }[];
  // Öğretmenin classTeacherId üzerinden sorumlu olduğu sınıflar
  responsibleForClasses?: { id: string; name: string }[];
  parentName?: string | null;
  parentRelation?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  parentAddress?: string | null;
}

interface UserManagementTableProps {
  users: User[];
  isLoading: boolean;
  role: 'teacher' | 'student';
  classes?: any[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onDetails?: (user: User) => void;
  canManage: boolean;
}

export function UserManagementTable({
  users,
  isLoading,
  role,
  classes,
  onEdit,
  onDelete,
  onDetails,
  canManage
}: UserManagementTableProps) {
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>İsim</TableHead>
            {/* Öğretmenler için E-posta yerine Sorumlu Sınıf göster */}
            <TableHead>{role === 'teacher' ? 'Sınıf Öğretmenliği' : 'E-posta'}</TableHead>
            {role === 'student' ? (
              <>
                <TableHead>Sınıf</TableHead>
                <TableHead>Numara</TableHead>
              </>
            ) : (
              <>
                <TableHead>Atanan Branşlar</TableHead>
                <TableHead>Dersine Girdiği Sınıflar</TableHead>
              </>
            )}
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={role === 'student' ? 6 : 6} className="h-32 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={role === 'student' ? 6 : 6} className="h-32 text-center text-muted-foreground">
                Kullanıcı bulunamadı.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>
                  {role === 'teacher' ? (
                    user.responsibleForClasses && user.responsibleForClasses.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.responsibleForClasses.map(cls => (
                          <Badge key={cls.id} variant="secondary" className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {cls.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Yok</span>
                    )
                  ) : (
                    user.email
                  )}
                </TableCell>
                {role === 'student' ? (
                  <>
                    <TableCell>
                      <Badge variant="outline" className="font-bold">
                        {classes?.find((c: any) => c.id === user.classId)?.name || 'Atanmamış'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-indigo-600">
                      {user.studentNo ? `#${user.studentNo}` : (user.classNo || '-')}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.assignedCategories && user.assignedCategories.length > 0 ? (
                          user.assignedCategories.map(cat => (
                            <Badge key={cat.id} variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                              {cat.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Yok</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.classes && user.classes.filter(c => !user.responsibleForClasses?.some(rc => rc.id === c.id)).length > 0 ? (
                          user.classes.filter(c => !user.responsibleForClasses?.some(rc => rc.id === c.id)).map(cls => (
                            <Badge key={cls.id} variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                              {cls.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Yok</span>
                        )}
                      </div>
                    </TableCell>
                  </>
                )}
                <TableCell>
                  <Badge variant="secondary" className={role === 'teacher' ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}>
                    {role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {onDetails && (
                      <Button variant="outline" size="sm" onClick={() => onDetails(user)} className="gap-1.5 h-8">
                        <Eye className="h-3.5 w-3.5" /> Detaylar
                      </Button>
                    )}
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onEdit(user)} className="cursor-pointer">
                            <Edit2 className="h-4 w-4 mr-2" /> Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete(user)} className="cursor-pointer text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

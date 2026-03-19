import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { type User } from "./UserManagementTable";
import { useQuery } from "@tanstack/react-query";
import { classApi, categoryApi } from "@/lib/api";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface UserFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  initialData?: User | null;
  mode: 'create' | 'edit';
  role: 'teacher' | 'student';
  isPending: boolean;
}

export function UserFormModal({
  isOpen,
  onOpenChange,
  onSubmit,
  initialData,
  mode,
  role,
  isPending
}: UserFormModalProps) {
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    classNo: "", 
    classId: "", 
    classIds: [] as string[],
    assignedCategoryIds: [] as string[] 
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAllClasses(),
    enabled: isOpen
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAllCategories(),
    enabled: isOpen
  });

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        name: initialData.name, 
        email: initialData.email, 
        password: "", 
        classNo: initialData.classNo || "",
        classId: initialData.classId || "",
        classIds: (initialData as any).classes?.map((c: any) => c.id) || [],
        assignedCategoryIds: initialData.assignedCategories?.map(c => c.id) || []
      });
    } else {
      setFormData({ 
        name: "", 
        email: "", 
        password: "", 
        classNo: "", 
        classId: "", 
        classIds: [],
        assignedCategoryIds: [] 
      });
    }
  }, [initialData, isOpen]);

  const toggleCategory = (id: string) => {
    setFormData(prev => ({
      ...prev,
      assignedCategoryIds: prev.assignedCategoryIds.includes(id)
        ? prev.assignedCategoryIds.filter(itemId => itemId !== id)
        : [...prev.assignedCategoryIds, id]
    }));
  };

  const toggleClass = (id: string) => {
    setFormData(prev => ({
      ...prev,
      classIds: prev.classIds.includes(id)
        ? prev.classIds.filter(itemId => itemId !== id)
        : [...prev.classIds, id]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? `Yeni ${role === 'teacher' ? 'Öğretmen' : 'Öğrenci'} Ekle` : `${role === 'teacher' ? 'Öğretmeni' : 'Öğrenciyi'} Düzenle`}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? `Sisteme yeni bir ${role === 'teacher' ? 'öğretmen' : 'öğrenci'} hesabı tanımlayın.` 
              : `Kullanıcı bilgilerini güncelleyin. ${mode === 'edit' ? 'Şifreyi değiştirmek istemiyorsanız boş bırakın.' : ''}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>İsim Soyisim</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-posta Adresi</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
          </div>

          {role === 'student' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Öğrenci Numarası</Label>
                <Input value={formData.classNo} onChange={e => setFormData({ ...formData, classNo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sınıf</Label>
                <Select value={formData.classId} onValueChange={val => setFormData({ ...formData, classId: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sınıf Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sınıf Yok</SelectItem>
                    {classesData?.classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Yetkili Olduğu Dersler</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {formData.assignedCategoryIds.map(id => {
                    const cat = categoriesData?.find(c => c.id === id);
                    return cat ? (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1">
                        {cat.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleCategory(id)} />
                      </Badge>
                    ) : null;
                  })}
                </div>
                <ScrollArea className="h-[100px] border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {categoriesData?.map(cat => (
                      <div key={cat.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cat-${cat.id}`} 
                          checked={formData.assignedCategoryIds.includes(cat.id)}
                          onCheckedChange={() => toggleCategory(cat.id)}
                        />
                        <label htmlFor={`cat-${cat.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {cat.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Sorumlu Olduğu Sınıflar</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {formData.classIds.map(id => {
                    const cls = classesData?.classes.find(c => c.id === id);
                    return cls ? (
                      <Badge key={id} variant="outline" className="flex items-center gap-1 border-primary/30 text-primary">
                        {cls.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleClass(id)} />
                      </Badge>
                    ) : null;
                  })}
                </div>
                <ScrollArea className="h-[100px] border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {classesData?.classes.map(cls => (
                      <div key={cls.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cls-${cls.id}`} 
                          checked={formData.classIds.includes(cls.id)}
                          onCheckedChange={() => toggleClass(cls.id)}
                        />
                        <label htmlFor={`cls-${cls.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {cls.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>{mode === 'create' ? 'Şifre' : 'Yeni Şifre (İsteğe Bağlı)'}</Label>
            <Input type="password" placeholder={mode === 'edit' ? "Değiştirmek istemiyorsanız boş bırakın" : ""} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button 
            onClick={() => {
              const submissionData = { ...formData };
              if (submissionData.classId === "none") submissionData.classId = "";
              onSubmit(submissionData);
            }} 
            disabled={isPending || !formData.name || !formData.email || (mode === 'create' && !formData.password)}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Oluştur' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

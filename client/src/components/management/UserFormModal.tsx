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
import { Loader2, X, AlertTriangle, Book, School, Info } from "lucide-react";
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
  teacherEditScope?: 'all' | 'assignments' | 'profile';
}

export function UserFormModal({
  isOpen,
  onOpenChange,
  onSubmit,
  initialData,
  mode,
  role,
  isPending,
  teacherEditScope = 'all'
}: UserFormModalProps) {
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    phoneNumber: "",
    address: "",
    password: "", 
    classNo: "", 
    classId: "", 
    classIds: [] as string[],
    assignedCategoryIds: [] as string[],
    parentName: "",
    parentRelation: "",
    parentPhone: "",
    parentEmail: "",
    parentAddress: ""
  });

  const { data: classesData } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: () => classApi.getAllClasses(),
    enabled: isOpen
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: () => categoryApi.getAllCategories(),
    enabled: isOpen
  });

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        name: initialData.name, 
        email: initialData.email, 
        phoneNumber: initialData.phoneNumber || "",
        address: initialData.address || "",
        password: "", 
        classNo: initialData.classNo || "",
        classId: initialData.classId || "",
        classIds: initialData.managedClasses?.map((c) => c.id) || (initialData as any).classIds || [],
        assignedCategoryIds: initialData.assignedCategories?.map(c => c.id) || (initialData as any).assignedCategoryIds || [],
        parentName: initialData.parentName || "",
        parentRelation: initialData.parentRelation || "",
        parentPhone: initialData.parentPhone || "",
        parentEmail: initialData.parentEmail || "",
        parentAddress: initialData.parentAddress || ""
      });
    } else {
      setFormData({ 
        name: "", 
        email: "", 
        phoneNumber: "",
        address: "",
        password: "", 
        classNo: "", 
        classId: "", 
        classIds: [],
        assignedCategoryIds: [],
        parentName: "",
        parentRelation: "",
        parentPhone: "",
        parentEmail: "",
        parentAddress: ""
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

  const allCategories = categoriesData || [];
  const allClasses = classesData?.classes || [];
  const showTeacherProfile = role !== 'teacher' || mode === 'create' || teacherEditScope !== 'assignments';
  const showTeacherAssignments = role !== 'teacher' || mode === 'create' || teacherEditScope !== 'profile';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[95vh] flex flex-col rounded-3xl p-0 border-none shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <div className="bg-white dark:bg-slate-900/10 p-2 rounded-xl">
                {role === 'teacher' ? <Book className="h-6 w-6" /> : <School className="h-6 w-6" />}
              </div>
              {mode === 'create' ? `Yeni ${role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}` : `${role === 'teacher' ? 'Öğretmen' : 'Öğrenci'} Düzenle`}
            </DialogTitle>
            <DialogDescription className="text-slate-300 font-medium">
              {mode === 'create' 
                ? "Sisteme erişimi olacak yeni kullanıcı hesabını tanımlayın." 
                : "Kullanıcı profil bilgilerini ve yetkilerini güncelleyin."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form id="user-form" onSubmit={(e) => {
          e.preventDefault();
          let submissionData: any = { ...formData };
          if (role === 'teacher' && mode === 'edit' && teacherEditScope === 'assignments') {
            submissionData = { assignedCategoryIds: formData.assignedCategoryIds, classIds: formData.classIds };
          } else if (role === 'teacher' && mode === 'edit' && teacherEditScope === 'profile') {
            submissionData = {
              name: formData.name,
              email: formData.email,
              phoneNumber: formData.phoneNumber,
              address: formData.address,
              ...(formData.password ? { password: formData.password } : {}),
            };
          }
          if (submissionData.classId === "none") submissionData.classId = "";
          onSubmit(submissionData);
        }} className="p-6 space-y-6 bg-white dark:bg-slate-900 flex-1 overflow-y-auto min-h-0">
          {showTeacherProfile && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">Tam İsim</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="Örn: Ahmet Yılmaz"
                className="rounded-xl border-slate-200 dark:border-slate-700 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">E-posta Adresi</Label>
              <Input 
                type="email" 
                value={formData.email} 
                onChange={e => setFormData({ ...formData, email: e.target.value })} 
                placeholder="ornek@okul.com"
                className="rounded-xl border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>}

          {role === 'teacher' && showTeacherProfile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Telefon</Label>
                <Input value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="05xx xxx xx xx" className="rounded-xl" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Adres</Label>
                <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="İletişim adresi" className="rounded-xl" />
              </div>
            </div>
          )}

          {role === 'student' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-60">Sınıf No</Label>
                  <Input 
                    value={formData.classNo} 
                    onChange={e => setFormData({ ...formData, classNo: e.target.value })} 
                    placeholder="Örn: 1234"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-60">Kayıtlı Sınıf</Label>
                  <Select value={formData.classId} onValueChange={val => setFormData({ ...formData, classId: val })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Sınıf Seçin" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">Sınıf Atanmamış</SelectItem>
                      {allClasses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-relaxed font-medium">
                  <strong>Önemli:</strong> Öğrenciler aynı anda sadece <strong>tek bir sınıfa</strong> kayıtlı olabilir. Başka bir sınıf seçerseniz öğrenci otomatik olarak eski sınıfından ayrılacaktır.
                </div>
              </div>

              {/* İletişim amaçlı veli kaydı; giriş hesabı değildir. */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Veli İletişim Bilgileri (Giriş Hesabı Değildir)</span>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-medium text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                  Bu alanlar yalnızca okulun iletişim kaydıdır. Uygulamaya giriş yapıp öğrenciyi takip edecek veli hesabını, öğrenci detayındaki <strong>Veli Hesapları</strong> bölümünden oluşturun veya bağlayın.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Veli Adı Soyadı</Label>
                    <Input
                      value={formData.parentName}
                      onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                      placeholder="Örn: Mehmet Yılmaz"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Yakınlık Derecesi</Label>
                    <Input
                      value={formData.parentRelation}
                      onChange={e => setFormData({ ...formData, parentRelation: e.target.value })}
                      placeholder="Örn: Anne / Baba / Vasi"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Veli Telefonu</Label>
                    <Input
                      value={formData.parentPhone}
                      onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                      placeholder="05xx xxx xx xx"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Veli E-Posta</Label>
                    <Input
                      type="email"
                      value={formData.parentEmail}
                      onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
                      placeholder="veli@example.com"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Veli Adresi</Label>
                    <Input
                      value={formData.parentAddress}
                      onChange={e => setFormData({ ...formData, parentAddress: e.target.value })}
                      placeholder="Ev / İş Adresi"
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : showTeacherAssignments ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-60">Yetkili Olduğu Dersler</Label>
                  <Badge variant="outline" className="text-[10px]">{formData.assignedCategoryIds.length} Seçili</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {formData.assignedCategoryIds.map(id => {
                    const cat = allCategories.find(c => c.id === id);
                    return cat ? (
                      <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 py-1 rounded-lg bg-indigo-50 text-indigo-700 border-indigo-100 font-bold">
                        {cat.name}
                        <X className="h-3 w-3 cursor-pointer hover:text-rose-500" onClick={() => toggleCategory(id)} />
                      </Badge>
                    ) : null;
                  })}
                  {formData.assignedCategoryIds.length === 0 && <span className="text-[10px] text-muted-foreground italic">Henüz ders seçilmedi.</span>}
                </div>
                <ScrollArea className="h-[120px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 dark:bg-slate-800/50 rounded-2xl p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {allCategories.map(cat => (
                      <div key={cat.id} className="flex items-center space-x-2 group">
                        <Checkbox 
                          id={`cat-${cat.id}`} 
                          checked={formData.assignedCategoryIds.includes(cat.id)}
                          onCheckedChange={() => toggleCategory(cat.id)}
                          className="rounded-md border-slate-300 data-[state=checked]:bg-indigo-600"
                        />
                        <label htmlFor={`cat-${cat.id}`} className="text-xs font-bold leading-none cursor-pointer group-hover:text-indigo-600 transition-colors">
                          {cat.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-60">Dersine Girdiği Sınıflar</Label>
                  <Badge variant="outline" className="text-[10px]">{formData.classIds.length} Seçili</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {formData.classIds.map(id => {
                    const cls = allClasses.find(c => c.id === id);
                    return cls ? (
                      <Badge key={id} variant="outline" className="gap-1 pl-2 pr-1 py-1 rounded-lg border-emerald-200 text-emerald-700 bg-emerald-50 font-bold">
                        {cls.name}
                        <X className="h-3 w-3 cursor-pointer hover:text-rose-500" onClick={() => toggleClass(id)} />
                      </Badge>
                    ) : null;
                  })}
                  {formData.classIds.length === 0 && <span className="text-[10px] text-muted-foreground italic">Henüz sınıf seçilmedi.</span>}
                </div>
                <ScrollArea className="h-[120px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 dark:bg-slate-800/50 rounded-2xl p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {allClasses.map(cls => (
                      <div key={cls.id} className="flex items-center space-x-2 group">
                        <Checkbox 
                          id={`cls-${cls.id}`} 
                          checked={formData.classIds.includes(cls.id)}
                          onCheckedChange={() => toggleClass(cls.id)}
                          className="rounded-md border-slate-300 data-[state=checked]:bg-emerald-600"
                        />
                        <label htmlFor={`cls-${cls.id}`} className="text-xs font-bold leading-none cursor-pointer group-hover:text-emerald-600 transition-colors">
                          {cls.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : null}

          {showTeacherProfile && <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">
                {role === 'student' ? (mode === 'create' ? 'Öğrenci Hesabı Şifresi' : 'Öğrenci Hesabı Şifresini Güncelle') : (mode === 'create' ? 'Güvenli Şifre' : 'Şifreyi Güncelle')}
              </Label>
              {mode === 'edit' && (
                <div className="group relative">
                  <Info className="h-3 w-3 text-muted-foreground" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Şifreyi değiştirmek istemiyorsanız bu alanı boş bırakın.
                  </div>
                </div>
              )}
            </div>
            <Input 
              type="password" 
              placeholder={mode === 'edit' ? "••••••" : "En az 6 karakter"} 
              value={formData.password} 
              onChange={e => setFormData({ ...formData, password: e.target.value })} 
              className="rounded-xl border-slate-200 dark:border-slate-700"
            />
          </div>}
        </form>

        <DialogFooter className="bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-900/50 p-6 rounded-b-3xl border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={() => onOpenChange(false)} type="button" className="rounded-xl font-bold">Vazgeç</Button>
          <Button 
            type="submit"
            form="user-form"
            disabled={isPending || !formData.name || !formData.email || (mode === 'create' && !formData.password)}
            className="rounded-xl font-black px-8 shadow-xl shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Hesabı Oluştur' : 'Değişiklikleri Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

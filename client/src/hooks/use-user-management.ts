import { invalidateAdminRelations } from '@/lib/admin-cache';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { type User } from "@/components/management/UserManagementTable";

export function useUserManagement(role: 'teacher' | 'student') {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => userApi.createUser({ ...data, role }),
    onSuccess: async () => {
      await invalidateAdminRelations(queryClient);
      toast({ title: "Başarılı", description: `${role === 'teacher' ? 'Öğretmen' : 'Öğrenci'} başarıyla eklendi.` });
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Hata", description: error.message || "İşlem başarısız." });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => userApi.updateUser(selectedUser!.id, data),
    onSuccess: async () => {
      await invalidateAdminRelations(queryClient);
      toast({ title: "Başarılı", description: "Bilgiler güncellendi." });
      setIsEditOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Hata", description: error.message || "Güncelleme başarısız." });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => userApi.deleteUser(selectedUser!.id),
    onSuccess: async () => {
      await invalidateAdminRelations(queryClient);
      toast({ title: "Başarılı", description: "Kullanıcı silindi." });
      setIsDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Hata", description: error.message || "Silme işlemi başarısız." });
    }
  });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  return {
    isCreateOpen, setIsCreateOpen,
    isEditOpen, setIsEditOpen,
    isDeleteOpen, setIsDeleteOpen,
    selectedUser, setSelectedUser,
    createMutation,
    updateMutation,
    deleteMutation,
    handleEdit,
    handleDelete
  };
}

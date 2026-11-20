import { z } from "zod";

// Yeni parola belirleyen tüm yollar (kayıt, değiştirme, sıfırlama, yönetici/öğretmenin kullanıcı oluşturması,
// profil güncelleme, veli hesabı) aynı alt sınırı kullanır. Mevcut parolalar etkilenmez.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_MESSAGE = `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır.`;
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE);

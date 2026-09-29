import { Badge } from "@/components/ui/badge";
import { Calendar, ShieldCheck, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface AnnouncementAuthorProps {
  creator?: {
    name?: string;
    role?: string;
  } | null;
  createdAt: string | Date;
  className?: string;
}

export function AnnouncementAuthor({ creator, createdAt, className = "" }: AnnouncementAuthorProps) {
  const role = creator?.role?.toLowerCase();
  const isAdmin = role === "admin";
  const roleLabel = isAdmin ? "Sistem Yöneticisi" : "Öğretmen";
  const authorName = creator?.name || "Bilinmeyen Kullanıcı";
  const initial = authorName[0]?.toUpperCase() || "?";

  const formattedDate = (() => {
    try {
      return format(new Date(createdAt), "d MMMM yyyy, HH:mm", { locale: tr });
    } catch {
      return new Date(createdAt).toLocaleDateString("tr-TR");
    }
  })();

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <div 
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-base shadow-sm ring-1 ${
          isAdmin 
            ? "bg-rose-50 text-rose-600 ring-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60" 
            : "bg-indigo-50 text-indigo-600 ring-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/60"
        }`}
      >
        {initial}
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">
            {authorName}
          </span>
          <Badge 
            variant="outline"
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              isAdmin
                ? "bg-rose-500/10 text-rose-700 border-rose-300/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                : "bg-indigo-500/10 text-indigo-700 border-indigo-300/70 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
            }`}
          >
            {isAdmin ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <GraduationCap className="h-3 w-3" />
            )}
            {roleLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 font-medium">
          <Calendar className="h-3 w-3 opacity-70" />
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

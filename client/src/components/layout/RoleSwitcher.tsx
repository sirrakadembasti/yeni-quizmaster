import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { UserCog } from "lucide-react";

export function RoleSwitcher() {
  const { role } = useAuth();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" className="shadow-lg rounded-full h-10 px-4 bg-slate-900 text-white hover:bg-slate-800 border-2 border-slate-700">
            <UserCog className="h-4 w-4 mr-2" />
            Rol: {role === 'admin' ? 'Yönetici' : role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

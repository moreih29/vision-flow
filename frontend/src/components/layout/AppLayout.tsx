import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="shrink-0 border-b select-none">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <button
            type="button"
            className="text-xl font-bold hover:opacity-70 transition-opacity"
            onClick={() => navigate("/")}
          >
            Vision Flow
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground select-text">
              {user?.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

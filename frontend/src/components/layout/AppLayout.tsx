import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

function getInitialTheme(): "dark" | "light" {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 0);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header
        className={`shrink-0 border-b select-none sticky top-0 z-50 bg-background/80 transition-shadow transition-[backdrop-filter] duration-150 ${scrolled ? "shadow-md backdrop-blur-md" : "shadow-sm"}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
          <button
            type="button"
            className="text-xl hover:opacity-70 transition-opacity"
            onClick={() => navigate("/")}
          >
            <span className="font-normal">Vision</span>
            <span className="font-bold text-primary"> Flow</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground select-text">
              {user?.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
              }
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
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

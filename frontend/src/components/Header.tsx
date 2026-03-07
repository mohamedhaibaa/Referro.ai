import { Search, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Welcome to</span>
        <h1 className="text-2xl font-serif font-bold text-foreground">Referoo</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <input type="text" placeholder="Search" className="w-64 h-11 pl-4 pr-12 rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <button className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
            <Search size={18} />
          </button>
        </div>

        <button className="w-11 h-11 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors">
          <Bell size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{user?.name ?? "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-11 h-11 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>;
};
export default Header;
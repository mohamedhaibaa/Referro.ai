import { Home, LayoutDashboard, Inbox, Briefcase, FileText, Settings, LogOut, Headphones, Zap } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCredits } from "@/hooks/useCredits";

const Sidebar = () => {
  const location = useLocation();
  const { data: credits } = useCredits();
  
  const navItems = [
    { icon: Home, label: "Home", to: "/" },
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
    { icon: Inbox, label: "Inbox", to: "/inbox" },
    { icon: Briefcase, label: "Jobs", to: "/jobs" },
    { icon: FileText, label: "Resume", to: "/resume" },
  ];

  const bottomItems = [
    { icon: Headphones, label: "Support", to: "/support" },
    { icon: Settings, label: "Settings", to: "/settings" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 bg-card border-r border-border flex flex-col items-center py-6 z-50">
      <div className="flex flex-col items-center gap-2 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              isActive(item.to)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={item.label}
          >
            <item.icon size={22} strokeWidth={isActive(item.to) ? 2 : 1.5} />
          </Link>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        {bottomItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              isActive(item.to)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title={item.label}
          >
            <item.icon size={22} strokeWidth={isActive(item.to) ? 2 : 1.5} />
          </Link>
        ))}
        {credits !== undefined && (
          <div
            className="w-12 flex flex-col items-center justify-center py-1.5 rounded-xl bg-muted/50 cursor-default"
            title={`${credits.creditsRemaining} credits remaining (${credits.planTier})`}
          >
            <Zap size={14} className="text-primary mb-0.5" />
            <span className="text-[11px] font-semibold text-foreground leading-none">
              {credits.creditsRemaining % 1 === 0
                ? credits.creditsRemaining.toFixed(0)
                : credits.creditsRemaining.toFixed(1)}
            </span>
          </div>
        )}
        <button className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all mt-2" title="Log out">
          <LogOut size={22} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

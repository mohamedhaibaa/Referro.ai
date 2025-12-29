import { LayoutGrid, FileText, CheckSquare, Grid2X2, Bell, Headphones, Settings, LogOut, Calendar } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Sidebar = () => {
  const location = useLocation();
  
  const topIcons = [
    { icon: LayoutGrid, active: false, to: "/" },
    { icon: FileText, active: location.pathname === "/", to: "/" },
    { icon: Calendar, active: location.pathname === "/calendar", to: "/calendar" },
    { icon: CheckSquare, active: false, to: "/" },
    { icon: Grid2X2, active: false, to: "/" },
    { icon: Bell, active: false, to: "/" },
  ];

  const bottomIcons = [
    { icon: Headphones, active: false },
    { icon: Settings, active: false },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 bg-card border-r border-border flex flex-col items-center py-6 z-50">
      <div className="flex flex-col items-center gap-2 flex-1">
        {topIcons.map((item, index) => (
          <Link
            key={index}
            to={item.to}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              item.active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon size={22} strokeWidth={item.active ? 2 : 1.5} />
          </Link>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        {bottomIcons.map((item, index) => (
          <button
            key={index}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <item.icon size={22} strokeWidth={1.5} />
          </button>
        ))}
        <button className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all mt-4">
          <LogOut size={22} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

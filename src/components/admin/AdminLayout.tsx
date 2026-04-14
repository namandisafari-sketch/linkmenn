import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingBag, FileText, LogOut, Settings,
  Menu, ShoppingCart, Users, Eye, BarChart3, History, Pill,
  BookOpen, AlertTriangle, Layers, Truck, PackagePlus,
  Wifi, WifiOff, Maximize, Minimize
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/marvid-logo.png";
import ThemeToggle from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "POS / Sales", icon: ShoppingCart, path: "/admin/pos" },
  { label: "Inventory", icon: Package, path: "/admin/inventory" },
  { label: "Stock Purchase", icon: PackagePlus, path: "/admin/stock-purchase" },
  { label: "Batch Tracking", icon: Layers, path: "/admin/batches" },
  { label: "Product Preview", icon: Eye, path: "/admin/preview" },
  { label: "Orders", icon: ShoppingBag, path: "/admin/orders" },
  { label: "Sales History", icon: History, path: "/admin/sales-history" },
  { label: "Sales Report", icon: FileText, path: "/admin/reports" },
  { label: "Day Book", icon: BookOpen, path: "/admin/day-book" },
  { label: "Accounting", icon: BookOpen, path: "/admin/accounting" },
  { label: "Financial Statements", icon: BarChart3, path: "/admin/balance-sheet" },
  
  { label: "Prescription Rules", icon: Pill, path: "/admin/prescriptions" },
  { label: "Customer Accounts", icon: Users, path: "/admin/credits" },
  { label: "Customer Analytics", icon: BarChart3, path: "/admin/analytics" },
  { label: "Suppliers", icon: Truck, path: "/admin/suppliers" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const AdminLayout = ({ children, title, subtitle, actions }: AdminLayoutProps) => {
  const location = useLocation();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const currentPath = location.pathname;

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <div className="h-screen flex bg-muted/30 overflow-hidden">
      {/* Sidebar - fixed, does not scroll with content */}
      <aside className={`${sidebarOpen ? "w-60" : "w-16"} gradient-primary flex flex-col transition-all duration-200 hidden md:flex h-screen shrink-0`}>
        <div className="p-4 border-b border-primary-foreground/10 flex items-center justify-between shrink-0">
          <img src={logo} alt="Marvid" className={`${sidebarOpen ? "h-8" : "h-6"} brightness-0 invert`} />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-primary-foreground/60 hover:text-primary-foreground">
            <Menu className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  currentPath === item.path
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t border-primary-foreground/10 shrink-0">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main - scrollable content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-background border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnline ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {isOnline ? "Online" : "Offline"}
            </div>
            <button onClick={toggleFullscreen} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
            <ThemeToggle />
            {actions}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

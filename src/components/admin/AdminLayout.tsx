import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingBag, FileText, LogOut, Settings, X,
  Menu, ShoppingCart, Users, Eye, BarChart3, History, Pill,
  BookOpen, AlertTriangle, Layers, Truck, PackagePlus,
  Wifi, WifiOff, Maximize, Minimize, ShieldCheck
} from "lucide-react";
// Button not needed in layout
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/marvid-logo.png";
import ThemeToggle from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminAIAssistant from "@/components/admin/AdminAIAssistant";
import SyncStatusBadge from "@/components/admin/SyncStatusBadge";
import FunctionBar from "@/components/admin/FunctionBar";
import HelpDialog from "@/components/admin/HelpDialog";
import MedicineSearchPalette from "@/components/admin/MedicineSearchPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin", shortcut: "1" },
  { label: "POS / Sales", icon: ShoppingCart, path: "/admin/pos", shortcut: "2" },
  { label: "Inventory", icon: Package, path: "/admin/inventory", shortcut: "3" },
  { label: "Stock Purchase", icon: PackagePlus, path: "/admin/stock-purchase", shortcut: "4" },
  { label: "Goods Received (GRN)", icon: Truck, path: "/admin/grn", shortcut: "" },
  { label: "Batch Tracking", icon: Layers, path: "/admin/batches", shortcut: "5" },
  { label: "Product Preview", icon: Eye, path: "/admin/preview", shortcut: "" },
  { label: "Orders", icon: ShoppingBag, path: "/admin/orders", shortcut: "6" },
  { label: "Sales History", icon: History, path: "/admin/sales-history", shortcut: "" },
  { label: "Sales Report", icon: FileText, path: "/admin/reports", shortcut: "7" },
  { label: "Day Book", icon: BookOpen, path: "/admin/day-book", shortcut: "" },
  { label: "Accounting", icon: BookOpen, path: "/admin/accounting", shortcut: "8" },
  { label: "Expenses", icon: AlertTriangle, path: "/admin/expenses", shortcut: "9" },
  { label: "Prescription Rules", icon: Pill, path: "/admin/prescriptions", shortcut: "" },
  { label: "Customer Accounts", icon: Users, path: "/admin/credits", shortcut: "0" },
  { label: "Customer Analytics", icon: BarChart3, path: "/admin/analytics", shortcut: "" },
  { label: "Suppliers", icon: Truck, path: "/admin/suppliers", shortcut: "" },
  { label: "Reports Hub", icon: FileText, path: "/admin/reports-hub", shortcut: "" },
  { label: "Audit Trail", icon: ShieldCheck, path: "/admin/audit", shortcut: "" },
  { label: "Settings", icon: Settings, path: "/admin/settings", shortcut: "" },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const currentPath = location.pathname;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  // Tally-style global F-key & Alt-combo shortcuts
  useKeyboardShortcuts({
    F1: { type: "callback", fn: () => setHelpOpen(true) },
    F2: { type: "navigate", path: "/admin" },
    F3: { type: "callback", fn: () => setSearchOpen(true) },
    F8: { type: "navigate", path: "/admin/pos" },
    F9: { type: "navigate", path: "/admin/stock-purchase" },
    F10: { type: "navigate", path: "/admin/accounting" },
    F11: { type: "callback", fn: toggleFullscreen },
    "Alt+R": { type: "navigate", path: "/admin/reports-hub" },
    "Alt+S": { type: "navigate", path: "/admin/settings" },
    Escape: { type: "callback", fn: () => { setHelpOpen(false); setSearchOpen(false); } },
  });

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


  return (
    <div className="h-screen flex bg-muted/30 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 gradient-primary flex flex-col h-full z-10">
            <div className="p-4 border-b border-primary-foreground/10 flex items-center justify-between shrink-0">
              <img src={logo} alt="Marvid" className="h-14 brightness-0 invert" />
              <button onClick={() => setMobileMenuOpen(false)} className="text-primary-foreground/60 hover:text-primary-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              <nav className="p-3 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      currentPath === item.path
                        ? "bg-primary-foreground/15 text-primary-foreground"
                        : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
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
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-16"} gradient-primary flex-col transition-all duration-200 hidden md:flex h-screen shrink-0`}>
        <div className="p-4 border-b border-primary-foreground/10 flex items-center justify-between shrink-0">
          <img src={logo} alt="Marvid" className={`${sidebarOpen ? "h-14" : "h-8"} brightness-0 invert`} />
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
                {sidebarOpen && <span className="flex-1">{item.label}</span>}
                {sidebarOpen && item.shortcut && (
                  <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary-foreground/10 text-primary-foreground/50">Alt+{item.shortcut}</kbd>
                )}
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

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-background border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-accent transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold">{title}</h1>
              {subtitle && <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <SyncStatusBadge />
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnline ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {isOnline ? "Online" : "Offline"}
            </div>
            <button onClick={toggleFullscreen} className="hidden sm:flex h-8 w-8 rounded-lg items-center justify-center hover:bg-accent transition-colors" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
            <ThemeToggle />
            {actions}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
        <FunctionBar onSearch={() => setSearchOpen(true)} onHelp={() => setHelpOpen(true)} />
      </main>
      <AdminAIAssistant />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <MedicineSearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
};

export default AdminLayout;

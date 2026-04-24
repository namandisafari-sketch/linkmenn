import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingBag, FileText, LogOut, Settings, X,
  Menu, ShoppingCart, Users, Eye, BarChart3, History, Pill,
  BookOpen, AlertTriangle, Layers, Truck, PackagePlus,
  Wifi, WifiOff, Maximize, Minimize, ShieldCheck,
  Calculator, Receipt, Wallet, Building2, Calendar, Percent,
  ChevronDown, ChevronRight,
} from "lucide-react";
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

type NavItem = { label: string; icon: any; path: string };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", icon: LayoutDashboard, path: "/admin" }] },
  { label: "Accounting", items: [
    { label: "Chart of Accounts", icon: BookOpen, path: "/admin/coa" },
    { label: "Journal Entry", icon: Calculator, path: "/admin/journal" },
    { label: "Ledger", icon: FileText, path: "/admin/ledger" },
    { label: "Trial Balance", icon: BarChart3, path: "/admin/trial-balance" },
  ]},
  { label: "Sales", items: [
    { label: "Invoices", icon: Receipt, path: "/admin/invoices" },
    { label: "Customers", icon: Users, path: "/admin/customers" },
    { label: "Receipts", icon: Wallet, path: "/admin/receipts" },
  ]},
  { label: "Purchases", items: [
    { label: "Bills", icon: FileText, path: "/admin/bills" },
    { label: "Suppliers", icon: Truck, path: "/admin/suppliers" },
    { label: "Payments", icon: Wallet, path: "/admin/payments" },
  ]},
  { label: "Inventory (ERP)", items: [
    { label: "Items", icon: Package, path: "/admin/items" },
    { label: "Stock Movement", icon: Layers, path: "/admin/stock-movement" },
  ]},
  { label: "Payroll", items: [
    { label: "Employees", icon: Users, path: "/admin/employees" },
    { label: "Pay Runs", icon: Calculator, path: "/admin/payruns" },
  ]},
  { label: "Tax", items: [
    { label: "Tax Rates", icon: Percent, path: "/admin/tax-rates" },
    { label: "VAT Returns", icon: FileText, path: "/admin/vat-returns" },
  ]},
  { label: "Reports", items: [
    { label: "Reports Hub", icon: BarChart3, path: "/admin/reports-hub" },
    { label: "P&L", icon: FileText, path: "/admin/pnl" },
    { label: "Balance Sheet", icon: FileText, path: "/admin/balance-sheet" },
    { label: "Cash Flow", icon: FileText, path: "/admin/cash-flow" },
    { label: "Aged Debtors", icon: FileText, path: "/admin/aged-debtors" },
  ]},
  { label: "Pharmacy / POS", items: [
    { label: "POS", icon: ShoppingCart, path: "/admin/pos" },
    { label: "Pharmacy Inventory", icon: Package, path: "/admin/inventory" },
    { label: "Stock Purchase", icon: PackagePlus, path: "/admin/stock-purchase" },
    { label: "GRN", icon: Truck, path: "/admin/grn" },
    { label: "Batches (FEFO)", icon: Layers, path: "/admin/batches" },
    { label: "Product Preview", icon: Eye, path: "/admin/preview" },
    { label: "Orders", icon: ShoppingBag, path: "/admin/orders" },
    { label: "Sales History", icon: History, path: "/admin/sales-history" },
    { label: "Day Book", icon: BookOpen, path: "/admin/day-book" },
    { label: "Expenses", icon: AlertTriangle, path: "/admin/expenses" },
    { label: "Prescriptions", icon: Pill, path: "/admin/prescriptions" },
    { label: "Customer Credits", icon: Users, path: "/admin/credits" },
    { label: "Customer Analytics", icon: BarChart3, path: "/admin/analytics" },
  ]},
  { label: "Settings", items: [
    { label: "Fiscal Year", icon: Calendar, path: "/admin/fiscal-year" },
    { label: "Company Info", icon: Building2, path: "/admin/company" },
    { label: "Users & Roles", icon: ShieldCheck, path: "/admin/users" },
    { label: "Audit Trail", icon: ShieldCheck, path: "/admin/audit" },
    { label: "App Settings", icon: Settings, path: "/admin/settings" },
  ]},
];

interface AdminLayoutProps { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode; }

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

  // Find which group contains current path; expand it by default
  const currentGroup = navGroups.find(g => g.items.some(i => i.path === currentPath))?.label;
  const [expanded, setExpanded] = useState<Set<string>>(new Set([currentGroup || "Overview", "Accounting"]));

  useEffect(() => {
    if (currentGroup) setExpanded(prev => new Set([...prev, currentGroup]));
  }, [currentGroup]);

  const toggleGroup = (label: string) => {
    const n = new Set(expanded);
    if (n.has(label)) n.delete(label); else n.add(label);
    setExpanded(n);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  useKeyboardShortcuts({
    F1: { type: "callback", fn: () => setHelpOpen(true) },
    F2: { type: "navigate", path: "/admin" },
    F3: { type: "callback", fn: () => setSearchOpen(true) },
    F8: { type: "navigate", path: "/admin/pos" },
    F9: { type: "navigate", path: "/admin/grn" },
    F10: { type: "navigate", path: "/admin/journal" },
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

  const renderNav = (onClick?: () => void) => (
    <nav className="p-3 space-y-1">
      {navGroups.map(group => {
        const isOpen = expanded.has(group.label);
        const hasActive = group.items.some(i => i.path === currentPath);
        return (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                hasActive ? "text-primary-foreground" : "text-primary-foreground/50 hover:text-primary-foreground/80"
              }`}
            >
              {sidebarOpen && <span>{group.label}</span>}
              {sidebarOpen && (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
            </button>
            {(isOpen || !sidebarOpen) && (
              <div className="space-y-0.5 mb-1">
                {group.items.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClick}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      currentPath === item.path
                        ? "bg-primary-foreground/15 text-primary-foreground font-medium"
                        : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="h-screen flex bg-muted/30 overflow-hidden">
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
            <ScrollArea className="flex-1">{renderNav(() => setMobileMenuOpen(false))}</ScrollArea>
            <div className="p-3 border-t border-primary-foreground/10 shrink-0">
              <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 w-full">
                <LogOut className="h-4 w-4" /><span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className={`${sidebarOpen ? "w-64" : "w-16"} gradient-primary flex-col transition-all duration-200 hidden md:flex h-screen shrink-0`}>
        <div className="p-4 border-b border-primary-foreground/10 flex items-center justify-between shrink-0">
          <img src={logo} alt="Marvid" className={`${sidebarOpen ? "h-12" : "h-8"} brightness-0 invert`} />
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-primary-foreground/60 hover:text-primary-foreground">
            <Menu className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="flex-1">{renderNav()}</ScrollArea>
        <div className="p-3 border-t border-primary-foreground/10 shrink-0">
          <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 w-full">
            <LogOut className="h-4 w-4" />{sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-background border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-accent"><Menu className="h-5 w-5" /></button>
            <div>
              <h1 className="text-lg md:text-xl font-bold">{title}</h1>
              {subtitle && <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <SyncStatusBadge />
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnline ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{isOnline ? "Online" : "Offline"}
            </div>
            <button onClick={toggleFullscreen} className="hidden sm:flex h-8 w-8 rounded-lg items-center justify-center hover:bg-accent">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
            <ThemeToggle />
            {actions}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
        <FunctionBar onSearch={() => setSearchOpen(true)} onHelp={() => setHelpOpen(true)} />
      </main>
      <AdminAIAssistant />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <MedicineSearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
};

export default AdminLayout;

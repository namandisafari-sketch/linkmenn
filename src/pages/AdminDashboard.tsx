import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DollarSign, Clock, AlertTriangle, TrendingUp, Banknote, Smartphone, Wallet, Users, Package, PercentCircle
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import PurchaseAnalyticsCard from "@/components/admin/PurchaseAnalyticsCard";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import InventoryPage from "@/components/admin/InventoryPage";
import OrdersPage from "@/components/admin/OrdersPage";
import SalesReportPage from "@/components/admin/SalesReportPage";
import SettingsPage from "@/components/admin/SettingsPage";
import POSPage from "@/components/admin/POSPage";
import CustomerCreditsPage from "@/components/admin/CustomerCreditsPage";
import ProductPreviewPage from "@/components/admin/ProductPreviewPage";
import CustomerAnalyticsPage from "@/components/admin/CustomerAnalyticsPage";
import SalesHistoryPage from "@/components/admin/SalesHistoryPage";
import PrescriptionRulesPage from "@/components/admin/PrescriptionRulesPage";
import AccountingPage from "@/components/admin/AccountingPage";

import BatchManagementPage from "@/components/admin/BatchManagementPage";
import SupplierManagementPage from "@/components/admin/SupplierManagementPage";
import StockPurchasePage from "@/components/admin/StockPurchasePage";
import StockUpdatePage from "@/components/admin/StockUpdatePage";
// PurchaseHistoryPage removed - consolidated into StockPurchasePage
import DayBookPage from "@/components/admin/DayBookPage";
import BalanceSheetPage from "@/components/admin/BalanceSheetPage";

const DashboardOverview = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stats, setStats] = useState({
    revenue: 0, pending: 0, lowStock: 0, monthRevenue: 0,
    cashRevenue: 0, momoRevenue: 0,
    totalCredit: 0, outstandingBalance: 0, creditCustomers: 0,
    inventoryValue: 0, inventoryCost: 0, profitMargin: 0, expiringValue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [topDebtors, setTopDebtors] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      const day = new Date(selectedDate);
      const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59).toISOString();
      const startOfMonth = new Date(day.getFullYear(), day.getMonth(), 1).toISOString();

      const [ordersRes, productsRes, recentRes, creditsRes, allProductsRes, batchesRes] = await Promise.all([
        supabase.from("orders").select("total, status, created_at, payment_method"),
        supabase.from("products").select("name, stock, batch_number, expiry_date").lte("stock", 15).gt("stock", -1).order("stock"),
        supabase.from("orders").select("id, customer_name, total, status, created_at, order_items(quantity)").order("created_at", { ascending: false }).limit(5),
        supabase.from("customer_credits").select("*").order("credit_balance", { ascending: false }),
        supabase.from("products").select("price, buying_price, stock").eq("is_active", true),
        supabase.from("product_batches").select("quantity, expiry_date, purchase_price, mrp, product_id").gt("quantity", 0),
      ]);

      const orders = ordersRes.data || [];
      const dayOrders = orders.filter(o => { const d = o.created_at; return d >= startOfDay && d <= endOfDay; });
      const monthOrders = orders.filter(o => { const d = o.created_at; return d >= startOfMonth && d <= endOfDay; });
      const credits = (creditsRes.data || []) as any[];
      const allProducts = (allProductsRes.data || []) as any[];
      const inventoryValue = allProducts.reduce((s: number, p: any) => s + (p.price || 0) * (p.stock || 0), 0);
      const inventoryCost = allProducts.reduce((s: number, p: any) => s + (p.buying_price || 0) * (p.stock || 0), 0);
      const profitMargin = inventoryValue > 0 ? ((inventoryValue - inventoryCost) / inventoryValue) * 100 : 0;

      // Expiring stock value (within 30 days)
      const batches = batchesRes.data || [];
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringValue = batches.reduce((s: number, b: any) => {
        const exp = new Date(b.expiry_date);
        if (exp <= thirtyDaysFromNow && exp >= now) {
          return s + (b.mrp || b.purchase_price || 0) * (b.quantity || 0);
        }
        return s;
      }, 0);

      setStats({
        revenue: dayOrders.reduce((s, o) => s + o.total, 0),
        pending: orders.filter(o => o.status === "pending").length,
        lowStock: (productsRes.data || []).filter(p => p.stock <= 10).length,
        monthRevenue: monthOrders.reduce((s, o) => s + o.total, 0),
        cashRevenue: dayOrders.filter(o => o.payment_method === "cash").reduce((s, o) => s + o.total, 0),
        momoRevenue: dayOrders.filter(o => o.payment_method === "mobile_money").reduce((s, o) => s + o.total, 0),
        totalCredit: credits.reduce((s, c) => s + c.total_spent, 0),
        outstandingBalance: credits.reduce((s, c) => s + Math.max(0, c.credit_balance), 0),
        creditCustomers: credits.filter(c => c.credit_balance > 0).length,
        inventoryValue, inventoryCost, profitMargin, expiringValue,
      });
      setLowStockItems((productsRes.data || []).slice(0, 5));
      setRecentOrders(recentRes.data || []);
      setTopDebtors(credits.filter(c => c.credit_balance > 0).slice(0, 5));
    };
    fetchDashboard();
  }, [selectedDate]);

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-warning/10 text-warning";
      case "processing": return "bg-primary/10 text-primary";
      case "dispatched": return "bg-success/10 text-success";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>Today</Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[
          { label: "Day's Sales", value: `UGX ${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
          { label: "Cash Received", value: `UGX ${stats.cashRevenue.toLocaleString()}`, icon: Banknote, color: "text-primary" },
          { label: "Mobile Money", value: `UGX ${stats.momoRevenue.toLocaleString()}`, icon: Smartphone, color: "text-primary" },
          { label: "Monthly Revenue", value: `UGX ${stats.monthRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
          { label: "Pending Orders", value: stats.pending, icon: Clock, color: "text-warning" },
          { label: "Low Stock Items", value: stats.lowStock, icon: AlertTriangle, color: "text-destructive" },
          { label: "Outstanding Credit", value: `UGX ${stats.outstandingBalance.toLocaleString()}`, icon: Wallet, color: "text-destructive" },
          { label: "Credit Customers", value: stats.creditCustomers, icon: Users, color: "text-warning" },
          { label: "Inventory Value", value: `UGX ${stats.inventoryValue.toLocaleString()}`, icon: Package, color: "text-primary" },
          { label: "Inventory Cost", value: `UGX ${stats.inventoryCost.toLocaleString()}`, icon: Banknote, color: "text-muted-foreground" },
          { label: "Profit Margin", value: `${stats.profitMargin.toFixed(1)}%`, icon: PercentCircle, color: "text-primary" },
          { label: "Expiring Stock (30d)", value: `UGX ${stats.expiringValue.toLocaleString()}`, icon: AlertTriangle, color: "text-warning" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Recent Orders</h3>
            <Link to="/admin/orders" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground text-center">No orders yet</p>
            ) : recentOrders.map((order: any) => (
              <div key={order.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{order.customer_name} · {(order.order_items || []).reduce((a: number, i: any) => a + i.quantity, 0)} items</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor(order.status)}`}>{order.status}</span>
                  <span className="text-sm font-semibold">UGX {order.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: Low Stock + Top Debtors */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Low Stock
              </h3>
            </div>
            <div className="divide-y divide-border">
              {lowStockItems.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground text-center">All stocked up!</p>
              ) : lowStockItems.map((item: any, i: number) => (
                <div key={i} className="p-4">
                  <p className="font-medium text-sm">{item.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-medium text-destructive">{item.stock} units left</span>
                    <span className="text-xs text-muted-foreground">{item.expiry_date ? `Exp: ${item.expiry_date}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-destructive" /> Top Debtors
              </h3>
              <Link to="/admin/credits" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-border">
              {topDebtors.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground text-center">No outstanding credits</p>
              ) : topDebtors.map((d: any) => (
                <div key={d.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{d.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{d.customer_phone}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive">UGX {d.credit_balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Analytics */}
      <PurchaseAnalyticsCard />
    </div>
  );
};

const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const path = location.pathname;

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/admin/login");
    }
  }, [loading, isAdmin, navigate]);

  // Global admin keyboard shortcuts
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      if (isInput) return;

      // P - Go to POS
      if (e.key === "p" || e.key === "P") {
        if (path !== "/admin/pos") {
          e.preventDefault();
          navigate("/admin/pos");
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [navigate, path]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAdmin) return null;

  const getPageContent = () => {
    if (path === "/admin/pos") return <POSPage />;
    if (path === "/admin/inventory") return <InventoryPage />;
    if (path === "/admin/stock-purchase") return <StockPurchasePage />;
    if (path === "/admin/stock-update") return <StockUpdatePage />;
    if (path === "/admin/batches") return <BatchManagementPage />;
    if (path === "/admin/orders") return <OrdersPage />;
    if (path === "/admin/reports") return <SalesReportPage />;
    if (path === "/admin/sales-history") return <SalesHistoryPage />;
    if (path === "/admin/credits") return <CustomerCreditsPage />;
    if (path === "/admin/preview") return <ProductPreviewPage />;
    if (path === "/admin/analytics") return <CustomerAnalyticsPage />;
    if (path === "/admin/prescriptions") return <PrescriptionRulesPage />;
    if (path === "/admin/accounting") return <AccountingPage />;
    
    if (path === "/admin/suppliers") return <SupplierManagementPage />;
    if (path === "/admin/day-book") return <DayBookPage />;
    if (path === "/admin/balance-sheet") return <BalanceSheetPage />;
    if (path === "/admin/settings") return <SettingsPage />;
    return <DashboardOverview />;
  };

  const getTitle = () => {
    if (path === "/admin/pos") return "Point of Sale";
    if (path === "/admin/inventory") return "Inventory";
    if (path === "/admin/stock-purchase") return "Stock Purchase";
    if (path === "/admin/stock-update") return "Stock Update / Adjustments";
    if (path === "/admin/batches") return "Batch Tracking (FEFO)";
    if (path === "/admin/orders") return "Orders";
    if (path === "/admin/reports") return "Sales Report";
    if (path === "/admin/sales-history") return "Sales History";
    if (path === "/admin/credits") return "Customer Accounts";
    if (path === "/admin/preview") return "Product Preview";
    if (path === "/admin/analytics") return "Customer Analytics";
    if (path === "/admin/prescriptions") return "Prescription Rules";
    if (path === "/admin/accounting") return "Accounting";
    
    if (path === "/admin/suppliers") return "Supplier Management";
    if (path === "/admin/day-book") return "Day Book";
    if (path === "/admin/balance-sheet") return "Financial Statements";
    if (path === "/admin/settings") return "Settings";
    return "Dashboard";
  };

  return (
    <AdminLayout title={getTitle()} subtitle="Welcome back, Admin">
      {getPageContent()}
    </AdminLayout>
  );
};

export default AdminDashboard;

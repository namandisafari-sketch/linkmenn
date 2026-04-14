import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CustomerData {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_type: string;
  total_spent: number;
  total_paid: number;
  credit_balance: number;
  created_at: string;
}

interface OrderData {
  customer_name: string;
  phone: string;
  total: number;
  created_at: string;
}

const CustomerAnalyticsPage = () => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"spent" | "purchases" | "balance" | "recent">("spent");
  const [filterType, setFilterType] = useState<"all" | "retail" | "wholesale">("all");

  useEffect(() => {
    const fetch = async () => {
      const [{ data: custs }, { data: ords }] = await Promise.all([
        supabase.from("customer_credits").select("*").order("total_spent", { ascending: false }),
        supabase.from("orders").select("customer_name, phone, total, created_at").order("created_at", { ascending: false }).limit(1000),
      ]);
      setCustomers((custs as CustomerData[]) || []);
      setOrders((ords as OrderData[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = customers
    .filter((c) => {
      const matchSearch = c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_phone.includes(search);
      const matchType = filterType === "all" || (c.customer_type || "retail") === filterType;
      return matchSearch && matchType;
    })
    .sort((a, b) => {
      if (sortBy === "spent") return b.total_spent - a.total_spent;
      if (sortBy === "purchases") return b.total_spent - a.total_spent;
      if (sortBy === "balance") return b.credit_balance - a.credit_balance;
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });

  const totalCustomers = customers.length;
  const retailCount = customers.filter(c => (c.customer_type || "retail") === "retail").length;
  const wholesaleCount = customers.filter(c => (c.customer_type || "retail") === "wholesale").length;
  const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);
  const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // Top customers
  const topBySpend = [...customers].sort((a, b) => b.total_spent - a.total_spent).slice(0, 5);

  // Monthly trend for selected customer
  const getCustomerMonthlyTrend = (phone: string) => {
    const customerOrders = orders.filter(o => o.phone === phone);
    const monthMap: Record<string, number> = {};
    customerOrders.forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = (monthMap[key] || 0) + o.total;
    });
    return Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const daysSinceLastPurchase = (date: string | null) => {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };

  const activityBadge = (days: number | null) => {
    if (days === null) return <Badge variant="secondary" className="text-[10px]">New</Badge>;
    if (days <= 7) return <Badge className="text-[10px] bg-success text-success-foreground">Active</Badge>;
    if (days <= 30) return <Badge variant="secondary" className="text-[10px]">Regular</Badge>;
    if (days <= 90) return <Badge className="text-[10px] bg-warning text-warning-foreground">Inactive</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Dormant</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: totalCustomers, icon: Users, sub: `${retailCount} retail · ${wholesaleCount} wholesale` },
          { label: "Total Revenue", value: `UGX ${totalRevenue.toLocaleString()}`, icon: DollarSign, sub: `From all customers` },
          { label: "Avg Spend/Customer", value: `UGX ${Math.round(avgSpend).toLocaleString()}`, icon: TrendingUp, sub: "Lifetime average" },
          { label: "Total Revenue", value: `UGX ${totalRevenue.toLocaleString()}`, icon: DollarSign, sub: `From all customers` },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Top Customers */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Top 5 Customers by Spend
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {topBySpend.map((c, i) => (
            <div key={c.id} className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary">#{i + 1}</p>
              <p className="font-medium text-sm truncate">{c.customer_name}</p>
              <p className="text-xs text-muted-foreground">{c.customer_phone}</p>
              <p className="text-sm font-bold mt-1">UGX {c.total_spent.toLocaleString()}</p>
              <Badge variant="secondary" className="text-[10px] mt-1">Top spender</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="all">All Types</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="spent">Sort by Spend</option>
            <option value="purchases">Sort by Orders</option>
            <option value="balance">Sort by Balance</option>
            <option value="recent">Sort by Recent</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No customers found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
            const trend = getCustomerMonthlyTrend(c.customer_phone);
            const lastTwo = trend.slice(-2);
            const isGrowing = lastTwo.length === 2 && lastTwo[1][1] > lastTwo[0][1];

            return (
              <div key={c.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{c.customer_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{c.customer_name}</p>
                        <Badge variant="secondary" className="text-[10px]">{c.customer_type || "retail"}</Badge>
                        {activityBadge(days)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.customer_phone} · Joined {new Date(c.created_at).toLocaleDateString("en-UG", { month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                      <p className="font-bold text-sm">UGX {c.total_spent.toLocaleString()}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Orders</p>
                      <p className="font-bold text-sm">—</p>
                    </div>
                    <div className="text-right hidden lg:block">
                      <p className="text-xs text-muted-foreground">Avg/Order</p>
                      <p className="font-bold text-sm">
                        UGX {Math.round(c.total_spent || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={`font-bold text-sm ${c.credit_balance > 0 ? "text-destructive" : "text-primary"}`}>
                        UGX {c.credit_balance.toLocaleString()}
                      </p>
                    </div>
                    <div className="hidden lg:flex items-center gap-1 text-xs">
                      {isGrowing ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                      <span className={isGrowing ? "text-success" : "text-destructive"}>
                        {isGrowing ? "Growing" : "Declining"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mini monthly trend */}
                {trend.length > 1 && (
                  <div className="mt-3 flex gap-1 items-end h-8">
                    {trend.slice(-6).map(([month, amount]) => {
                      const max = Math.max(...trend.slice(-6).map(t => t[1] as number));
                      const height = max > 0 ? ((amount as number) / max) * 100 : 0;
                      return (
                        <div key={month} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full bg-primary/20 rounded-sm relative" style={{ height: "32px" }}>
                            <div className="absolute bottom-0 w-full bg-primary rounded-sm" style={{ height: `${height}%` }} />
                          </div>
                          <span className="text-[8px] text-muted-foreground">{(month as string).split("-")[1]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerAnalyticsPage;

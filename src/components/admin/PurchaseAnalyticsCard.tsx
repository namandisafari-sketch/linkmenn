import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { FileArchive, TrendingUp, Package, Truck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface TallyItem {
  name: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PurchaseAnalyticsCard = () => {
  const { data } = useQuery({
    queryKey: ["purchase-analytics-dashboard"],
    queryFn: async () => {
      const { data: vouchers, error } = await supabase
        .from("tally_vouchers")
        .select("*")
        .order("voucher_date", { ascending: true });
      if (error) throw error;
      return vouchers || [];
    },
  });

  if (!data || data.length === 0) return null;

  const totalPurchases = data.reduce((s, v) => s + Number(v.total_amount), 0);
  const supplierCount = new Set(data.map((v) => v.party_name)).size;

  // Supplier breakdown
  const supplierMap: Record<string, number> = {};
  data.forEach((v) => {
    const name = v.party_name || "Unknown";
    supplierMap[name] = (supplierMap[name] || 0) + Number(v.total_amount);
  });
  const supplierData = Object.entries(supplierMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, value }));

  // Top products by purchase amount
  const productMap: Record<string, { qty: number; amount: number; suppliers: Set<string> }> = {};
  data.forEach((v) => {
    const items = (v.items as unknown as TallyItem[]) || [];
    items.forEach((item) => {
      if (!productMap[item.name]) productMap[item.name] = { qty: 0, amount: 0, suppliers: new Set() };
      productMap[item.name].qty += item.qty;
      productMap[item.name].amount += item.amount;
      if (v.party_name) productMap[item.name].suppliers.add(v.party_name);
    });
  });
  const topProducts = Object.entries(productMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 8)
    .map(([name, d]) => ({
      name: name.length > 18 ? name.slice(0, 18) + "…" : name,
      amount: Math.round(d.amount),
      qty: d.qty,
      suppliers: d.suppliers.size,
    }));

  // Monthly supply rate trend
  const monthMap: Record<string, number> = {};
  data.forEach((v) => {
    const month = v.voucher_date.slice(0, 7); // YYYY-MM
    monthMap[month] = (monthMap[month] || 0) + Number(v.total_amount);
  });
  const monthlyTrend = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({
      month: new Date(month + "-01").toLocaleDateString("en", { month: "short", year: "2-digit" }),
      amount: Math.round(amount),
    }));

  return (
    <div className="space-y-6">
      {/* Purchase summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Total Purchases</span>
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <FileArchive className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold">UGX {totalPurchases.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{data.length} vouchers</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Active Suppliers</span>
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold">{supplierCount}</p>
          <p className="text-xs text-muted-foreground mt-1">from purchase history</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Unique Products</span>
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold">{Object.keys(productMap).length}</p>
          <p className="text-xs text-muted-foreground mt-1">purchased items</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly supply rate trend */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Supply Rate Trend
            </h3>
            <Link to="/admin/purchase-history" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="p-4 h-[260px]">
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => [`UGX ${v.toLocaleString()}`, "Amount"]} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-20">No trend data</p>
            )}
          </div>
        </div>

        {/* Supplier breakdown pie */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Supplier Breakdown
            </h3>
          </div>
          <div className="p-4 h-[260px] flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={supplierData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                  {supplierData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`UGX ${v.toLocaleString()}`, "Amount"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {supplierData.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto font-medium text-muted-foreground">{((s.value / totalPurchases) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top purchased products table */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Top Purchased Products
          </h3>
          <Link to="/admin/purchase-history" className="text-xs text-primary hover:underline">View history</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left p-3 font-medium">Product</th>
                <th className="text-right p-3 font-medium">Total Qty</th>
                <th className="text-right p-3 font-medium">Total Amount</th>
                <th className="text-right p-3 font-medium">Suppliers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topProducts.map((p, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-right text-muted-foreground">{p.qty.toLocaleString()}</td>
                  <td className="p-3 text-right font-semibold">UGX {p.amount.toLocaleString()}</td>
                  <td className="p-3 text-right text-muted-foreground">{p.suppliers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PurchaseAnalyticsCard;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ugx } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ErpDashboard = () => {
  const [kpis, setKpis] = useState({ revenue: 0, ar: 0, expenses: 0, cash: 0 });
  const [series, setSeries] = useState<{ month: string; revenue: number; expenses: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const start6mo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);

      const [accountsRes, ledgerRes, recentRes] = await Promise.all([
        supabase.from("accounts").select("id, code, opening_balance"),
        supabase.from("ledger_entries").select("account_id, debit, credit, entry_date").gte("entry_date", start6mo),
        supabase.from("journals").select("id, voucher_number, voucher_type, voucher_date, party_name, total_amount, status").order("created_at", { ascending: false }).limit(10),
      ]);

      const accounts = (accountsRes.data || []) as any[];
      const entries = (ledgerRes.data || []) as any[];
      const acctById = new Map(accounts.map(a => [a.id, a]));

      // KPIs (this month)
      let revenue = 0, expenses = 0, ar = 0, cash = 0;
      entries.forEach(e => {
        const acct = acctById.get(e.account_id);
        if (!acct) return;
        const code = String(acct.code);
        if (e.entry_date >= startMonth) {
          if (code.startsWith("4")) revenue += (Number(e.credit) - Number(e.debit));
          if (code.startsWith("5") || code.startsWith("6")) expenses += (Number(e.debit) - Number(e.credit));
        }
      });
      // AR & Cash = lifetime closing
      const closingByAcct: Record<string, number> = {};
      entries.forEach(e => {
        const k = e.account_id;
        closingByAcct[k] = (closingByAcct[k] || 0) + Number(e.debit) - Number(e.credit);
      });
      accounts.forEach(a => {
        const code = String(a.code);
        const open = Number(a.opening_balance) || 0;
        const move = closingByAcct[a.id] || 0;
        if (code === "1004") ar += open + move;
        if (code === "1001" || code === "1002" || code === "1005" || code === "1006") cash += open + move;
      });

      setKpis({ revenue, ar, expenses, cash });

      // 6-month series
      const months: { month: string; revenue: number; expenses: number; key: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toLocaleString("en", { month: "short" }),
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          revenue: 0, expenses: 0,
        });
      }
      entries.forEach(e => {
        const acct = acctById.get(e.account_id);
        if (!acct) return;
        const k = String(e.entry_date).slice(0, 7);
        const m = months.find(x => x.key === k);
        if (!m) return;
        const code = String(acct.code);
        if (code.startsWith("4")) m.revenue += Number(e.credit) - Number(e.debit);
        if (code.startsWith("5") || code.startsWith("6")) m.expenses += Number(e.debit) - Number(e.credit);
      });
      setSeries(months.map(({ key, ...rest }) => rest));

      setRecent((recentRes.data || []));
    };
    run();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Revenue (MTD)" value={ugx(kpis.revenue)} tone="emerald" />
        <Kpi icon={<Receipt className="h-4 w-4" />} label="Receivables" value={ugx(kpis.ar)} tone="blue" />
        <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Expenses (MTD)" value={ugx(kpis.expenses)} tone="rose" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Cash & Bank" value={ugx(kpis.cash)} tone="amber" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue vs Expenses — Last 6 months</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
              <Tooltip formatter={(v: any) => ugx(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Vouchers</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Type</TableHead><TableHead>Party</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {recent.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="text-xs">{v.voucher_date || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{v.voucher_number || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{v.voucher_type}</Badge></TableCell>
                  <TableCell>{v.party_name || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{ugx(v.total_amount || 0)}</TableCell>
                  <TableCell><Badge variant={v.status === "posted" ? "default" : "secondary"}>{v.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!recent.length && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No vouchers yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const Kpi = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) => (
  <Card>
    <CardContent className="pt-5">
      <div className="flex items-center justify-between mb-2 text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        <span className={`p-1.5 rounded-md bg-${tone}-500/10 text-${tone}-600`}>{icon}</span>
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
    </CardContent>
  </Card>
);

export default ErpDashboard;

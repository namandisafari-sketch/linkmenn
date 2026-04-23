import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ugx } from "@/lib/format";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Printer, AlertTriangle } from "lucide-react";

type DateRange = { from: string; to: string };

const todayMonth = (): DateRange => ({
  from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
  to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
});

// ───────── CSV download helper ─────────
const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const RangePicker = ({ range, setRange }: { range: DateRange; setRange: (r: DateRange) => void }) => (
  <div className="flex items-end gap-2 mb-4 print:hidden">
    <div>
      <label className="text-xs text-muted-foreground block mb-1">From</label>
      <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="w-40" />
    </div>
    <div>
      <label className="text-xs text-muted-foreground block mb-1">To</label>
      <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="w-40" />
    </div>
    <Button variant="outline" size="sm" onClick={() => setRange(todayMonth())}>This month</Button>
  </div>
);

const ToolBar = ({ onExport }: { onExport: () => void }) => (
  <div className="flex justify-end gap-2 mb-3 print:hidden">
    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
    <Button variant="outline" size="sm" onClick={onExport}><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
  </div>
);

// ──────────────────────────────────────── TRIAL BALANCE
const TrialBalance = () => {
  const [range, setRange] = useState(todayMonth());
  const [rows, setRows] = useState<{ code: string; name: string; debit: number; credit: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: lines } = await supabase
        .from("journal_lines")
        .select("debit,credit,account_id,entry_date")
        .gte("entry_date", range.from).lte("entry_date", range.to);
      const { data: accs } = await supabase.from("accounts").select("id,code,name");
      const map = new Map<string, { debit: number; credit: number }>();
      (lines ?? []).forEach((l: any) => {
        const m = map.get(l.account_id) ?? { debit: 0, credit: 0 };
        m.debit += Number(l.debit || 0);
        m.credit += Number(l.credit || 0);
        map.set(l.account_id, m);
      });
      const out = (accs ?? []).map((a: any) => ({
        code: a.code, name: a.name,
        debit: map.get(a.id)?.debit ?? 0,
        credit: map.get(a.id)?.credit ?? 0,
      })).filter((r) => r.debit || r.credit).sort((a, b) => a.code.localeCompare(b.code));
      setRows(out);
    })();
  }, [range]);

  const totDr = rows.reduce((s, r) => s + r.debit, 0);
  const totCr = rows.reduce((s, r) => s + r.credit, 0);
  const balanced = Math.abs(totDr - totCr) < 0.01;

  const exportCsv = () => downloadCsv(`trial-balance-${range.from}-${range.to}.csv`, [
    ["Code", "Account", "Debit (UGX)", "Credit (UGX)"],
    ...rows.map((r) => [r.code, r.name, r.debit, r.credit]),
    ["", "TOTAL", totDr, totCr],
  ]);

  return (
    <div>
      <RangePicker range={range} setRange={setRange} />
      <ToolBar onExport={exportCsv} />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr><th className="text-left p-3">Code</th><th className="text-left p-3">Account</th><th className="text-right p-3">Debit</th><th className="text-right p-3">Credit</th><th className="text-right p-3">Balance</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const bal = r.debit - r.credit;
              return (
                <tr key={r.code}>
                  <td className="p-3 font-mono text-xs">{r.code}</td>
                  <td className="p-3">{r.name}</td>
                  <td className="p-3 text-right">{r.debit ? ugx(r.debit) : "—"}</td>
                  <td className="p-3 text-right">{r.credit ? ugx(r.credit) : "—"}</td>
                  <td className={`p-3 text-right font-medium ${bal < 0 ? "text-destructive" : ""}`}>{ugx(Math.abs(bal))} {bal < 0 ? "Cr" : "Dr"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No journal entries in this period.</td></tr>}
          </tbody>
          <tfoot className="bg-muted/30 font-semibold">
            <tr>
              <td className="p-3" colSpan={2}>Totals</td>
              <td className="p-3 text-right">{ugx(totDr)}</td>
              <td className="p-3 text-right">{ugx(totCr)}</td>
              <td className={`p-3 text-right ${balanced ? "text-primary" : "text-destructive"}`}>
                {balanced ? "Balanced ✓" : "Out of balance!"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ──────────────────────────────────────── PROFIT & LOSS
const ProfitLoss = () => {
  const [range, setRange] = useState(todayMonth());
  const [income, setIncome] = useState<{ code: string; name: string; amount: number }[]>([]);
  const [expenses, setExpenses] = useState<{ code: string; name: string; amount: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: lines } = await supabase
        .from("journal_lines").select("debit,credit,account_id,entry_date")
        .gte("entry_date", range.from).lte("entry_date", range.to);
      const { data: accs } = await supabase.from("accounts").select("id,code,name,group_id");
      const { data: groups } = await supabase.from("account_groups").select("id,name");
      const grpName = new Map((groups ?? []).map((g: any) => [g.id, g.name]));

      const map = new Map<string, number>();
      (lines ?? []).forEach((l: any) => {
        const v = (Number(l.credit) || 0) - (Number(l.debit) || 0); // income positive
        map.set(l.account_id, (map.get(l.account_id) ?? 0) + v);
      });

      const inc: { code: string; name: string; amount: number }[] = [];
      const exp: { code: string; name: string; amount: number }[] = [];
      (accs ?? []).forEach((a: any) => {
        const g = grpName.get(a.group_id);
        const v = map.get(a.id) ?? 0;
        if (g === "Income" && v !== 0) inc.push({ code: a.code, name: a.name, amount: v });
        if (g === "Expenses" && v !== 0) exp.push({ code: a.code, name: a.name, amount: -v });
      });
      setIncome(inc); setExpenses(exp);
    })();
  }, [range]);

  const totIncome = income.reduce((s, r) => s + r.amount, 0);
  const totExp = expenses.reduce((s, r) => s + r.amount, 0);
  const net = totIncome - totExp;

  const exportCsv = () => downloadCsv(`profit-loss-${range.from}-${range.to}.csv`, [
    ["Section", "Account", "Amount (UGX)"],
    ...income.map((r) => ["Income", r.name, r.amount]),
    ["Income", "TOTAL", totIncome],
    ...expenses.map((r) => ["Expenses", r.name, r.amount]),
    ["Expenses", "TOTAL", totExp],
    ["", "NET PROFIT", net],
  ]);

  return (
    <div>
      <RangePicker range={range} setRange={setRange} />
      <ToolBar onExport={exportCsv} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-primary">Income</h3>
          <div className="space-y-1.5 text-sm">
            {income.map((r) => (
              <div key={r.code} className="flex justify-between"><span>{r.name}</span><span className="font-medium">{ugx(r.amount)}</span></div>
            ))}
            {income.length === 0 && <p className="text-muted-foreground">No income</p>}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between font-semibold"><span>Total Income</span><span>{ugx(totIncome)}</span></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-destructive">Expenses</h3>
          <div className="space-y-1.5 text-sm">
            {expenses.map((r) => (
              <div key={r.code} className="flex justify-between"><span>{r.name}</span><span className="font-medium">{ugx(r.amount)}</span></div>
            ))}
            {expenses.length === 0 && <p className="text-muted-foreground">No expenses</p>}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between font-semibold"><span>Total Expenses</span><span>{ugx(totExp)}</span></div>
        </div>
      </div>
      <div className={`mt-4 p-5 rounded-xl border ${net >= 0 ? "bg-primary/10 border-primary/30" : "bg-destructive/10 border-destructive/30"}`}>
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Net {net >= 0 ? "Profit" : "Loss"}</span>
          <span>{ugx(Math.abs(net))}</span>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────── BALANCE SHEET
const BalanceSheet = () => {
  const [asOf, setAsOf] = useState(format(new Date(), "yyyy-MM-dd"));
  const [assets, setAssets] = useState<{ name: string; amount: number }[]>([]);
  const [liab, setLiab] = useState<{ name: string; amount: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: lines } = await supabase.from("journal_lines").select("debit,credit,account_id,entry_date").lte("entry_date", asOf);
      const { data: accs } = await supabase.from("accounts").select("id,name,group_id,opening_balance");
      const { data: groups } = await supabase.from("account_groups").select("id,name,nature");
      const grp = new Map((groups ?? []).map((g: any) => [g.id, g]));

      const map = new Map<string, number>();
      (lines ?? []).forEach((l: any) => {
        map.set(l.account_id, (map.get(l.account_id) ?? 0) + Number(l.debit || 0) - Number(l.credit || 0));
      });

      const a: { name: string; amount: number }[] = [];
      const l: { name: string; amount: number }[] = [];
      (accs ?? []).forEach((acc: any) => {
        const g: any = grp.get(acc.group_id);
        if (!g) return;
        const balance = (Number(acc.opening_balance) || 0) + (map.get(acc.id) ?? 0);
        if (g.name === "Assets") a.push({ name: acc.name, amount: balance });
        else if (g.name === "Liabilities" || g.name === "Capital") l.push({ name: acc.name, amount: -balance });
      });
      setAssets(a.filter((x) => x.amount !== 0));
      setLiab(l.filter((x) => x.amount !== 0));
    })();
  }, [asOf]);

  const totA = assets.reduce((s, r) => s + r.amount, 0);
  const totL = liab.reduce((s, r) => s + r.amount, 0);
  const balanced = Math.abs(totA - totL) < 1;

  const exportCsv = () => downloadCsv(`balance-sheet-${asOf}.csv`, [
    ["Section", "Account", "Amount (UGX)"],
    ...assets.map((r) => ["Assets", r.name, r.amount]),
    ["Assets", "TOTAL", totA],
    ...liab.map((r) => ["Liabilities + Capital", r.name, r.amount]),
    ["Liabilities + Capital", "TOTAL", totL],
  ]);

  return (
    <div>
      <div className="flex items-end gap-2 mb-4 print:hidden">
        <div><label className="text-xs text-muted-foreground block mb-1">As of</label>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-40" /></div>
      </div>
      <ToolBar onExport={exportCsv} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-primary">Assets</h3>
          {assets.map((r, i) => (<div key={i} className="flex justify-between text-sm py-1"><span>{r.name}</span><span>{ugx(r.amount)}</span></div>))}
          <div className="mt-3 pt-3 border-t border-border flex justify-between font-semibold"><span>Total Assets</span><span>{ugx(totA)}</span></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-primary">Liabilities + Capital</h3>
          {liab.map((r, i) => (<div key={i} className="flex justify-between text-sm py-1"><span>{r.name}</span><span>{ugx(r.amount)}</span></div>))}
          <div className="mt-3 pt-3 border-t border-border flex justify-between font-semibold"><span>Total L + C</span><span>{ugx(totL)}</span></div>
        </div>
      </div>
      <div className={`mt-4 p-3 rounded-lg text-center text-sm font-medium ${balanced ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
        {balanced ? "Balance sheet is balanced ✓" : `Out of balance by ${ugx(Math.abs(totA - totL))}`}
      </div>
    </div>
  );
};

// ──────────────────────────────────────── VAT RETURN
const VatReturn = () => {
  const [range, setRange] = useState(todayMonth());
  const [output, setOutput] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: vatAcc } = await supabase.from("accounts").select("id").eq("code", "2002").maybeSingle();
      if (!vatAcc) { setOutput(0); setCount(0); return; }
      const { data: lines } = await supabase
        .from("journal_lines").select("credit,debit,journal_id")
        .eq("account_id", vatAcc.id)
        .gte("entry_date", range.from).lte("entry_date", range.to);
      const total = (lines ?? []).reduce((s: number, l: any) => s + Number(l.credit || 0) - Number(l.debit || 0), 0);
      setOutput(total);
      setCount(new Set((lines ?? []).map((l: any) => l.journal_id)).size);
    })();
  }, [range]);

  const exportCsv = () => downloadCsv(`vat-return-${range.from}-${range.to}.csv`, [
    ["Period", `${range.from} to ${range.to}`],
    ["Output VAT (collected)", output],
    ["Input VAT (paid)", 0],
    ["Net VAT Payable", output],
    ["Transactions", count],
  ]);

  return (
    <div>
      <RangePicker range={range} setRange={setRange} />
      <ToolBar onExport={exportCsv} />
      <div className="bg-card border border-border rounded-xl p-6 max-w-xl">
        <h3 className="font-semibold mb-4">VAT Return Summary (18%)</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span>Output VAT collected</span><span className="font-semibold">{ugx(output)}</span></div>
          <div className="flex justify-between"><span>Input VAT (deductible)</span><span className="font-semibold text-muted-foreground">{ugx(0)}</span></div>
          <div className="flex justify-between pt-3 border-t border-border text-base font-bold"><span>Net VAT Payable</span><span className="text-primary">{ugx(output)}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground pt-2"><span>Transactions in period</span><span>{count}</span></div>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────── STOCK VALUATION
const StockValuation = () => {
  const [rows, setRows] = useState<{ id: string; name: string; cat: string; qty: number; cost: number; value: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: meds } = await supabase.from("medicines")
        .select("id,name,category_id,price,buying_price")
        .eq("is_active", true);
      const { data: cats } = await supabase.from("categories").select("id,name");
      const { data: batches } = await supabase.from("medicine_batches")
        .select("medicine_id,qty_remaining,purchase_cost").gt("qty_remaining", 0);

      const catName = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
      const grouped = new Map<string, { qty: number; value: number }>();
      (batches ?? []).forEach((b: any) => {
        const cur = grouped.get(b.medicine_id) ?? { qty: 0, value: 0 };
        cur.qty += b.qty_remaining;
        cur.value += b.qty_remaining * Number(b.purchase_cost || 0);
        grouped.set(b.medicine_id, cur);
      });

      const out = (meds ?? []).map((m: any) => {
        const g = grouped.get(m.id) ?? { qty: 0, value: m.buying_price * 0 };
        const cost = g.qty > 0 ? g.value / g.qty : Number(m.buying_price || 0);
        return { id: m.id, name: m.name, cat: catName.get(m.category_id) || "Uncategorized", qty: g.qty, cost, value: g.value || cost * 0 };
      }).filter((r) => r.qty > 0).sort((a, b) => b.value - a.value);
      setRows(out);
    })();
  }, []);

  const total = rows.reduce((s, r) => s + r.value, 0);

  const exportCsv = () => downloadCsv("stock-valuation.csv", [
    ["Medicine", "Category", "Qty", "Avg Cost (UGX)", "Total Value (UGX)"],
    ...rows.map((r) => [r.name, r.cat, r.qty, Math.round(r.cost), Math.round(r.value)]),
    ["", "GRAND TOTAL", "", "", Math.round(total)],
  ]);

  return (
    <div>
      <ToolBar onExport={exportCsv} />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr><th className="text-left p-3">Medicine</th><th className="text-left p-3">Category</th><th className="text-right p-3">Qty</th><th className="text-right p-3">Avg Cost</th><th className="text-right p-3">Value</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3">{r.name}</td>
                <td className="p-3 text-muted-foreground">{r.cat}</td>
                <td className="p-3 text-right">{r.qty}</td>
                <td className="p-3 text-right">{ugx(r.cost)}</td>
                <td className="p-3 text-right font-semibold">{ugx(r.value)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No stock on hand.</td></tr>}
          </tbody>
          <tfoot className="bg-muted/30 font-semibold"><tr><td className="p-3" colSpan={4}>Total Stock Value</td><td className="p-3 text-right text-primary">{ugx(total)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
};

// ──────────────────────────────────────── EXPIRY ALERT
const ExpiryReport = () => {
  const [bucket, setBucket] = useState<30 | 60 | 90>(60);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + bucket);
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: batches } = await supabase
        .from("medicine_batches")
        .select("id,batch_number,expiry_date,qty_remaining,purchase_cost,mrp,medicine_id,medicines(name)")
        .gt("qty_remaining", 0)
        .lte("expiry_date", format(cutoff, "yyyy-MM-dd"))
        .gte("expiry_date", today)
        .order("expiry_date");
      setRows((batches as any[]) ?? []);
    })();
  }, [bucket]);

  const exportCsv = () => downloadCsv(`expiry-report-${bucket}d.csv`, [
    ["Medicine", "Batch", "Expiry", "Qty", "Days Left", "Value at Risk (UGX)"],
    ...rows.map((r) => [r.medicines?.name || "—", r.batch_number, r.expiry_date, r.qty_remaining,
      Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / 86400000),
      Math.round((r.mrp || r.purchase_cost || 0) * r.qty_remaining)]),
  ]);

  return (
    <div>
      <div className="flex gap-2 mb-4 print:hidden">
        {[30, 60, 90].map((d) => (
          <Button key={d} variant={bucket === d ? "default" : "outline"} size="sm" onClick={() => setBucket(d as 30 | 60 | 90)}>
            Next {d} days
          </Button>
        ))}
      </div>
      <ToolBar onExport={exportCsv} />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr><th className="text-left p-3">Medicine</th><th className="text-left p-3">Batch</th><th className="text-left p-3">Expiry</th><th className="text-right p-3">Qty</th><th className="text-right p-3">Days Left</th><th className="text-right p-3">Value at Risk</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const daysLeft = Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / 86400000);
              const value = (r.mrp || r.purchase_cost || 0) * r.qty_remaining;
              const cls = daysLeft < 30 ? "text-destructive" : daysLeft < 60 ? "text-amber-600" : "text-yellow-600";
              return (
                <tr key={r.id}>
                  <td className="p-3">{r.medicines?.name || "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.batch_number}</td>
                  <td className="p-3">{r.expiry_date}</td>
                  <td className="p-3 text-right">{r.qty_remaining}</td>
                  <td className={`p-3 text-right font-medium ${cls}`}>{daysLeft}</td>
                  <td className="p-3 text-right font-semibold">{ugx(value)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No batches expiring in this window.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ──────────────────────────────────────── RECEIVABLES AGING
const ReceivablesAging = () => {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: customers } = await supabase.from("customer_credits")
        .select("id,customer_name,customer_phone,credit_balance,last_purchase_date")
        .gt("credit_balance", 0).order("credit_balance", { ascending: false });
      const now = Date.now();
      const out = (customers ?? []).map((c: any) => {
        const days = c.last_purchase_date ? Math.floor((now - new Date(c.last_purchase_date).getTime()) / 86400000) : 0;
        const bal = Number(c.credit_balance);
        return {
          ...c, days,
          b1: days <= 30 ? bal : 0,
          b2: days > 30 && days <= 60 ? bal : 0,
          b3: days > 60 && days <= 90 ? bal : 0,
          b4: days > 90 ? bal : 0,
        };
      });
      setRows(out);
    })();
  }, []);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    b1: t.b1 + r.b1, b2: t.b2 + r.b2, b3: t.b3 + r.b3, b4: t.b4 + r.b4,
    all: t.all + r.credit_balance,
  }), { b1: 0, b2: 0, b3: 0, b4: 0, all: 0 }), [rows]);

  const exportCsv = () => downloadCsv("receivables-aging.csv", [
    ["Customer", "Phone", "0-30", "31-60", "61-90", "90+", "Total"],
    ...rows.map((r) => [r.customer_name, r.customer_phone || "", r.b1, r.b2, r.b3, r.b4, r.credit_balance]),
    ["", "TOTAL", totals.b1, totals.b2, totals.b3, totals.b4, totals.all],
  ]);

  return (
    <div>
      <ToolBar onExport={exportCsv} />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr><th className="text-left p-3">Customer</th><th className="text-right p-3">0-30 d</th><th className="text-right p-3">31-60 d</th><th className="text-right p-3">61-90 d</th><th className="text-right p-3">90+ d</th><th className="text-right p-3">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3"><div className="font-medium">{r.customer_name}</div><div className="text-xs text-muted-foreground">{r.customer_phone}</div></td>
                <td className="p-3 text-right">{r.b1 ? ugx(r.b1) : "—"}</td>
                <td className="p-3 text-right">{r.b2 ? ugx(r.b2) : "—"}</td>
                <td className="p-3 text-right text-amber-600">{r.b3 ? ugx(r.b3) : "—"}</td>
                <td className="p-3 text-right text-destructive">{r.b4 ? ugx(r.b4) : "—"}</td>
                <td className="p-3 text-right font-semibold">{ugx(r.credit_balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No outstanding receivables.</td></tr>}
          </tbody>
          <tfoot className="bg-muted/30 font-semibold">
            <tr><td className="p-3">TOTAL</td>
              <td className="p-3 text-right">{ugx(totals.b1)}</td>
              <td className="p-3 text-right">{ugx(totals.b2)}</td>
              <td className="p-3 text-right">{ugx(totals.b3)}</td>
              <td className="p-3 text-right">{ugx(totals.b4)}</td>
              <td className="p-3 text-right text-primary">{ugx(totals.all)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ──────────────────────────────────────── HUB
const ReportsHubPage = () => {
  return (
    <div>
      <Tabs defaultValue="trial">
        <TabsList className="grid grid-cols-3 md:grid-cols-7 mb-4 print:hidden">
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          <TabsTrigger value="pl">P &amp; L</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="vat">VAT Return</TabsTrigger>
          <TabsTrigger value="stock">Stock Valuation</TabsTrigger>
          <TabsTrigger value="expiry">Expiry</TabsTrigger>
          <TabsTrigger value="ar">Receivables</TabsTrigger>
        </TabsList>
        <TabsContent value="trial"><TrialBalance /></TabsContent>
        <TabsContent value="pl"><ProfitLoss /></TabsContent>
        <TabsContent value="bs"><BalanceSheet /></TabsContent>
        <TabsContent value="vat"><VatReturn /></TabsContent>
        <TabsContent value="stock"><StockValuation /></TabsContent>
        <TabsContent value="expiry"><ExpiryReport /></TabsContent>
        <TabsContent value="ar"><ReceivablesAging /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsHubPage;

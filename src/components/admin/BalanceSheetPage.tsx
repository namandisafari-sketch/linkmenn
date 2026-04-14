import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, TrendingUp, TrendingDown, Scale, ChevronDown, ChevronRight } from "lucide-react";

interface LedgerEntry {
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  entry_date: string;
}

interface AccountSummary {
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

const BalanceSheetPage = () => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"balance_sheet" | "pnl">("pnl");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase.from("general_ledger").select("account_name, account_type, debit, credit, entry_date").lte("entry_date", asOfDate);
      setEntries((data as LedgerEntry[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [asOfDate]);

  const accounts = useMemo(() => {
    const map = new Map<string, AccountSummary>();
    entries.forEach(e => {
      const key = `${e.account_name}|${e.account_type}`;
      const existing = map.get(key) || { name: e.account_name, type: e.account_type, totalDebit: 0, totalCredit: 0, balance: 0 };
      existing.totalDebit += e.debit;
      existing.totalCredit += e.credit;
      existing.balance = existing.totalDebit - existing.totalCredit;
      map.set(key, existing);
    });
    return Array.from(map.values());
  }, [entries]);

  const grouped = useMemo(() => {
    const groups: Record<string, AccountSummary[]> = {};
    accounts.forEach(a => {
      const type = a.type || "other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(a);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)));
    return groups;
  }, [accounts]);

  // P&L computation
  const pnl = useMemo(() => {
    const income = accounts.filter(a => a.type === "income").reduce((s, a) => s + a.totalCredit - a.totalDebit, 0);
    const expense = accounts.filter(a => a.type === "expense").reduce((s, a) => s + a.totalDebit - a.totalCredit, 0);
    const cogs = accounts.filter(a => a.type === "cost_of_goods" || a.name.toLowerCase().includes("cost of goods")).reduce((s, a) => s + a.totalDebit - a.totalCredit, 0);
    return { income, expense, cogs, grossProfit: income - cogs, netProfit: income - cogs - expense };
  }, [accounts]);

  // Balance Sheet computation
  const bs = useMemo(() => {
    const assets = accounts.filter(a => a.type === "asset").reduce((s, a) => s + a.totalDebit - a.totalCredit, 0);
    const liabilities = accounts.filter(a => a.type === "liability").reduce((s, a) => s + a.totalCredit - a.totalDebit, 0);
    const equity = accounts.filter(a => a.type === "equity").reduce((s, a) => s + a.totalCredit - a.totalDebit, 0);
    return { assets, liabilities, equity, total: liabilities + equity + pnl.netProfit };
  }, [accounts, pnl]);

  const typeLabels: Record<string, string> = {
    asset: "Assets", liability: "Liabilities", equity: "Equity",
    income: "Income / Revenue", expense: "Expenses", cost_of_goods: "Cost of Goods Sold",
    other: "Other",
  };

  const typeOrder = viewMode === "pnl"
    ? ["income", "cost_of_goods", "expense"]
    : ["asset", "liability", "equity"];

  const printReport = () => {
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    const title = viewMode === "pnl" ? "Profit & Loss Statement" : "Balance Sheet";
    const rows = typeOrder.filter(t => grouped[t]?.length).map(type => {
      const accs = grouped[type] || [];
      const total = accs.reduce((s, a) => s + Math.abs(a.balance), 0);
      return `<tr style="background:#f3f4f6;"><td colspan="3" style="font-weight:900;padding:8px 12px;">${typeLabels[type] || type}</td></tr>
        ${accs.map(a => `<tr><td style="padding:4px 12px 4px 24px;">${a.name}</td><td style="text-align:right;padding:4px 12px;">UGX ${a.totalDebit.toLocaleString()}</td><td style="text-align:right;padding:4px 12px;">UGX ${a.totalCredit.toLocaleString()}</td></tr>`).join("")}
        <tr style="border-top:2px solid #000;"><td style="padding:4px 12px;font-weight:800;">Total ${typeLabels[type] || type}</td><td colspan="2" style="text-align:right;padding:4px 12px;font-weight:900;">UGX ${total.toLocaleString()}</td></tr>`;
    }).join("");
    win.document.write(`<html><head><title>${title}</title><style>body{font-family:Inter,sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;}td,th{border-bottom:1px solid #e5e7eb;}</style></head><body>
      <h1 style="font-size:20px;margin-bottom:4px;">${title}</h1>
      <p style="color:#666;font-size:12px;">As of ${new Date(asOfDate).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })}</p>
      <table><thead><tr><th style="text-align:left;padding:8px 12px;">Account</th><th style="text-align:right;padding:8px 12px;">Debit</th><th style="text-align:right;padding:8px 12px;">Credit</th></tr></thead><tbody>${rows}</tbody></table>
      ${viewMode === "pnl" ? `<div style="margin-top:20px;padding:12px;background:#ecfdf5;border:2px solid #10b981;border-radius:8px;">
        <p><strong>Gross Profit:</strong> UGX ${pnl.grossProfit.toLocaleString()}</p>
        <p style="font-size:18px;font-weight:900;margin-top:8px;"><strong>Net Profit:</strong> UGX ${pnl.netProfit.toLocaleString()}</p>
      </div>` : `<div style="margin-top:20px;padding:12px;background:#eff6ff;border:2px solid #3b82f6;border-radius:8px;">
        <p><strong>Total Assets:</strong> UGX ${bs.assets.toLocaleString()}</p>
        <p><strong>Total Liabilities + Equity:</strong> UGX ${bs.total.toLocaleString()}</p>
      </div>`}
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6">
      {/* Toggle + Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setViewMode("pnl")} className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === "pnl" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>
            Profit & Loss
          </button>
          <button onClick={() => setViewMode("balance_sheet")} className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === "balance_sheet" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>
            Balance Sheet
          </button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">As of Date</label>
          <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" onClick={printReport} className="gap-1.5 ml-auto">
          <Printer className="h-4 w-4" /> Print Report
        </Button>
      </div>

      {/* Summary Cards */}
      {viewMode === "pnl" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-black text-green-600 mt-1">UGX {pnl.income.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Cost of Goods</p>
            <p className="text-xl font-black text-orange-600 mt-1">UGX {pnl.cogs.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Gross Profit</p>
            <p className="text-xl font-black mt-1">UGX {pnl.grossProfit.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">Net Profit</p>
              {pnl.netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-green-600" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
            </div>
            <p className={`text-xl font-black mt-1 ${pnl.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>UGX {pnl.netProfit.toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Total Assets</p>
            <p className="text-xl font-black text-green-600 mt-1">UGX {bs.assets.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Total Liabilities</p>
            <p className="text-xl font-black text-orange-600 mt-1">UGX {bs.liabilities.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">Equity + Retained Earnings</p>
              <Scale className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-xl font-black mt-1">UGX {(bs.equity + pnl.netProfit).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Account Groups */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {typeOrder.filter(t => grouped[t]?.length).map(type => {
            const accs = grouped[type] || [];
            const isExpanded = expandedGroup === type;
            const groupTotal = accs.reduce((s, a) => s + Math.abs(a.balance), 0);
            return (
              <div key={type} className="bg-card rounded-xl border border-border overflow-hidden">
                <button onClick={() => setExpandedGroup(isExpanded ? null : type)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-bold text-sm">{typeLabels[type] || type}</span>
                    <Badge variant="outline" className="text-[10px]">{accs.length} accounts</Badge>
                  </div>
                  <span className="font-black text-sm">UGX {groupTotal.toLocaleString()}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-5 py-2.5 font-medium">Account Name</th>
                          <th className="text-right px-5 py-2.5 font-medium">Debit</th>
                          <th className="text-right px-5 py-2.5 font-medium">Credit</th>
                          <th className="text-right px-5 py-2.5 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accs.map(a => (
                          <tr key={a.name} className="border-t border-border hover:bg-accent/30">
                            <td className="px-5 py-2 font-semibold">{a.name}</td>
                            <td className="px-5 py-2 text-right text-green-600 font-medium">{a.totalDebit > 0 ? `UGX ${a.totalDebit.toLocaleString()}` : "—"}</td>
                            <td className="px-5 py-2 text-right text-blue-600 font-medium">{a.totalCredit > 0 ? `UGX ${a.totalCredit.toLocaleString()}` : "—"}</td>
                            <td className="px-5 py-2 text-right font-bold">{a.balance >= 0 ? "" : "-"}UGX {Math.abs(a.balance).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default BalanceSheetPage;

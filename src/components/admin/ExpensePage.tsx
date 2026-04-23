import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Save, Trash2, TrendingUp, TrendingDown, DollarSign,
  PercentCircle, Calendar, Keyboard,
} from "lucide-react";

interface ExpenseEntry {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}

const EXPENSE_CATEGORIES = [
  "Rent", "Utilities", "Salaries", "Transport", "Supplies",
  "Maintenance", "Marketing", "Insurance", "Taxes", "Miscellaneous",
];

const ExpensePage = () => {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New expense form
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Revenue stats
  const [revenue, setRevenue] = useState({ today: 0, month: 0 });

  // Filter
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const descRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);

  // Fetch expenses from general_ledger
  const fetchData = async () => {
    setLoading(true);
    const startOfMonth = `${filterMonth}-01`;
    const endDate = new Date(parseInt(filterMonth.split("-")[0]), parseInt(filterMonth.split("-")[1]), 0);
    const endOfMonth = `${filterMonth}-${String(endDate.getDate()).padStart(2, "0")}`;

    const [expRes, revenueRes, monthRevenueRes] = await Promise.all([
      supabase.from("journal_lines")
        .select("id, account_name, narration, debit, credit, entry_date, account_type")
        .eq("account_type", "expense")
        .gte("entry_date", startOfMonth)
        .lte("entry_date", endOfMonth)
        .order("entry_date", { ascending: false }),
      supabase.from("orders")
        .select("total")
        .gte("created_at", new Date().toISOString().split("T")[0])
        .lte("created_at", new Date().toISOString().split("T")[0] + "T23:59:59"),
      supabase.from("orders")
        .select("total")
        .gte("created_at", startOfMonth)
        .lte("created_at", endOfMonth + "T23:59:59"),
    ]);

    const mapped: ExpenseEntry[] = (expRes.data || []).map((e: any) => ({
      id: e.id,
      category: e.account_name,
      description: e.narration || "",
      amount: e.debit - e.credit,
      date: e.entry_date,
    }));

    setExpenses(mapped);
    setRevenue({
      today: (revenueRes.data || []).reduce((s: number, o: any) => s + o.total, 0),
      month: (monthRevenueRes.data || []).reduce((s: number, o: any) => s + o.total, 0),
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterMonth]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const netProfit = revenue.month - totalExpenses;
  const expenseRatio = revenue.month > 0 ? (totalExpenses / revenue.month) * 100 : 0;

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);

    // Create voucher first
    const voucherNumber = `EXP-${Date.now()}`;
    const { data: voucher, error: vErr } = await supabase.from("journals").insert({
      voucher_number: voucherNumber,
      voucher_type: "payment",
      voucher_date: date,
      total_amount: parseFloat(amount),
      narration: `${category}: ${description}`,
      status: "posted",
    }).select().single();

    if (vErr || !voucher) {
      toast.error("Failed to create voucher");
      setSaving(false);
      return;
    }

    // Create ledger entry for expense (debit)
    const { error } = await supabase.from("journal_lines").insert({
      voucher_id: voucher.id,
      account_name: category,
      account_type: "expense",
      debit: parseFloat(amount),
      credit: 0,
      entry_date: date,
      narration: description || `${category} expense`,
    });

    if (error) {
      toast.error("Failed to save expense");
    } else {
      toast.success(`Expense saved: UGX ${parseFloat(amount).toLocaleString()}`);
      setDescription("");
      setAmount("");
      setCategory(EXPENSE_CATEGORIES[0]);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("journal_lines").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Expense deleted"); fetchData(); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Alt+N → focus description (new expense)
      if (e.altKey && e.key === "n") { e.preventDefault(); descRef.current?.focus(); }
      // Alt+S → save
      if (e.altKey && e.key === "s") { e.preventDefault(); handleSave(); }
      // Enter → move to next input or save
      if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll(".expense-form input, .expense-form select"));
        const idx = inputs.indexOf(e.target);
        if (idx >= 0 && idx < inputs.length - 1) {
          (inputs[idx + 1] as HTMLElement).focus();
        } else {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [amount, description, category, date]);

  return (
    <div className="space-y-6">
      {/* Shortcuts hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Keyboard className="h-3.5 w-3.5" />
        <span><kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-[10px]">Alt+N</kbd> New</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-[10px]">Alt+S</kbd> Save</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-accent font-mono text-[10px]">Enter</kbd> Next field</span>
      </div>

      {/* Revenue vs Expense Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Month Revenue</p>
          </div>
          <p className="text-xl font-black text-green-600 mt-1">UGX {revenue.month.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <p className="text-xs text-muted-foreground">Total Expenses</p>
          </div>
          <p className="text-xl font-black text-destructive mt-1">UGX {totalExpenses.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            {netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            <p className="text-xs text-muted-foreground">Net Profit</p>
          </div>
          <p className={`text-xl font-black mt-1 ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>UGX {netProfit.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <PercentCircle className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Expense Ratio</p>
          </div>
          <p className="text-xl font-black mt-1">{expenseRatio.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Expense Form (Card) */}
        <div className="bg-card rounded-xl border border-border p-5 expense-form">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Expense
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select
                ref={categoryRef}
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="expense-form w-full h-10 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <Input ref={descRef} value={description} onChange={e => setDescription(e.target.value)} placeholder="E.g. Electricity bill" className="expense-form" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Amount (UGX)</label>
              <Input ref={amountRef} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="expense-form" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="expense-form" />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-bold text-sm mb-4">Category Breakdown</h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expenses this month</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map(([cat, total]) => {
                const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cat}</span>
                      <span className="font-bold">UGX {total.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(1)}% of total</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expense List */}
        <div className="bg-card rounded-xl border border-border overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm">Recent Expenses</h3>
            <Input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-40 h-8 text-xs"
            />
          </div>
          <div className="max-h-[400px] overflow-auto divide-y divide-border">
            {loading ? (
              <p className="p-4 text-center text-muted-foreground text-sm">Loading...</p>
            ) : expenses.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground text-sm">No expenses found</p>
            ) : expenses.map(e => (
              <div key={e.id} className="p-3 flex items-center justify-between hover:bg-accent/30 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{e.category}</Badge>
                    <span className="text-xs text-muted-foreground">{e.date}</span>
                  </div>
                  <p className="text-sm font-medium mt-0.5">{e.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-destructive">UGX {e.amount.toLocaleString()}</span>
                  <button onClick={() => handleDelete(e.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensePage;

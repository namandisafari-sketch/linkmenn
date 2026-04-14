import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, CreditCard, Phone, User, X, History, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface CustomerCredit {
  id: string;
  customer_phone: string;
  customer_name: string;
  credit_balance: number;
  total_spent: number;
  total_paid: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  order_id: string | null;
  created_at: string;
  customer_credit_id: string;
}

const CustomerCreditsPage = () => {
  const [customers, setCustomers] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCredit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const [allTransactions, setAllTransactions] = useState<CreditTransaction[]>([]);

  const fetchCustomers = async () => {
    setLoading(true);
    const [{ data: custs }, { data: txs }] = await Promise.all([
      supabase.from("customer_credits").select("*").order("customer_name"),
      supabase.from("credit_transactions").select("*").eq("type", "purchase").order("created_at", { ascending: false }),
    ]);
    setCustomers((custs as CustomerCredit[]) || []);
    setAllTransactions((txs as CreditTransaction[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_phone.includes(search)
  );

  const totalOutstanding = customers.reduce((s, c) => s + Math.max(0, c.credit_balance), 0);
  const totalSpent = customers.reduce((s, c) => s + c.total_spent, 0);
  const totalPaid = customers.reduce((s, c) => s + c.total_paid, 0);

  // Credit Aging: categorize outstanding into Current (<30d), 30 Days (30-60d), 60+ Days
  const now = new Date();
  const agingData = (() => {
    let current = 0, thirtyDays = 0, sixtyPlus = 0;
    // For each customer with outstanding balance, check their oldest unpaid transaction
    customers.filter(c => c.credit_balance > 0).forEach(c => {
      const customerTxs = allTransactions.filter(t => t.customer_credit_id === c.id);
      if (customerTxs.length === 0) {
        // Use created_at of the customer record
        const daysSince = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 60) sixtyPlus += c.credit_balance;
        else if (daysSince >= 30) thirtyDays += c.credit_balance;
        else current += c.credit_balance;
      } else {
        // Use oldest purchase transaction date
        const oldest = customerTxs[customerTxs.length - 1];
        const daysSince = Math.floor((now.getTime() - new Date(oldest.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 60) sixtyPlus += c.credit_balance;
        else if (daysSince >= 30) thirtyDays += c.credit_balance;
        else current += c.credit_balance;
      }
    });
    return { current, thirtyDays, sixtyPlus };
  })();

  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const newPaid = selectedCustomer.total_paid + amount;
    const newBalance = selectedCustomer.total_spent - newPaid;

    const { error } = await supabase
      .from("customer_credits")
      .update({ total_paid: newPaid, credit_balance: newBalance } as any)
      .eq("id", selectedCustomer.id);

    if (error) { toast.error(error.message); return; }

    // Record transaction
    await supabase.from("credit_transactions").insert({
      customer_credit_id: selectedCustomer.id,
      type: "payment",
      amount,
      description: paymentNote || `Payment of UGX ${amount.toLocaleString()}`,
    } as any);

    toast.success(`Recorded UGX ${amount.toLocaleString()} payment from ${selectedCustomer.customer_name}`);
    setEditOpen(false);
    setPaymentAmount("");
    setPaymentNote("");
    setSelectedCustomer(null);
    fetchCustomers();
  };

  const viewAccount = async (customer: CustomerCredit) => {
    setSelectedCustomer(customer);
    setTxLoading(true);
    setDetailOpen(true);

    const { data } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("customer_credit_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions((data as CreditTransaction[]) || []);
    setTxLoading(false);
  };

  const openWhatsApp = (customer: CustomerCredit) => {
    const phone = customer.customer_phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Hi ${customer.customer_name}, your current balance at Marvid Pharmaceutical is UGX ${customer.credit_balance.toLocaleString()}. Thank you!`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Credit Issued</p>
          <p className="text-xl font-bold mt-1">UGX {totalSpent.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="text-xl font-bold mt-1 text-primary">UGX {totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Outstanding Balance</p>
          <p className="text-xl font-bold mt-1 text-destructive">UGX {totalOutstanding.toLocaleString()}</p>
        </div>
      </div>

      {/* Credit Aging Breakdown */}
      {totalOutstanding > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold mb-3 uppercase tracking-wide text-muted-foreground">📊 Credit Aging Analysis</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Current (&lt;30 days)</p>
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-1">UGX {agingData.current.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500">{totalOutstanding > 0 ? Math.round(agingData.current / totalOutstanding * 100) : 0}%</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">30 Days</p>
              <p className="text-lg font-bold text-amber-800 dark:text-amber-300 mt-1">UGX {agingData.thirtyDays.toLocaleString()}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500">{totalOutstanding > 0 ? Math.round(agingData.thirtyDays / totalOutstanding * 100) : 0}%</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">60+ Days</p>
              <p className="text-lg font-bold text-red-800 dark:text-red-300 mt-1">UGX {agingData.sixtyPlus.toLocaleString()}</p>
              <p className="text-[10px] text-red-600 dark:text-red-500">{totalOutstanding > 0 ? Math.round(agingData.sixtyPlus / totalOutstanding * 100) : 0}%</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex h-3 rounded-full overflow-hidden mt-3">
            {agingData.current > 0 && <div className="bg-emerald-500" style={{ width: `${agingData.current / totalOutstanding * 100}%` }} />}
            {agingData.thirtyDays > 0 && <div className="bg-amber-500" style={{ width: `${agingData.thirtyDays / totalOutstanding * 100}%` }} />}
            {agingData.sixtyPlus > 0 && <div className="bg-red-500" style={{ width: `${agingData.sixtyPlus / totalOutstanding * 100}%` }} />}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{customers.length} accounts</Badge>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No customer accounts found</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => viewAccount(c)}>
                <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{c.customer_name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {c.customer_phone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                  <p className="font-medium text-sm">UGX {c.total_spent.toLocaleString()}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="font-medium text-sm">UGX {c.total_paid.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <Badge variant={c.credit_balance > 0 ? "destructive" : "secondary"} className="text-xs">
                    UGX {c.credit_balance.toLocaleString()}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => viewAccount(c)} title="View account">
                    <History className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedCustomer(c); setEditOpen(true); }} title="Record payment">
                    <CreditCard className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-green-600" onClick={() => openWhatsApp(c)} title="WhatsApp">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Payment Modal */}
      {editOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-sm">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-bold">Record Payment</h2>
              <button onClick={() => { setEditOpen(false); setSelectedCustomer(null); }}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{selectedCustomer.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="font-bold text-destructive">UGX {selectedCustomer.credit_balance.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Amount (UGX)</label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Note (optional)</label>
                <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. Cash payment" />
              </div>
              <Button className="w-full" onClick={handleRecordPayment}>Record Payment</Button>
            </div>
          </div>
        </div>
      )}

      {/* Account Detail Modal */}
      {detailOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{selectedCustomer.customer_name}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedCustomer.customer_phone}</p>
              </div>
              <button onClick={() => { setDetailOpen(false); setSelectedCustomer(null); }}><X className="h-5 w-5" /></button>
            </div>

            {/* Account summary */}
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="font-bold text-sm">UGX {selectedCustomer.total_spent.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="font-bold text-sm text-primary">UGX {selectedCustomer.total_paid.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={`font-bold text-sm ${selectedCustomer.credit_balance > 0 ? "text-destructive" : "text-primary"}`}>
                  UGX {selectedCustomer.credit_balance.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Transaction history */}
            <div className="flex-1 overflow-auto p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <History className="h-4 w-4" /> Transaction History
              </h3>
              {txLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions recorded yet. Future purchases and payments will appear here.</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        tx.type === "payment" ? "bg-primary/10" : "bg-destructive/10"
                      }`}>
                        {tx.type === "payment" ? (
                          <ArrowDownLeft className="h-4 w-4 text-primary" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{tx.type}</p>
                        <p className="text-xs text-muted-foreground">{tx.description || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${tx.type === "payment" ? "text-primary" : "text-destructive"}`}>
                          {tx.type === "payment" ? "+" : "-"} UGX {tx.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDetailOpen(false); setSelectedCustomer(null); setEditOpen(true); }}>
                <CreditCard className="h-4 w-4 mr-1" /> Record Payment
              </Button>
              <Button variant="outline" className="flex-1 text-green-600" onClick={() => openWhatsApp(selectedCustomer)}>
                <Wallet className="h-4 w-4 mr-1" /> Send Balance
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerCreditsPage;

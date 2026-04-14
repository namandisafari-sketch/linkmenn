import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus, Search, FileText, DollarSign, ArrowDownLeft, ArrowUpRight,
  BookOpen, Receipt, CreditCard, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

type VoucherType = "sales" | "purchase" | "receipt" | "payment" | "journal";

interface PurchaseInvoice {
  id: string;
  voucher_id: string;
  supplier_name: string;
  invoice_number: string | null;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
}

const ACCOUNT_TYPES = ["asset", "liability", "income", "expense", "equity"];

const generateVoucherNumber = (type: VoucherType) => {
  const prefix = { sales: "SV", purchase: "PV", receipt: "RV", payment: "PY", journal: "JV" }[type];
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
};

const AccountingPage = () => {
  const { user } = useAuth();
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInvoice, setSearchInvoice] = useState("");

  // Voucher form
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    voucher_type: "sales" as VoucherType,
    party_name: "",
    narration: "",
    entries: [
      { account_name: "", account_type: "income", debit: 0, credit: 0 },
      { account_name: "", account_type: "asset", debit: 0, credit: 0 },
    ],
  });
  const [saving, setSaving] = useState(false);

  // Payment settlement
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<PurchaseInvoice[]>([]);
  const [settlementAmounts, setSettlementAmounts] = useState<Record<string, number>>({});
  const [settlementParty, setSettlementParty] = useState("");

  // Stats
  const [recentVoucherCount, setRecentVoucherCount] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: pi }, { count }] = await Promise.all([
      supabase.from("purchase_invoices").select("*").order("invoice_date", { ascending: false }),
      supabase.from("vouchers").select("*", { count: "exact", head: true }),
    ]);
    setPurchaseInvoices((pi as PurchaseInvoice[]) || []);
    setRecentVoucherCount(count || 0);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Voucher form helpers
  const addEntry = () => {
    setVoucherForm(prev => ({
      ...prev,
      entries: [...prev.entries, { account_name: "", account_type: "asset", debit: 0, credit: 0 }],
    }));
  };

  const removeEntry = (idx: number) => {
    setVoucherForm(prev => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== idx),
    }));
  };

  const updateEntry = (idx: number, field: string, value: any) => {
    setVoucherForm(prev => ({
      ...prev,
      entries: prev.entries.map((e, i) => i === idx ? { ...e, [field]: value } : e),
    }));
  };

  const totalDebit = voucherForm.entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
  const totalCredit = voucherForm.entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleCreateVoucher = async () => {
    if (!isBalanced) { toast.error("Debit and Credit must be equal"); return; }
    if (voucherForm.entries.some(e => !e.account_name)) { toast.error("All accounts must be named"); return; }

    setSaving(true);
    try {
      const voucherNumber = generateVoucherNumber(voucherForm.voucher_type);
      const { data: voucher, error: vErr } = await supabase.from("vouchers").insert({
        voucher_number: voucherNumber,
        voucher_type: voucherForm.voucher_type,
        party_name: voucherForm.party_name || null,
        narration: voucherForm.narration || null,
        total_amount: totalDebit,
        created_by: user?.id,
      } as any).select().single();
      if (vErr) throw vErr;

      const ledgerRows = voucherForm.entries.map(e => ({
        voucher_id: (voucher as any).id,
        account_name: e.account_name,
        account_type: e.account_type,
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0,
        narration: voucherForm.narration || null,
      }));
      const { error: lErr } = await supabase.from("general_ledger").insert(ledgerRows as any);
      if (lErr) throw lErr;

      if (voucherForm.voucher_type === "purchase" && voucherForm.party_name) {
        await supabase.from("purchase_invoices").insert({
          voucher_id: (voucher as any).id,
          supplier_name: voucherForm.party_name,
          invoice_number: voucherNumber,
          total_amount: totalDebit,
          amount_paid: 0,
          status: "unpaid",
        } as any);
      }

      toast.success(`Voucher ${voucherNumber} created`);
      setVoucherDialogOpen(false);
      setVoucherForm({
        voucher_type: "sales",
        party_name: "",
        narration: "",
        entries: [
          { account_name: "", account_type: "income", debit: 0, credit: 0 },
          { account_name: "", account_type: "asset", debit: 0, credit: 0 },
        ],
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create voucher");
    } finally {
      setSaving(false);
    }
  };

  // Payment settlement
  const openSettlement = async () => {
    const { data } = await supabase.from("purchase_invoices").select("*").in("status", ["unpaid", "partial"]).order("invoice_date");
    setUnpaidInvoices((data as PurchaseInvoice[]) || []);
    setSettlementAmounts({});
    setSettlementParty("");
    setSettlementOpen(true);
  };

  const handleSettlement = async () => {
    const entries = Object.entries(settlementAmounts).filter(([, amt]) => amt > 0);
    if (entries.length === 0) { toast.error("Select invoices to settle"); return; }

    setSaving(true);
    try {
      const totalSettled = entries.reduce((s, [, a]) => s + a, 0);
      const voucherNumber = generateVoucherNumber("payment");

      const { data: voucher, error: vErr } = await supabase.from("vouchers").insert({
        voucher_number: voucherNumber,
        voucher_type: "payment",
        party_name: settlementParty || "Supplier Payment",
        narration: `Bill settlement for ${entries.length} invoice(s)`,
        total_amount: totalSettled,
        created_by: user?.id,
      } as any).select().single();
      if (vErr) throw vErr;

      await supabase.from("general_ledger").insert([
        { voucher_id: (voucher as any).id, account_name: "Accounts Payable", account_type: "liability", debit: totalSettled, credit: 0, narration: "Bill settlement" },
        { voucher_id: (voucher as any).id, account_name: "Cash/Bank", account_type: "asset", debit: 0, credit: totalSettled, narration: "Bill settlement" },
      ] as any);

      for (const [invoiceId, amount] of entries) {
        const invoice = unpaidInvoices.find(i => i.id === invoiceId);
        if (!invoice) continue;
        const newPaid = invoice.amount_paid + amount;
        const newStatus = newPaid >= invoice.total_amount ? "paid" : "partial";
        await supabase.from("purchase_invoices").update({
          amount_paid: newPaid,
          amount_due: invoice.total_amount - newPaid,
          status: newStatus,
        } as any).eq("id", invoiceId);
      }

      toast.success(`Settled ${entries.length} invoice(s) — UGX ${totalSettled.toLocaleString()}`);
      setSettlementOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Settlement failed");
    } finally {
      setSaving(false);
    }
  };

  const unpaidCount = purchaseInvoices.filter(i => i.status !== "paid").length;
  const outstandingTotal = purchaseInvoices.reduce((s, i) => s + i.amount_due, 0);

  const filteredInvoices = purchaseInvoices.filter(inv => {
    if (!searchInvoice) return true;
    const s = searchInvoice.toLowerCase();
    return inv.supplier_name.toLowerCase().includes(s) || (inv.invoice_number || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => setVoucherDialogOpen(true)} className="bg-card rounded-xl border border-border p-5 text-left hover:border-primary/50 hover:shadow-md transition-all group">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-sm">Create Voucher</span>
          </div>
          <p className="text-xs text-muted-foreground">Sales, Purchase, Receipt, Payment, or Journal voucher</p>
        </button>

        <button onClick={openSettlement} className="bg-card rounded-xl border border-border p-5 text-left hover:border-primary/50 hover:shadow-md transition-all group">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <span className="font-bold text-sm">Settle Bills</span>
          </div>
          <p className="text-xs text-muted-foreground">{unpaidCount} unpaid invoice{unpaidCount !== 1 ? "s" : ""} pending</p>
        </button>

        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Vouchers</p>
          <p className="text-2xl font-black mt-1">{recentVoucherCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">View all in Day Book →</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground font-medium">Outstanding Payables</p>
          <p className="text-2xl font-black mt-1 text-destructive">UGX {outstandingTotal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{unpaidCount} unpaid invoices</p>
        </div>
      </div>

      {/* Purchase Invoices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Purchase Invoices</h3>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={searchInvoice} onChange={e => setSearchInvoice(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : filteredInvoices.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No invoices found</p>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold">Invoice #</th>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-right">Paid</th>
                  <th className="px-4 py-3 font-semibold text-right">Due</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-bold">{inv.invoice_number || "—"}</td>
                    <td className="px-4 py-3">{inv.supplier_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-right font-bold">UGX {inv.total_amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-bold">UGX {inv.amount_paid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-destructive font-bold">UGX {inv.amount_due.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "partial" ? "secondary" : "destructive"} className="text-xs">
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Voucher Dialog */}
      <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Voucher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Voucher Type</label>
                <select
                  value={voucherForm.voucher_type}
                  onChange={e => setVoucherForm(prev => ({ ...prev, voucher_type: e.target.value as VoucherType }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="sales">Sales Voucher</option>
                  <option value="purchase">Purchase Voucher</option>
                  <option value="receipt">Receipt Voucher</option>
                  <option value="payment">Payment Voucher</option>
                  <option value="journal">Journal Voucher</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Party Name</label>
                <Input value={voucherForm.party_name} onChange={e => setVoucherForm(prev => ({ ...prev, party_name: e.target.value }))} placeholder="Customer / Supplier" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Narration</label>
              <Input value={voucherForm.narration} onChange={e => setVoucherForm(prev => ({ ...prev, narration: e.target.value }))} placeholder="Description of transaction" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Ledger Entries</label>
                <Button size="sm" variant="outline" onClick={addEntry}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
              </div>
              <div className="space-y-2">
                {voucherForm.entries.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4" placeholder="Account name" value={entry.account_name} onChange={e => updateEntry(idx, "account_name", e.target.value)} />
                    <select className="col-span-2 h-10 px-2 rounded-md border border-input bg-background text-xs" value={entry.account_type} onChange={e => updateEntry(idx, "account_type", e.target.value)}>
                      {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Input className="col-span-2" type="number" placeholder="Debit" value={entry.debit || ""} onChange={e => updateEntry(idx, "debit", Number(e.target.value))} />
                    <Input className="col-span-2" type="number" placeholder="Credit" value={entry.credit || ""} onChange={e => updateEntry(idx, "credit", Number(e.target.value))} />
                    <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-destructive" onClick={() => removeEntry(idx)} disabled={voucherForm.entries.length <= 2}>×</Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3 text-sm font-bold border-t border-border pt-2">
                <span>Total Debit: UGX {totalDebit.toLocaleString()}</span>
                <span>Total Credit: UGX {totalCredit.toLocaleString()}</span>
                <span className={isBalanced ? "text-green-600" : "text-destructive"}>
                  {isBalanced ? "✓ Balanced" : "✗ Unbalanced"}
                </span>
              </div>
            </div>

            <Button onClick={handleCreateVoucher} disabled={!isBalanced || saving} className="w-full">
              {saving ? "Creating..." : "Create Voucher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Settlement Dialog */}
      <Dialog open={settlementOpen} onOpenChange={setSettlementOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settle Purchase Invoices</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input value={settlementParty} onChange={e => setSettlementParty(e.target.value)} placeholder="Supplier name (for payment voucher)" />
            {unpaidInvoices.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No unpaid invoices</p>
            ) : (
              <div className="space-y-3">
                {unpaidInvoices.map(inv => (
                  <div key={inv.id} className="bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-sm">{inv.supplier_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{inv.invoice_number}</span>
                      </div>
                      <Badge variant={inv.status === "partial" ? "secondary" : "destructive"} className="text-xs">{inv.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>Total: UGX {inv.total_amount.toLocaleString()}</span>
                      <span>Paid: UGX {inv.amount_paid.toLocaleString()}</span>
                      <span className="text-destructive font-bold">Due: UGX {inv.amount_due.toLocaleString()}</span>
                    </div>
                    <Input
                      type="number"
                      placeholder={`Pay up to UGX ${inv.amount_due.toLocaleString()}`}
                      value={settlementAmounts[inv.id] || ""}
                      onChange={e => setSettlementAmounts(prev => ({ ...prev, [inv.id]: Math.min(Number(e.target.value), inv.amount_due) }))}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="font-bold">Total Settlement: UGX {Object.values(settlementAmounts).reduce((s, a) => s + a, 0).toLocaleString()}</span>
              <Button onClick={handleSettlement} disabled={saving || Object.values(settlementAmounts).every(a => !a)}>
                {saving ? "Processing..." : "Confirm Settlement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountingPage;

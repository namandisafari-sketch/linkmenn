import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Search, Save, Loader2, ClipboardList, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface BatchWithProduct {
  id: string;
  product_id: string;
  product_name: string;
  batch_number: string | null;
  quantity: number;
  expiry_date: string;
  mfg_date: string | null;
  purchase_price: number;
  mrp: number;
}

interface AdjustmentLog {
  id: string;
  batch_id: string;
  product_name: string;
  batch_number: string;
  old_quantity: number;
  new_quantity: number;
  reason: string;
  adjusted_by: string;
  adjusted_at: string;
}

const REASONS = [
  "Damaged",
  "Expired - Disposed",
  "Stocktake Correction",
  "Theft / Shrinkage",
  "Returned to Supplier",
  "Sample / Giveaway",
  "Other",
];

const StockUpdatePage = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BatchWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Adjustment form
  const [selectedBatch, setSelectedBatch] = useState<BatchWithProduct | null>(null);
  const [newQty, setNewQty] = useState(0);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  // Audit log (stored via vouchers with type "journal" and narration prefix)
  const [adjustmentLogs, setAdjustmentLogs] = useState<AdjustmentLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("medicine_batches").select("*").order("expiry_date"),
      supabase.from("medicines").select("id, name").order("name"),
    ]);

    const productMap: Record<string, string> = {};
    (p || []).forEach((prod: any) => { productMap[prod.id] = prod.name; });

    setBatches((b || []).map((batch: any) => ({
      ...batch,
      product_name: productMap[batch.product_id] || "Unknown",
    })));

    // Fetch adjustment logs from vouchers (journal type with stock adjustment narration)
    const { data: vouchers } = await supabase
      .from("journals")
      .select("id, voucher_number, narration, created_at, party_name")
      .eq("voucher_type", "journal")
      .like("narration", "STOCK_ADJ:%")
      .order("created_at", { ascending: false })
      .limit(50);

    const logs: AdjustmentLog[] = (vouchers || []).map((v: any) => {
      // Parse narration: STOCK_ADJ:batchId|productName|batchNum|oldQty|newQty|reason
      const parts = (v.narration || "").replace("STOCK_ADJ:", "").split("|");
      return {
        id: v.id,
        batch_id: parts[0] || "",
        product_name: parts[1] || "",
        batch_number: parts[2] || "",
        old_quantity: Number(parts[3]) || 0,
        new_quantity: Number(parts[4]) || 0,
        reason: parts[5] || "",
        adjusted_by: v.party_name || "Admin",
        adjusted_at: v.created_at,
      };
    });
    setAdjustmentLogs(logs);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdjust = (batch: BatchWithProduct) => {
    setSelectedBatch(batch);
    setNewQty(batch.quantity);
    setReason("");
    setCustomReason("");
  };

  const handleAdjust = async () => {
    if (!selectedBatch) return;
    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) { toast.error("Please select or enter a reason"); return; }
    if (newQty === selectedBatch.quantity) { toast.error("Quantity hasn't changed"); return; }
    if (newQty < 0) { toast.error("Quantity cannot be negative"); return; }

    setSaving(true);
    try {
      const diff = newQty - selectedBatch.quantity;

      // Update batch quantity
      await supabase.from("medicine_batches").update({ quantity: newQty } as any).eq("id", selectedBatch.id);

      // Update product stock
      const { data: prod } = await supabase.from("medicines").select("stock").eq("id", selectedBatch.product_id).single();
      if (prod) {
        await supabase.from("medicines").update({ stock: Math.max(0, prod.stock + diff) }).eq("id", selectedBatch.product_id);
      }

      // Create audit trail via voucher (journal entry)
      const narration = `STOCK_ADJ:${selectedBatch.id}|${selectedBatch.product_name}|${selectedBatch.batch_number || "N/A"}|${selectedBatch.quantity}|${newQty}|${finalReason}`;
      const voucherNumber = `ADJ-${Date.now().toString(36).toUpperCase()}`;

      await supabase.from("journals").insert({
        voucher_number: voucherNumber,
        voucher_type: "journal",
        party_name: user?.email || "Admin",
        narration,
        total_amount: Math.abs(diff * selectedBatch.purchase_price),
        created_by: user?.id,
      } as any);

      // Ledger entries for the adjustment
      const absValue = Math.abs(diff * selectedBatch.purchase_price);
      if (diff < 0) {
        // Stock decrease - debit loss, credit inventory
        await supabase.from("journal_lines").insert([
          { voucher_id: voucherNumber, account_name: "Stock Loss / Write-off", account_type: "expense", debit: absValue, credit: 0, narration: `${finalReason}: ${selectedBatch.product_name}` },
          { voucher_id: voucherNumber, account_name: "Inventory / Stock", account_type: "asset", debit: 0, credit: absValue, narration: `${finalReason}: ${selectedBatch.product_name}` },
        ] as any);
      }

      toast.success(`Stock adjusted: ${selectedBatch.product_name} ${selectedBatch.quantity} → ${newQty}`);
      setSelectedBatch(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Adjustment failed");
    } finally {
      setSaving(false);
    }
  };

  const filtered = batches.filter(b =>
    b.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (b.batch_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const daysUntilExpiry = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex gap-2">
        <Button variant={!showLogs ? "default" : "outline"} onClick={() => setShowLogs(false)} className="gap-2">
          <ClipboardList className="h-4 w-4" /> Adjust Stock
        </Button>
        <Button variant={showLogs ? "default" : "outline"} onClick={() => setShowLogs(true)} className="gap-2">
          <History className="h-4 w-4" /> Audit Log ({adjustmentLogs.length})
        </Button>
      </div>

      {!showLogs ? (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search product or batch..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Batch list */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Batch #</th>
                  <th className="px-4 py-3 font-semibold text-right">Current Qty</th>
                  <th className="px-4 py-3 font-semibold">Expiry</th>
                  <th className="px-4 py-3 font-semibold text-right">Purchase Price</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No batches found</td></tr>
                ) : filtered.map(b => {
                  const days = daysUntilExpiry(b.expiry_date);
                  const isSelected = selectedBatch?.id === b.id;
                  return (
                    <tr key={b.id} className={`hover:bg-muted/30 ${isSelected ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}>
                      <td className="px-4 py-3 font-medium">{b.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{b.batch_number || "—"}</td>
                      <td className="px-4 py-3 text-right font-bold">{b.quantity}</td>
                      <td className="px-4 py-3">
                        {days < 0 ? (
                          <Badge variant="destructive" className="text-xs">Expired</Badge>
                        ) : days <= 90 ? (
                          <Badge className="text-xs bg-amber-500 text-white">{days}d</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{new Date(b.expiry_date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "2-digit" })}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">UGX {b.purchase_price.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={() => openAdjust(b)}>Adjust</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Adjustment form */}
          {selectedBatch && (
            <div className="bg-card rounded-xl border-2 border-primary/30 p-6 space-y-4">
              <h3 className="font-semibold">
                Adjusting: <span className="text-primary">{selectedBatch.product_name}</span>
                <span className="text-muted-foreground font-normal text-sm ml-2">Batch: {selectedBatch.batch_number || "N/A"}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Current Quantity</label>
                  <Input value={selectedBatch.quantity} disabled className="bg-muted" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">New Quantity *</label>
                  <Input type="number" min={0} value={newQty} onChange={e => setNewQty(Number(e.target.value))} />
                  {newQty !== selectedBatch.quantity && (
                    <p className={`text-xs mt-1 font-medium ${newQty < selectedBatch.quantity ? "text-destructive" : "text-green-600"}`}>
                      {newQty > selectedBatch.quantity ? "+" : ""}{newQty - selectedBatch.quantity} units
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Reason *</label>
                  <select
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">Select reason...</option>
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              {reason === "Other" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Specify Reason *</label>
                  <Input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Describe the reason..." />
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleAdjust} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Confirm Adjustment"}
                </Button>
                <Button variant="ghost" onClick={() => setSelectedBatch(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Audit Log */
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold text-right">Old Qty</th>
                <th className="px-4 py-3 font-semibold text-right">New Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Change</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adjustmentLogs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No adjustments recorded yet</td></tr>
              ) : adjustmentLogs.map(log => {
                const diff = log.new_quantity - log.old_quantity;
                return (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(log.adjusted_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-2 font-medium">{log.product_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{log.batch_number}</td>
                    <td className="px-4 py-2 text-right">{log.old_quantity}</td>
                    <td className="px-4 py-2 text-right font-bold">{log.new_quantity}</td>
                    <td className={`px-4 py-2 text-right font-bold ${diff < 0 ? "text-destructive" : "text-green-600"}`}>
                      {diff > 0 ? "+" : ""}{diff}
                    </td>
                    <td className="px-4 py-2">{log.reason}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{log.adjusted_by}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockUpdatePage;

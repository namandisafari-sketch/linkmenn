import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, ShoppingCart, Upload, History, Printer, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "./SearchableSelect";
import CsvImportDialog from "./CsvImportDialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
}

interface LineItem {
  product_id: string;
  product_name: string;
  batch_number: string;
  mfg_date: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
}

interface PurchaseRecord {
  id: string;
  voucher_number: string;
  voucher_date: string;
  party_name: string;
  total_amount: number;
  narration: string;
  status: string;
  created_at: string;
}

const EMPTY_LINE: LineItem = {
  product_id: "",
  product_name: "",
  batch_number: "",
  mfg_date: "",
  expiry_date: "",
  quantity: 1,
  purchase_price: 0,
  selling_price: 0,
};

const StockPurchasePage = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [notes, setNotes] = useState("");

  // History state
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<Record<string, any[]>>({});

  const fetchData = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, name, price, unit").order("name"),
    ]);
    setSuppliers(s || []);
    setProducts(p || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("vouchers")
      .select("id, voucher_number, voucher_date, party_name, total_amount, narration, status, created_at")
      .eq("voucher_type", "purchase")
      .order("created_at", { ascending: false })
      .limit(100);
    setPurchaseHistory((data as PurchaseRecord[]) || []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  const loadPurchaseItems = async (voucherId: string) => {
    if (purchaseItems[voucherId]) return;
    // Get invoice for this voucher
    const { data: invoice } = await supabase
      .from("purchase_invoices")
      .select("*")
      .eq("voucher_id", voucherId)
      .maybeSingle();

    // Get ledger entries
    const { data: ledger } = await supabase
      .from("general_ledger")
      .select("*")
      .eq("voucher_id", voucherId);

    setPurchaseItems(prev => ({
      ...prev,
      [voucherId]: [
        ...(invoice ? [{ type: "invoice", ...invoice }] : []),
        ...(ledger || []).map((l: any) => ({ type: "ledger", ...l })),
      ],
    }));
  };

  const printPurchaseReceipt = (purchase: PurchaseRecord) => {
    const settingsRaw = localStorage.getItem("marvid_receipt_settings");
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {
      businessName: "Marvid Pharmaceutical UG",
      address: "Kampala, Uganda",
      phone: "+256 700 000000",
      paperWidth: "80mm",
      fontSize: "13px",
    };

    const invoiceNum = purchase.narration?.match(/Invoice:\s*([^\s.]+)/)?.[1] || purchase.voucher_number;
    const items = purchaseItems[purchase.id] || [];
    const invoice = items.find((i: any) => i.type === "invoice");

    const receiptHtml = `
      <html><head><title>Purchase Receipt</title>
      <style>
        @page { size: ${settings.paperWidth} auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: ${settings.fontSize}; padding: 14px; color: #0a0a0a; line-height: 1.6; }
        .header { padding-bottom: 12px; border-bottom: 1px dashed #ccc; margin-bottom: 12px; }
        .header-row { display: flex; align-items: center; gap: 10px; }
        .header-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 50%; }
        .header-info { flex: 1; }
        .header h1 { font-size: 18px; font-weight: 900; color: #1a1a1a; margin: 0; }
        .header .contact { font-size: 11px; color: #666; margin-top: 4px; }
        .title { text-align: center; font-size: 14px; font-weight: 800; margin: 12px 0; text-transform: uppercase; letter-spacing: 1px; color: #333; }
        .meta { background: #f0f2f5; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 11px; }
        .meta-row { display: flex; justify-content: space-between; padding: 2px 0; }
        .meta-label { color: #666; font-weight: 600; }
        .meta-value { font-weight: 800; }
        .total { background: #1F617A; color: white; border-radius: 6px; padding: 10px 12px; margin: 12px 0; display: flex; justify-content: space-between; }
        .total-label { font-size: 13px; font-weight: 800; }
        .total-value { font-size: 18px; font-weight: 900; }
        .footer { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ccc; font-size: 10px; color: #999; }
        @media print { .no-print { display: none !important; } }
      </style></head><body>
        <div class="header">
          <div class="header-row">
            ${settings.showLogo && settings.logoUrl ? `<img class="header-logo" src="${settings.logoUrl}" alt="Logo" />` : ''}
            <div class="header-info">
              <h1>${settings.businessName}</h1>
              <div class="contact">${settings.address} · ${settings.phone}</div>
            </div>
          </div>
        </div>
        <div class="title">📦 Stock Purchase Receipt</div>
        <div class="meta">
          <div class="meta-row"><span class="meta-label">Voucher #</span><span class="meta-value">${purchase.voucher_number}</span></div>
          <div class="meta-row"><span class="meta-label">Supplier</span><span class="meta-value">${purchase.party_name || "N/A"}</span></div>
          <div class="meta-row"><span class="meta-label">Invoice #</span><span class="meta-value">${invoiceNum}</span></div>
          <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${format(new Date(purchase.voucher_date), "dd MMM yyyy")}</span></div>
          ${invoice ? `<div class="meta-row"><span class="meta-label">Payment Status</span><span class="meta-value">${(invoice as any).status?.toUpperCase()}</span></div>` : ""}
        </div>
        ${purchase.narration ? `<p style="font-size:11px;color:#555;margin-bottom:8px;">${purchase.narration}</p>` : ""}
        <div class="total">
          <span class="total-label">TOTAL AMOUNT</span>
          <span class="total-value">UGX ${Number(purchase.total_amount).toLocaleString()}</span>
        </div>
        <div class="footer">
          <p>Printed on ${new Date().toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          <p style="margin-top:4px;">Powered by TennaHub Technologies Limited</p>
        </div>
        <div class="no-print" style="text-align:center;margin-top:16px;">
          <button onclick="window.print()" style="background:#1F617A;color:white;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Print</button>
        </div>
      </body></html>
    `;

    const win = window.open("", "_blank", "width=420,height=600");
    if (win) {
      win.document.write(receiptHtml);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name, sublabel: p.unit }));

  const updateLine = (idx: number, field: keyof LineItem, value: any) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === "product_id") {
        const prod = products.find(p => p.id === value);
        if (prod) {
          updated.product_name = prod.name;
          updated.selling_price = prod.price;
        }
      }
      return updated;
    }));
  };

  const addLine = () => setLines(prev => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = lines.reduce((s, l) => s + l.quantity * l.purchase_price, 0);
  const supplierName = suppliers.find(s => s.id === supplierId)?.name || "";

  const handleSave = async () => {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    if (!invoiceNumber.trim()) { toast.error("Enter invoice/receipt number"); return; }
    if (lines.some(l => !l.product_id || !l.expiry_date || !l.batch_number)) {
      toast.error("Each line needs product, batch number, and expiry date");
      return;
    }

    setSaving(true);
    try {
      const voucherNumber = `PV-${Date.now().toString(36).toUpperCase()}`;
      const { data: voucher, error: vErr } = await supabase.from("vouchers").insert({
        voucher_number: voucherNumber,
        voucher_type: "purchase",
        party_name: supplierName,
        narration: `Stock purchase - Invoice: ${invoiceNumber}. ${notes}`.trim(),
        total_amount: totalAmount,
        created_by: user?.id,
      } as any).select().single();
      if (vErr) throw vErr;

      await supabase.from("general_ledger").insert([
        {
          voucher_id: (voucher as any).id,
          account_name: "Inventory / Stock",
          account_type: "asset",
          debit: totalAmount,
          credit: 0,
          narration: `Purchase from ${supplierName} - ${invoiceNumber}`,
        },
        {
          voucher_id: (voucher as any).id,
          account_name: "Accounts Payable",
          account_type: "liability",
          debit: 0,
          credit: totalAmount,
          narration: `Payable to ${supplierName} - ${invoiceNumber}`,
        },
      ] as any);

      await supabase.from("purchase_invoices").insert({
        voucher_id: (voucher as any).id,
        supplier_name: supplierName,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        total_amount: totalAmount,
        amount_paid: 0,
        status: "unpaid",
      } as any);

      for (const line of lines) {
        await supabase.from("product_batches").insert({
          product_id: line.product_id,
          batch_number: line.batch_number,
          mfg_date: line.mfg_date || null,
          expiry_date: line.expiry_date,
          purchase_price: line.purchase_price,
          mrp: line.selling_price,
          quantity: line.quantity,
        } as any);

        const { data: prod } = await supabase.from("products").select("stock").eq("id", line.product_id).single();
        if (prod) {
          await supabase.from("products").update({
            stock: prod.stock + line.quantity,
          }).eq("id", line.product_id);
        }
      }

      toast.success(`Stock purchase saved — Voucher ${voucherNumber}`);
      setSupplierId("");
      setInvoiceNumber("");
      setInvoiceDate(new Date().toISOString().split("T")[0]);
      setLines([{ ...EMPTY_LINE }]);
      setNotes("");
      if (showHistory) fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const filteredHistory = purchaseHistory.filter(p =>
    p.party_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
    p.voucher_number?.toLowerCase().includes(historySearch.toLowerCase()) ||
    p.narration?.toLowerCase().includes(historySearch.toLowerCase())
  );

  if (loading) return <p className="text-center py-8 text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <div className="flex gap-2">
        <Button
          variant={!showHistory ? "default" : "outline"}
          onClick={() => setShowHistory(false)}
          className="gap-2"
        >
          <ShoppingCart className="h-4 w-4" /> New Purchase
        </Button>
        <Button
          variant={showHistory ? "default" : "outline"}
          onClick={() => setShowHistory(true)}
          className="gap-2"
        >
          <History className="h-4 w-4" /> Purchase History
        </Button>
      </div>

      {!showHistory ? (
        <>
          {/* Header info */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Purchase Details
              </h3>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier *</label>
                <SearchableSelect
                  options={supplierOptions}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Search supplier..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice / Receipt # *</label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2026-0042" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice Date</label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                rows={2}
                placeholder="Optional notes about this purchase..."
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-semibold min-w-[200px]">Product</th>
                    <th className="px-3 py-2 font-semibold min-w-[120px]">Batch #</th>
                    <th className="px-3 py-2 font-semibold min-w-[130px]">Mfg Date</th>
                    <th className="px-3 py-2 font-semibold min-w-[130px]">Expiry Date</th>
                    <th className="px-3 py-2 font-semibold text-right min-w-[80px]">Qty</th>
                    <th className="px-3 py-2 font-semibold text-right min-w-[120px]">Purchase Price</th>
                    <th className="px-3 py-2 font-semibold text-right min-w-[120px]">Selling Price</th>
                    <th className="px-3 py-2 font-semibold text-right min-w-[120px]">Line Total</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <SearchableSelect
                          options={productOptions}
                          value={line.product_id}
                          onChange={v => updateLine(idx, "product_id", v)}
                          placeholder="Search product..."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={line.batch_number} onChange={e => updateLine(idx, "batch_number", e.target.value)} className="h-9" placeholder="BT-001" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="date" value={line.mfg_date} onChange={e => updateLine(idx, "mfg_date", e.target.value)} className="h-9" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="date" value={line.expiry_date} onChange={e => updateLine(idx, "expiry_date", e.target.value)} className="h-9" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={1} value={line.quantity} onChange={e => updateLine(idx, "quantity", Number(e.target.value))} className="h-9 text-right" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0} value={line.purchase_price} onChange={e => updateLine(idx, "purchase_price", Number(e.target.value))} className="h-9 text-right" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0} value={line.selling_price} onChange={e => updateLine(idx, "selling_price", Number(e.target.value))} className="h-9 text-right" />
                      </td>
                      <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                        UGX {(line.quantity * line.purchase_price).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-bold">
                    <td colSpan={7} className="px-3 py-3 text-right">Grand Total:</td>
                    <td className="px-3 py-3 text-right text-lg">UGX {totalAmount.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2 px-8">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Purchase & Create Voucher"}
            </Button>
          </div>

          {/* CSV Import Dialog */}
          <CsvImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            target="product_batches"
            onSuccess={fetchData}
          />
        </>
      ) : (
        /* Purchase History */
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by supplier, voucher #, or notes..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16">
              <History className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No purchase records found</p>
              <p className="text-xs text-muted-foreground mt-1">Create a new stock purchase to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((purchase) => {
                const isExpanded = expandedPurchase === purchase.id;
                const items = purchaseItems[purchase.id];
                return (
                  <div key={purchase.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => {
                        setExpandedPurchase(isExpanded ? null : purchase.id);
                        if (!isExpanded) loadPurchaseItems(purchase.id);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-sm">#{purchase.voucher_number}</span>
                          <Badge variant={purchase.status === "approved" ? "default" : "secondary"} className="text-[10px]">
                            {purchase.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{purchase.party_name || "Unknown"}</span>
                          <span>•</span>
                          <span>{format(new Date(purchase.voucher_date), "dd MMM yyyy")}</span>
                        </div>
                        {purchase.narration && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">{purchase.narration}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">UGX {Number(purchase.total_amount).toLocaleString()}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!purchaseItems[purchase.id]) {
                              loadPurchaseItems(purchase.id).then(() => printPurchaseReceipt(purchase));
                            } else {
                              printPurchaseReceipt(purchase);
                            }
                          }}
                          title="Reprint receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3">
                        {!items ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {items.filter((i: any) => i.type === "invoice").map((inv: any) => (
                              <div key={inv.id} className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                                <p className="font-semibold text-sm">Invoice Details</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div><span className="text-muted-foreground">Invoice #:</span> <span className="font-medium">{inv.invoice_number || "N/A"}</span></div>
                                  <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{format(new Date(inv.invoice_date), "dd MMM yyyy")}</span></div>
                                  <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">UGX {Number(inv.total_amount).toLocaleString()}</span></div>
                                  <div><span className="text-muted-foreground">Paid:</span> <span className="font-medium">UGX {Number(inv.amount_paid).toLocaleString()}</span></div>
                                  <div><span className="text-muted-foreground">Due:</span> <span className="font-bold text-destructive">UGX {Number(inv.amount_due).toLocaleString()}</span></div>
                                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={inv.status === "paid" ? "default" : "destructive"} className="text-[10px]">{inv.status}</Badge></div>
                                </div>
                              </div>
                            ))}
                            {items.filter((i: any) => i.type === "ledger").length > 0 && (
                              <div>
                                <p className="text-xs font-semibold mb-2">Ledger Entries</p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground border-b border-border">
                                      <th className="text-left py-1 font-medium">Account</th>
                                      <th className="text-right py-1 font-medium">Debit</th>
                                      <th className="text-right py-1 font-medium">Credit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.filter((i: any) => i.type === "ledger").map((l: any) => (
                                      <tr key={l.id} className="border-b border-border">
                                        <td className="py-1">{l.account_name}</td>
                                        <td className="text-right py-1">{Number(l.debit) > 0 ? `UGX ${Number(l.debit).toLocaleString()}` : "-"}</td>
                                        <td className="text-right py-1">{Number(l.credit) > 0 ? `UGX ${Number(l.credit).toLocaleString()}` : "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            <div className="flex justify-end">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printPurchaseReceipt(purchase)}>
                                <Printer className="h-3.5 w-3.5" /> Reprint Receipt
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockPurchasePage;

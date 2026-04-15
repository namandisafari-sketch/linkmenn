import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, ShoppingCart, Upload, History, Printer, ChevronDown, ChevronUp, Search, Keyboard, Package, Truck, Phone, MapPin, FileText, AlertTriangle, Edit2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "./SearchableSelect";
import CsvImportDialog from "./CsvImportDialog";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Supplier { id: string; name: string; phone: string | null; address: string | null; contact_person: string | null; payment_terms: string | null; }
interface Product { id: string; name: string; price: number; unit: string; buying_price: number | null; }
interface LineItem {
  product_id: string; product_name: string; batch_number: string;
  mfg_date: string; expiry_date: string; quantity: number;
  purchase_price: number; selling_price: number;
}
interface PurchaseRecord {
  id: string; voucher_number: string; voucher_date: string;
  party_name: string; total_amount: number; narration: string;
  status: string; created_at: string;
}

const EMPTY_LINE: LineItem = {
  product_id: "", product_name: "", batch_number: "",
  mfg_date: "", expiry_date: "", quantity: 1,
  purchase_price: 0, selling_price: 0,
};

const INVOICE_STATUSES = [
  { value: "unpaid", label: "Unpaid", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  { value: "taken_back", label: "Taken Back", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "issue_raised", label: "Issue Raised", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
];

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convert(n % 100) : "");
    if (n < 1000000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " Million" + (n % 1000000 ? " " + convert(n % 1000000) : "");
    return convert(Math.floor(n / 1000000000)) + " Billion" + (n % 1000000000 ? " " + convert(n % 1000000000) : "");
  }
  return convert(Math.round(num)) + " Shillings Only";
}

const StockPurchasePage = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [notes, setNotes] = useState("");
  const [activeLineIdx, setActiveLineIdx] = useState(0);

  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<Record<string, any[]>>({});

  // Invoice editing
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: "", amount_paid: 0, due_date: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Overdue notifications
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [showOverduePanel, setShowOverduePanel] = useState(false);

  const invoiceRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("suppliers").select("id, name, phone, address, contact_person, payment_terms").order("name"),
      supabase.from("products").select("id, name, price, unit, buying_price").order("name"),
    ]);
    setSuppliers((s || []) as Supplier[]);
    setProducts((p || []) as Product[]);
    setLoading(false);
  };

  const fetchOverdueInvoices = async () => {
    const { data } = await supabase
      .from("purchase_invoices")
      .select("*")
      .in("status", ["unpaid", "issue_raised"])
      .order("created_at", { ascending: false });
    const overdue = (data || []).filter((inv: any) => {
      if (inv.due_date && differenceInDays(new Date(), new Date(inv.due_date)) > 0) return true;
      if (!inv.due_date && differenceInDays(new Date(), new Date(inv.invoice_date)) > 30) return true;
      return false;
    });
    setOverdueInvoices(overdue);
  };

  useEffect(() => { fetchData(); fetchOverdueInvoices(); }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Enter") {
          e.preventDefault();
          const inputs = document.querySelectorAll<HTMLInputElement>(".purchase-form input, .purchase-form textarea, .purchase-form select, .purchase-form button[role='combobox']");
          const arr = Array.from(inputs);
          const idx = arr.indexOf(e.target as HTMLInputElement);
          if (idx >= 0 && idx < arr.length - 1) arr[idx + 1]?.focus();
        }
        return;
      }
      if (e.altKey && e.key === "n") { e.preventDefault(); addLine(); toast.info("New item added (Alt+N)"); }
      if (e.altKey && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.altKey && e.key === "h") { e.preventDefault(); setShowHistory(prev => !prev); }
      if (e.altKey && e.key === "i") { e.preventDefault(); setImportOpen(true); }
      if (e.altKey && e.key === "r") { e.preventDefault(); resetForm(); toast.info("Form cleared (Alt+R)"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lines, supplierId, invoiceNumber]);

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

  useEffect(() => { if (showHistory) fetchHistory(); }, [showHistory]);

  const loadPurchaseItems = async (voucherId: string) => {
    if (purchaseItems[voucherId]) return purchaseItems[voucherId];
    const [invoiceRes, ledgerRes, voucherItemsRes] = await Promise.all([
      supabase.from("purchase_invoices").select("*").eq("voucher_id", voucherId).maybeSingle(),
      supabase.from("general_ledger").select("*").eq("voucher_id", voucherId),
      supabase.from("voucher_items").select("*, products(name, unit)").eq("voucher_id", voucherId),
    ]);
    const loadedItems = [
      ...(invoiceRes.data ? [{ type: "invoice", ...invoiceRes.data }] : []),
      ...(ledgerRes.data || []).map((l: any) => ({ type: "ledger", ...l })),
      ...(voucherItemsRes.data || []).map((v: any) => ({ type: "item", ...v })),
    ];
    setPurchaseItems(prev => ({ ...prev, [voucherId]: loadedItems }));
    return loadedItems;
  };

  const getStatusBadge = (status: string) => {
    const s = INVOICE_STATUSES.find(st => st.value === status);
    return s ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.color}`}>{s.label}</span> : <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  const openEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice);
    setEditForm({
      status: invoice.status || "unpaid",
      amount_paid: Number(invoice.amount_paid) || 0,
      due_date: invoice.due_date ? new Date(invoice.due_date).toISOString().split("T")[0] : "",
      notes: invoice.narration || "",
    });
  };

  const saveInvoiceEdit = async () => {
    if (!editingInvoice) return;
    setEditSaving(true);
    try {
      const amountDue = Math.max(0, Number(editingInvoice.total_amount) - editForm.amount_paid);
      await supabase.from("purchase_invoices").update({
        status: editForm.status,
        amount_paid: editForm.amount_paid,
        amount_due: amountDue,
        due_date: editForm.due_date || null,
      }).eq("id", editingInvoice.id);

      // Refresh the expanded purchase items
      if (editingInvoice.voucher_id) {
        setPurchaseItems(prev => { const n = { ...prev }; delete n[editingInvoice.voucher_id]; return n; });
        await loadPurchaseItems(editingInvoice.voucher_id);
      }
      toast.success("Invoice updated successfully");
      setEditingInvoice(null);
      fetchOverdueInvoices();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setEditSaving(false);
    }
  };

  const printPurchaseReceipt = (purchase: PurchaseRecord, itemsOverride?: any[]) => {
    const settingsRaw = localStorage.getItem("marvid_receipt_settings");
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {
      businessName: "Marvid Pharmaceutical UG", address: "Kampala, Uganda",
      phone: "+256 700 000000", paperWidth: "80mm", fontSize: "13px",
    };
    const invoiceNum = purchase.narration?.match(/Invoice:\s*([^\s.]+)/)?.[1] || purchase.voucher_number;
    const items = itemsOverride || purchaseItems[purchase.id] || [];
    const invoice = items.find((i: any) => i.type === "invoice");
    const purchasedItems = items.filter((i: any) => i.type === "item");
    const totalAmt = Number(purchase.total_amount);
    const amountInWords = numberToWords(totalAmt);

    const itemsTableHtml = purchasedItems.length > 0 ? `
      <div style="margin:12px 0;">
        <p style="font-weight:800;font-size:12px;margin-bottom:6px;">Items Purchased</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="border-bottom:1px solid #ccc;">
            <th style="text-align:left;padding:4px 2px;">#</th>
            <th style="text-align:left;padding:4px 2px;">Product</th>
            <th style="text-align:right;padding:4px 2px;">Qty</th>
            <th style="text-align:right;padding:4px 2px;">Rate</th>
            <th style="text-align:right;padding:4px 2px;">Amount</th>
          </tr></thead>
          <tbody>${purchasedItems.map((item: any, idx: number) => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:3px 2px;">${idx + 1}</td>
              <td style="padding:3px 2px;">${item.products?.name || item.description || "—"}</td>
              <td style="text-align:right;padding:3px 2px;">${item.quantity}</td>
              <td style="text-align:right;padding:3px 2px;">UGX ${Number(item.rate).toLocaleString()}</td>
              <td style="text-align:right;padding:3px 2px;font-weight:600;">UGX ${Number(item.amount).toLocaleString()}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : "";

    const receiptHtml = `<html><head><title>Purchase Receipt</title>
      <style>
        @page { size: ${settings.paperWidth} auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: ${settings.fontSize}; padding: 14px; color: #0a0a0a; line-height: 1.6; }
        .header { padding-bottom: 12px; border-bottom: 1px dashed #ccc; margin-bottom: 12px; }
        .header h1 { font-size: 18px; font-weight: 900; }
        .header .contact { font-size: 11px; color: #666; margin-top: 4px; }
        .title { text-align: center; font-size: 14px; font-weight: 800; margin: 12px 0; text-transform: uppercase; letter-spacing: 1px; }
        .meta { background: #f0f2f5; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 11px; }
        .meta-row { display: flex; justify-content: space-between; padding: 2px 0; }
        .meta-label { color: #666; font-weight: 600; }
        .meta-value { font-weight: 800; }
        .total { background: #1F617A; color: white; border-radius: 6px; padding: 10px 12px; margin: 12px 0; }
        .total-row { display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 13px; font-weight: 800; }
        .total-value { font-size: 18px; font-weight: 900; }
        .amount-words { font-size: 10px; font-style: italic; opacity: 0.9; margin-top: 4px; }
        .footer { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ccc; font-size: 10px; color: #999; }
        @media print { .no-print { display: none !important; } }
      </style></head><body>
        <div class="header">
          ${settings.showLogo && settings.logoUrl ? `<img src="${settings.logoUrl}" style="width:40px;height:40px;border-radius:50%;float:left;margin-right:10px;" />` : ''}
          <h1>${settings.businessName}</h1>
          <div class="contact">${settings.address} · ${settings.phone}</div>
        </div>
        <div class="title">📦 Stock Purchase Receipt</div>
        <div class="meta">
          <div class="meta-row"><span class="meta-label">Voucher #</span><span class="meta-value">${purchase.voucher_number}</span></div>
          <div class="meta-row"><span class="meta-label">Supplier</span><span class="meta-value">${purchase.party_name || "N/A"}</span></div>
          <div class="meta-row"><span class="meta-label">Invoice #</span><span class="meta-value">${invoiceNum}</span></div>
          <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${format(new Date(purchase.voucher_date), "dd MMM yyyy")}</span></div>
          ${invoice ? `<div class="meta-row"><span class="meta-label">Payment</span><span class="meta-value">${(invoice as any).status?.toUpperCase()}</span></div>` : ""}
        </div>
        ${itemsTableHtml}
        <div class="total">
          <div class="total-row"><span class="total-label">TOTAL AMOUNT</span><span class="total-value">UGX ${totalAmt.toLocaleString()}</span></div>
          <div class="amount-words">${amountInWords}</div>
        </div>
        <div class="footer">
          <p>Printed on ${new Date().toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          <p style="margin-top:4px;">Powered by TennaHub Technologies Limited</p>
        </div>
        <div class="no-print" style="text-align:center;margin-top:16px;">
          <button onclick="window.print()" style="background:#1F617A;color:white;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Print</button>
        </div>
      </body></html>`;
    const win = window.open("", "_blank", "width=420,height=600");
    if (win) { win.document.write(receiptHtml); win.document.close(); setTimeout(() => win.print(), 500); }
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
          updated.purchase_price = prod.buying_price || 0;
        }
      }
      return updated;
    }));
  };

  const addLine = () => {
    setLines(prev => [...prev, { ...EMPTY_LINE }]);
    setActiveLineIdx(lines.length);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
    setActiveLineIdx(Math.max(0, idx - 1));
  };

  const resetForm = () => {
    setSupplierId("");
    setInvoiceNumber("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setLines([{ ...EMPTY_LINE }]);
    setNotes("");
    setActiveLineIdx(0);
  };

  const totalAmount = lines.reduce((s, l) => s + l.quantity * l.purchase_price, 0);
  const totalProfit = lines.reduce((s, l) => s + (l.selling_price - l.purchase_price) * l.quantity, 0);
  const supplierName = suppliers.find(s => s.id === supplierId)?.name || "";

  const handleSave = async () => {
    if (!supplierId) { toast.error("Select a supplier (Alt+S to retry)"); return; }
    if (!invoiceNumber.trim()) { toast.error("Enter invoice/receipt number"); return; }
    if (lines.some(l => !l.product_id || !l.expiry_date || !l.batch_number)) {
      toast.error("Each item needs product, batch #, and expiry date"); return;
    }
    setSaving(true);
    try {
      const voucherNumber = `PV-${Date.now().toString(36).toUpperCase()}`;
      const { data: voucher, error: vErr } = await supabase.from("vouchers").insert({
        voucher_number: voucherNumber, voucher_type: "purchase",
        party_name: supplierName,
        narration: `Stock purchase - Invoice: ${invoiceNumber}. ${notes}`.trim(),
        total_amount: totalAmount, created_by: user?.id,
      } as any).select().single();
      if (vErr) throw vErr;

      await supabase.from("general_ledger").insert([
        { voucher_id: (voucher as any).id, account_name: "Inventory / Stock", account_type: "asset", debit: totalAmount, credit: 0, narration: `Purchase from ${supplierName} - ${invoiceNumber}` },
        { voucher_id: (voucher as any).id, account_name: "Accounts Payable", account_type: "liability", debit: 0, credit: totalAmount, narration: `Payable to ${supplierName} - ${invoiceNumber}` },
      ] as any);

      await supabase.from("purchase_invoices").insert({
        voucher_id: (voucher as any).id, supplier_name: supplierName,
        invoice_number: invoiceNumber, invoice_date: invoiceDate,
        total_amount: totalAmount, amount_paid: 0, amount_due: totalAmount, status: "unpaid",
      } as any);

      const { data: po } = await supabase.from("purchase_orders").insert({
        supplier_id: supplierId,
        total_amount: totalAmount,
        notes: `Invoice: ${invoiceNumber}. ${notes}`.trim(),
        status: "received",
      } as any).select().single();

      if (po) {
        const poItems = lines.map(line => ({
          purchase_order_id: (po as any).id,
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.purchase_price,
        }));
        await supabase.from("purchase_order_items").insert(poItems as any);
      }

      const voucherItems = lines.map(line => ({
        voucher_id: (voucher as any).id,
        product_id: line.product_id,
        quantity: line.quantity,
        rate: line.purchase_price,
        amount: line.quantity * line.purchase_price,
        description: line.batch_number,
      }));
      await supabase.from("voucher_items").insert(voucherItems as any);

      for (const line of lines) {
        await supabase.from("product_batches").insert({
          product_id: line.product_id, batch_number: line.batch_number,
          mfg_date: line.mfg_date || null, expiry_date: line.expiry_date,
          purchase_price: line.purchase_price, mrp: line.selling_price, quantity: line.quantity,
        } as any);
        const { data: prod } = await supabase.from("products").select("stock, buying_price").eq("id", line.product_id).single();
        if (prod) {
          await supabase.from("products").update({
            stock: prod.stock + line.quantity,
            buying_price: line.purchase_price,
          }).eq("id", line.product_id);
        }
      }

      toast.success(`Purchase saved — ${voucherNumber}`);
      resetForm();
      if (showHistory) fetchHistory();
      fetchOverdueInvoices();
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

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 purchase-form">
      {/* Overdue Notification Banner */}
      {overdueInvoices.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-sm text-destructive">
                {overdueInvoices.length} Overdue Invoice{overdueInvoices.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Total: UGX {overdueInvoices.reduce((s, inv) => s + Number(inv.amount_due), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowOverduePanel(!showOverduePanel)} className="gap-1.5 text-destructive border-destructive/30 w-full sm:w-auto">
            {showOverduePanel ? "Hide" : "View"} Details
            {showOverduePanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {/* Overdue Details Panel */}
      {showOverduePanel && overdueInvoices.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-destructive/5">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Overdue Invoices
            </h3>
          </div>
          <div className="divide-y divide-border">
            {overdueInvoices.map((inv: any) => {
              const daysOverdue = inv.due_date
                ? differenceInDays(new Date(), new Date(inv.due_date))
                : differenceInDays(new Date(), new Date(inv.invoice_date)) - 30;
              return (
                <div key={inv.id} className="px-3 md:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{inv.supplier_name}</span>
                      {getStatusBadge(inv.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      #{inv.invoice_number || "N/A"} · {format(new Date(inv.invoice_date), "dd MMM yyyy")}
                      <span className="text-destructive font-bold ml-2">({daysOverdue}d overdue)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-destructive text-xs sm:text-sm">UGX {Number(inv.amount_due).toLocaleString()}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditInvoice(inv)} title="Edit invoice">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header with tabs and shortcuts hint */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button variant={!showHistory ? "default" : "outline"} onClick={() => setShowHistory(false)} className="gap-2">
            <ShoppingCart className="h-4 w-4" /> New Purchase
          </Button>
          <Button variant={showHistory ? "default" : "outline"} onClick={() => setShowHistory(true)} className="gap-2">
            <History className="h-4 w-4" /> History
            <kbd className="hidden sm:inline ml-1 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border">Alt+H</kbd>
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowShortcuts(!showShortcuts)} className="gap-1 text-xs text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5" /> Shortcuts
        </Button>
      </div>

      {/* Shortcuts panel */}
      {showShortcuts && (
        <div className="bg-card rounded-xl border border-border p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
          {[
            ["Alt+N", "Add new item"],
            ["Alt+S", "Save purchase"],
            ["Alt+H", "Toggle history"],
            ["Alt+I", "Import CSV"],
            ["Alt+R", "Reset form"],
            ["Enter", "Next field"],
            ["Tab", "Next input"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono font-bold text-foreground">{key}</kbd>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      )}

      {!showHistory ? (
        <>
          {/* Purchase Details Card */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="font-semibold flex items-center gap-2 text-base">
                <ShoppingCart className="h-5 w-5 text-primary" /> Purchase Details
              </h3>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Import CSV
                <kbd className="hidden sm:inline ml-1 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border">Alt+I</kbd>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier *</label>
                <SearchableSelect options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder="Search supplier..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice / Receipt # *</label>
                <Input ref={invoiceRef} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2026-0042" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice Date</label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none" rows={2}
                placeholder="Optional notes about this purchase..." />
            </div>
          </div>

          {/* Supplier Info Card */}
          {supplierId && (() => {
            const sup = suppliers.find(s => s.id === supplierId);
            if (!sup) return null;
            return (
              <div className="bg-card rounded-xl border border-border p-3 md:p-4 flex items-center gap-4 md:gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{sup.name}</p>
                    {sup.contact_person && <p className="text-xs text-muted-foreground">{sup.contact_person}</p>}
                  </div>
                </div>
                {sup.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {sup.phone}
                  </div>
                )}
                {sup.address && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {sup.address}
                  </div>
                )}
                {sup.payment_terms && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> Terms: {sup.payment_terms}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Line Items - Invoice Table Layout */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Items ({lines.length})
              </h3>
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Item
                <kbd className="hidden sm:inline ml-1 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border">Alt+N</kbd>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-2 py-2.5 text-center w-10">No</th>
                    <th className="px-2 py-2.5 text-left min-w-[200px]">Item Description</th>
                    <th className="px-2 py-2.5 text-center w-16">Qty</th>
                    <th className="px-2 py-2.5 text-left w-28">Batch No</th>
                    <th className="px-2 py-2.5 text-center w-32">Expiry Date</th>
                    <th className="px-2 py-2.5 text-right w-28">Unit Price</th>
                    <th className="px-2 py-2.5 text-right w-28">Amount</th>
                    <th className="px-2 py-2.5 text-right w-28">Sell Price</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const lineTotal = line.quantity * line.purchase_price;
                    const isActive = activeLineIdx === idx;
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-border transition-colors cursor-pointer ${isActive ? "bg-primary/5" : "hover:bg-muted/20"}`}
                        onClick={() => setActiveLineIdx(idx)}
                      >
                        <td className="px-2 py-2 text-center text-xs font-bold text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <SearchableSelect
                            options={productOptions}
                            value={line.product_id}
                            onChange={v => updateLine(idx, "product_id", v)}
                            placeholder="Search product..."
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={1} value={line.quantity} onChange={e => updateLine(idx, "quantity", Number(e.target.value))} className="h-8 text-center w-16" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={line.batch_number} onChange={e => updateLine(idx, "batch_number", e.target.value)} className="h-8 text-xs" placeholder="Batch #" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="date" value={line.expiry_date} onChange={e => updateLine(idx, "expiry_date", e.target.value)} className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} value={line.purchase_price} onChange={e => updateLine(idx, "purchase_price", Number(e.target.value))} className="h-8 text-right text-xs" />
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-xs">
                          {lineTotal.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} value={line.selling_price} onChange={e => updateLine(idx, "selling_price", Number(e.target.value))} className="h-8 text-right text-xs" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); removeLine(idx); }}
                            disabled={lines.length <= 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-bold">
                    <td colSpan={2} className="px-2 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                    <td className="px-2 py-3 text-center text-sm">{lines.reduce((s, l) => s + l.quantity, 0)}</td>
                    <td colSpan={3} className="px-2 py-3"></td>
                    <td className="px-2 py-3 text-right text-sm text-primary">UGX {totalAmount.toLocaleString()}</td>
                    <td colSpan={2} className="px-2 py-3"></td>
                  </tr>
                  {totalAmount > 0 && (
                    <tr className="bg-muted/20">
                      <td colSpan={9} className="px-4 py-2 text-xs italic text-muted-foreground">
                        Amount in words: <span className="font-semibold text-foreground">{numberToWords(totalAmount)}</span>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Totals Summary Card */}
          <div className="bg-card rounded-xl border-2 border-primary/30 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium">Items</p>
                <p className="text-2xl font-black">{lines.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium">Total Qty</p>
                <p className="text-2xl font-black">{lines.reduce((s, l) => s + l.quantity, 0)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium">Grand Total</p>
                <p className="text-2xl font-black text-primary">UGX {totalAmount.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium">Expected Profit</p>
                <p className={`text-2xl font-black ${totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                  UGX {totalProfit.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm} className="gap-1.5">
              Clear
              <kbd className="hidden sm:inline ml-1 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border">Alt+R</kbd>
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 px-8">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Purchase"}
              <kbd className="hidden sm:inline ml-1 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border">Alt+S</kbd>
            </Button>
          </div>

          <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} target="product_batches" onSuccess={fetchData} />
        </>
      ) : (
        /* Purchase History */
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by supplier, voucher #, or notes..." value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)} className="pl-9" />
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16">
              <History className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No purchase records found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((purchase) => {
                const isExpanded = expandedPurchase === purchase.id;
                const items = purchaseItems[purchase.id];
                return (
                  <div key={purchase.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <button className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => { setExpandedPurchase(isExpanded ? null : purchase.id); if (!isExpanded) loadPurchaseItems(purchase.id); }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-sm">#{purchase.voucher_number}</span>
                          <Badge variant={purchase.status === "approved" ? "default" : "secondary"} className="text-[10px]">{purchase.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{purchase.party_name || "Unknown"}</span>
                          <span>•</span>
                          <span>{format(new Date(purchase.voucher_date), "dd MMM yyyy")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">UGX {Number(purchase.total_amount).toLocaleString()}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                          e.stopPropagation();
                          const items = await loadPurchaseItems(purchase.id);
                          printPurchaseReceipt(purchase, items);
                        }} title="Reprint receipt"><Printer className="h-3.5 w-3.5" /></Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3">
                        {!items ? (
                          <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                        ) : (
                          <div className="space-y-3">
                            {items.filter((i: any) => i.type === "invoice").map((inv: any) => {
                              const isOverdue = inv.status !== "paid" && inv.status !== "rejected" && inv.status !== "taken_back" && (
                                (inv.due_date && differenceInDays(new Date(), new Date(inv.due_date)) > 0) ||
                                (!inv.due_date && differenceInDays(new Date(), new Date(inv.invoice_date)) > 30)
                              );
                              return (
                                <div key={inv.id} className={`rounded-lg p-3 text-xs space-y-1 ${isOverdue ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
                                  <div className="flex items-center justify-between">
                                    <p className="font-semibold text-sm flex items-center gap-2">
                                      Invoice Details
                                      {isOverdue && <span className="text-destructive text-[10px] font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> OVERDUE</span>}
                                    </p>
                                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEditInvoice(inv)}>
                                      <Edit2 className="h-3 w-3" /> Edit
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div><span className="text-muted-foreground">Invoice #:</span> <span className="font-medium">{inv.invoice_number || "N/A"}</span></div>
                                    <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{format(new Date(inv.invoice_date), "dd MMM yyyy")}</span></div>
                                    <div><span className="text-muted-foreground">Due Date:</span> <span className="font-medium">{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "Not set"}</span></div>
                                    <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">UGX {Number(inv.total_amount).toLocaleString()}</span></div>
                                    <div><span className="text-muted-foreground">Paid:</span> <span className="font-medium">UGX {Number(inv.amount_paid).toLocaleString()}</span></div>
                                    <div><span className="text-muted-foreground">Due:</span> <span className="font-bold text-destructive">UGX {Number(inv.amount_due).toLocaleString()}</span></div>
                                    <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(inv.status)}</div>
                                  </div>
                                </div>
                              );
                            })}
                            {items.filter((i: any) => i.type === "item").length > 0 && (
                              <div>
                                <p className="text-xs font-semibold mb-2">Items Purchased</p>
                                <table className="w-full text-xs">
                                  <thead><tr className="text-muted-foreground border-b border-border">
                                    <th className="text-left py-1.5 font-medium">#</th>
                                    <th className="text-left py-1.5 font-medium">Product</th>
                                    <th className="text-right py-1.5 font-medium">Qty</th>
                                    <th className="text-right py-1.5 font-medium">Rate</th>
                                    <th className="text-right py-1.5 font-medium">Amount</th>
                                  </tr></thead>
                                  <tbody>
                                    {items.filter((i: any) => i.type === "item").map((item: any, idx: number) => (
                                      <tr key={item.id} className="border-b border-border">
                                        <td className="py-1.5 text-muted-foreground">{idx + 1}</td>
                                        <td className="py-1.5 font-medium">{item.products?.name || item.description || "Unknown"}</td>
                                        <td className="text-right py-1.5">{item.quantity} {item.products?.unit || ""}</td>
                                        <td className="text-right py-1.5">UGX {Number(item.rate).toLocaleString()}</td>
                                        <td className="text-right py-1.5 font-semibold">UGX {Number(item.amount).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="font-bold">
                                      <td colSpan={4} className="text-right py-1.5">Total</td>
                                      <td className="text-right py-1.5">UGX {items.filter((i: any) => i.type === "item").reduce((s: number, i: any) => s + Number(i.amount), 0).toLocaleString()}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                            {items.filter((i: any) => i.type === "ledger").length > 0 && (
                              <div>
                                <p className="text-xs font-semibold mb-2">Ledger Entries</p>
                                <table className="w-full text-xs">
                                  <thead><tr className="text-muted-foreground border-b border-border">
                                    <th className="text-left py-1 font-medium">Account</th>
                                    <th className="text-right py-1 font-medium">Debit</th>
                                    <th className="text-right py-1 font-medium">Credit</th>
                                  </tr></thead>
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

      {/* Edit Invoice Dialog */}
      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" /> Edit Invoice
            </DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Supplier:</span> <span className="font-bold">{editingInvoice.supplier_name}</span></div>
                <div><span className="text-muted-foreground">Invoice #:</span> <span className="font-bold">{editingInvoice.invoice_number || "N/A"}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">UGX {Number(editingInvoice.total_amount).toLocaleString()}</span></div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select value={editForm.status} onValueChange={v => setEditForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Amount Paid (UGX)</label>
                <Input type="number" min={0} value={editForm.amount_paid}
                  onChange={e => setEditForm(prev => ({ ...prev, amount_paid: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining: UGX {Math.max(0, Number(editingInvoice.total_amount) - editForm.amount_paid).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Due Date</label>
                <Input type="date" value={editForm.due_date}
                  onChange={e => setEditForm(prev => ({ ...prev, due_date: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInvoice(null)}>Cancel</Button>
            <Button onClick={saveInvoiceEdit} disabled={editSaving} className="gap-2">
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockPurchasePage;

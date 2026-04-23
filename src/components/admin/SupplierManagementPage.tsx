import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Plus, X, Truck, Star, Edit2, Trash2, FileText, Package, Upload } from "lucide-react";
import CsvImportDialog from "./CsvImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  created_at: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  unit: string;
  price: number;
}

const SupplierManagementPage = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", payment_terms: "" });
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poItems, setPoItems] = useState<{ product: LowStockProduct; orderQty: number }[]>([]);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setSuppliers((data as Supplier[]) || []);
    setLoading(false);
  };

  const fetchLowStock = async () => {
    const { data } = await supabase.from("medicines").select("id, name, stock, unit, price").lte("stock", 10).gt("stock", -1).eq("is_active", true).order("stock");
    setLowStockItems((data as LowStockProduct[]) || []);
  };

  useEffect(() => { fetchSuppliers(); fetchLowStock(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Supplier name is required"); return; }
    if (editingId) {
      const { error } = await supabase.from("suppliers").update({
        name: form.name, contact_person: form.contact_person || null, phone: form.phone || null, email: form.email || null,
        address: form.address || null, payment_terms: form.payment_terms || null,
      }).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Supplier updated");
    } else {
      const { error } = await supabase.from("suppliers").insert({
        name: form.name, contact_person: form.contact_person || null, phone: form.phone || null, email: form.email || null,
        address: form.address || null, payment_terms: form.payment_terms || null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Supplier added");
    }
    setFormOpen(false);
    setEditingId(null);
    setForm({ name: "", contact_person: "", phone: "", email: "", address: "", payment_terms: "" });
    fetchSuppliers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    toast.success("Supplier deleted");
    fetchSuppliers();
  };

  const openEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({ name: s.name, contact_person: s.contact_person || "", phone: s.phone || "", email: s.email || "", address: s.address || "", payment_terms: s.payment_terms || "" });
    setFormOpen(true);
  };

  const openPOGenerator = () => {
    setPoItems(lowStockItems.map(p => ({ product: p, orderQty: Math.max(50 - p.stock, 10) })));
    setPoModalOpen(true);
  };

  const primarySupplier = suppliers[0];

  const generatePurchaseOrderPDF = () => {
    const supplier = primarySupplier;
    if (!supplier) { toast.error("Please set a primary supplier first"); return; }
    const items = poItems.filter(i => i.orderQty > 0);
    if (items.length === 0) { toast.error("No items to order"); return; }

    setGeneratingPO(true);
    const totalAmount = items.reduce((s, i) => s + i.product.price * i.orderQty, 0);
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
    const today = new Date().toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" });

    const html = `
      <html><head><title>Purchase Order - ${poNumber}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; color: #1a1a1a; line-height: 1.5; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1F617A; padding-bottom: 16px; margin-bottom: 20px; }
        .company { font-size: 22px; font-weight: 900; color: #1F617A; }
        .company-sub { font-size: 11px; color: #666; margin-top: 4px; }
        .po-badge { background: #1F617A; color: white; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 14px; }
        .section { margin-bottom: 16px; }
        .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #1F617A; margin-bottom: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .info-value { font-size: 13px; font-weight: 700; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1F617A; color: white; padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
        td { padding: 10px 12px; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .total-row { background: #1F617A !important; color: white; }
        .total-row td { font-weight: 900; font-size: 14px; border: none; }
        .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sig-line { border-top: 2px solid #1a1a1a; margin-top: 60px; padding-top: 8px; font-size: 11px; font-weight: 700; }
        .note { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; font-weight: 600; margin-top: 20px; }
        @media print { .no-print { display: none !important; } body { padding: 0; } }
      </style></head><body>
        <div class="header">
          <div>
            <div class="company">MARVID PHARMACEUTICAL UG</div>
            <div class="company-sub">Kampala, Uganda · +256 700 000000 · info@marvid.com</div>
          </div>
          <div class="po-badge">PURCHASE ORDER<br/>${poNumber}</div>
        </div>
        <div class="info-grid section">
          <div class="info-box">
            <div class="info-label">Supplier</div>
            <div class="info-value">${supplier.name}</div>
            <div style="font-size:11px;color:#666;margin-top:4px;">${supplier.phone || ""} ${supplier.email ? "· " + supplier.email : ""}</div>
            ${supplier.address ? `<div style="font-size:11px;color:#666;">${supplier.address}</div>` : ""}
          </div>
          <div class="info-box">
            <div class="info-label">Order Date</div>
            <div class="info-value">${today}</div>
            <div style="font-size:11px;color:#666;margin-top:4px;">Status: Draft</div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Order Items (${items.length} low-stock products)</div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Current Stock</th><th class="text-right">Order Qty</th><th class="text-right">Unit Price</th><th class="text-right">Amount</th></tr></thead>
            <tbody>
              ${items.map((i, idx) => `<tr>
                <td>${idx + 1}</td>
                <td style="font-weight:700;">${i.product.name}</td>
                <td><span style="color:#dc2626;font-weight:800;">${i.product.stock} ${i.product.unit}</span></td>
                <td class="text-right">${i.orderQty} ${i.product.unit}</td>
                <td class="text-right">UGX ${i.product.price.toLocaleString()}</td>
                <td class="text-right" style="font-weight:800;">UGX ${(i.product.price * i.orderQty).toLocaleString()}</td>
              </tr>`).join("")}
              <tr class="total-row"><td colspan="5">ESTIMATED TOTAL</td><td class="text-right">UGX ${totalAmount.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="note">⚠️ This is an auto-generated purchase order draft based on low-stock items (≤10 units). Quantities are estimated — please review and adjust before sending to the supplier.</div>
        <div class="footer">
          <div><div class="sig-line">Authorized By (Marvid Pharmaceutical)</div></div>
          <div><div class="sig-line">Received By (${supplier.name})</div></div>
        </div>
        <div style="text-align:center;margin-top:20px;font-size:9px;color:#aaa;">Generated by Marvid Pharmaceutical System · ${today}</div>
        <div class="no-print" style="text-align:center;margin-top:20px;">
          <button onclick="window.print()" style="background:#1F617A;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Print / Save as PDF</button>
        </div>
      </body></html>
    `;

    const win = window.open("", "_blank", "width=800,height=1000");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    setGeneratingPO(false);
    setPoModalOpen(false);
    toast.success("Purchase order generated!");
  };

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Suppliers</p>
          <p className="text-xl font-bold mt-1">{suppliers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Primary Supplier</p>
          <p className="text-xl font-bold mt-1 text-primary">{primarySupplier?.name || "Not set"}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Low Stock Items</p>
          <p className="text-xl font-bold mt-1 text-destructive">{lowStockItems.length}</p>
          {lowStockItems.length > 0 && (
            <Button size="sm" className="mt-2 gap-1" onClick={openPOGenerator}>
              <FileText className="h-3 w-3" /> Generate Purchase Order
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => { setEditingId(null); setForm({ name: "", contact_person: "", phone: "", email: "", address: "", payment_terms: "" }); setFormOpen(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        </div>
      </div>

      {/* Supplier list */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No suppliers found. Add your first supplier above.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center bg-accent`}>
                  <Truck className={`h-5 w-5 text-muted-foreground`} />
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {s.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[s.phone, s.email, s.address].filter(Boolean).join(" · ") || "No contact info"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-md">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? "Edit Supplier" : "Add Supplier"}</h2>
              <button onClick={() => setFormOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. CiplaQCIL" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone</label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+256 7XX XXX XXX" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="supplier@example.com" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Contact Person</label>
                <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Contact person" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Terms</label>
                <Input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. Net 30" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSave}>{editingId ? "Update" : "Add Supplier"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Generator Modal */}
      {poModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="h-5 w-5" /> Generate Purchase Order</h2>
                <p className="text-sm text-muted-foreground">
                  Supplier: <span className="font-semibold text-foreground">{primarySupplier?.name || "⚠️ No primary supplier set"}</span>
                </p>
              </div>
              <button onClick={() => setPoModalOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-muted/50 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border">
                  <span className="col-span-5">Product</span>
                  <span className="col-span-2 text-center">Stock</span>
                  <span className="col-span-2 text-center">Order Qty</span>
                  <span className="col-span-3 text-right">Est. Cost</span>
                </div>
                {poItems.map((item, idx) => (
                  <div key={item.product.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-border last:border-0">
                    <span className="col-span-5 text-sm font-medium truncate">{item.product.name}</span>
                    <span className="col-span-2 text-center">
                      <Badge variant="destructive" className="text-[10px]">{item.product.stock}</Badge>
                    </span>
                    <span className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        value={item.orderQty}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setPoItems(prev => prev.map((p, i) => i === idx ? { ...p, orderQty: val } : p));
                        }}
                        className="h-8 text-xs text-center"
                      />
                    </span>
                    <span className="col-span-3 text-right text-sm font-semibold">
                      UGX {(item.product.price * item.orderQty).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center bg-primary/10 rounded-lg p-3">
                <span className="font-bold">Estimated Total</span>
                <span className="text-lg font-bold text-primary">
                  UGX {poItems.reduce((s, i) => s + i.product.price * i.orderQty, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPoModalOpen(false)}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={generatePurchaseOrderPDF} disabled={generatingPO || !primarySupplier}>
                  <FileText className="h-4 w-4" /> {generatingPO ? "Generating..." : "Generate PDF"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} target="suppliers" onSuccess={fetchSuppliers} />
    </div>
  );
};

export default SupplierManagementPage;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Search, Edit2, Trash2, Package, AlertTriangle, Calendar, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string | null;
  expiry_date: string;
  mfg_date: string | null;
  purchase_price: number;
  mrp: number;
  quantity: number;
  product_name?: string;
}

interface Product {
  id: string;
  name: string;
}

const BatchManagementPage = () => {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_id: "",
    batch_number: "",
    expiry_date: "",
    mfg_date: "",
    purchase_price: 0,
    mrp: 0,
    quantity: 0,
  });

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
    setProducts(p || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ product_id: "", batch_number: "", expiry_date: "", mfg_date: "", purchase_price: 0, mrp: 0, quantity: 0 });
    setDialogOpen(true);
  };

  const openEdit = (b: ProductBatch) => {
    setEditingId(b.id);
    setForm({
      product_id: b.product_id,
      batch_number: b.batch_number || "",
      expiry_date: b.expiry_date,
      mfg_date: b.mfg_date || "",
      purchase_price: b.purchase_price,
      mrp: b.mrp,
      quantity: b.quantity,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.product_id || !form.expiry_date) {
      toast.error("Product and expiry date are required");
      return;
    }
    setSaving(true);
    const payload = {
      product_id: form.product_id,
      batch_number: form.batch_number || null,
      expiry_date: form.expiry_date,
      mfg_date: form.mfg_date || null,
      purchase_price: Number(form.purchase_price),
      mrp: Number(form.mrp),
      quantity: Number(form.quantity),
    };

    if (editingId) {
      const { error } = await supabase.from("medicine_batches").update(payload as any).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("medicine_batches").insert(payload as any);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }

    toast.success(editingId ? "Batch updated" : "Batch added");
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this batch?")) return;
    const { error } = await supabase.from("medicine_batches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Batch deleted");
    fetchData();
  };

  const daysUntilExpiry = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const expiryBadge = (date: string) => {
    const days = daysUntilExpiry(date);
    if (days < 0) return <Badge variant="destructive" className="text-xs font-bold">EXPIRED</Badge>;
    if (days <= 30) return <Badge variant="destructive" className="text-xs">{days}d left</Badge>;
    if (days <= 90) return <Badge className="text-xs bg-amber-500 text-white">{days}d left</Badge>;
    return <Badge variant="secondary" className="text-xs">{days}d</Badge>;
  };

  const filtered = batches.filter(b =>
    (b.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.batch_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const expired = batches.filter(b => daysUntilExpiry(b.expiry_date) < 0);
  const nearExpiry = batches.filter(b => { const d = daysUntilExpiry(b.expiry_date); return d >= 0 && d <= 90; });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-muted-foreground font-semibold">Total Batches</p>
          <p className="text-xl md:text-2xl font-bold">{batches.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-muted-foreground font-semibold">Total Units</p>
          <p className="text-xl md:text-2xl font-bold">{batches.reduce((s, b) => s + b.quantity, 0).toLocaleString()}</p>
        </div>
        <div className="bg-destructive/10 rounded-xl border border-destructive/30 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-destructive font-semibold">Expired</p>
          <p className="text-xl md:text-2xl font-bold text-destructive">{expired.length}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950 rounded-xl border border-amber-300 dark:border-amber-700 p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-amber-700 dark:text-amber-300 font-semibold">Near Expiry</p>
          <p className="text-xl md:text-2xl font-bold text-amber-700 dark:text-amber-300">{nearExpiry.length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by product or batch..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Add Batch
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No batches found</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Batch #</th>
                  <th className="px-4 py-3 font-semibold">Mfg Date</th>
                  <th className="px-4 py-3 font-semibold">Expiry</th>
                  <th className="px-4 py-3 font-semibold text-right">Purchase Price</th>
                  <th className="px-4 py-3 font-semibold text-right">MRP</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(b => {
                  const days = daysUntilExpiry(b.expiry_date);
                  const rowClass = days < 0 ? "bg-destructive/5" : days <= 90 ? "bg-amber-50/50 dark:bg-amber-950/30" : "";
                  return (
                    <tr key={b.id} className={`hover:bg-muted/30 ${rowClass}`}>
                      <td className="px-4 py-3 font-medium">{b.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{b.batch_number || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{b.mfg_date || "—"}</td>
                      <td className="px-4 py-3 text-xs">{new Date(b.expiry_date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="px-4 py-3 text-right">UGX {b.purchase_price.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold">UGX {b.mrp.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold">{b.quantity}</td>
                      <td className="px-4 py-3">{expiryBadge(b.expiry_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card grid */}
          <div className="md:hidden grid grid-cols-1 gap-2.5">
            {filtered.map(b => {
              const days = daysUntilExpiry(b.expiry_date);
              const borderClass = days < 0 ? "border-destructive/40" : days <= 90 ? "border-amber-400/40" : "border-border";
              const bgClass = days < 0 ? "bg-destructive/5" : days <= 90 ? "bg-amber-50/50 dark:bg-amber-950/30" : "bg-card";
              return (
                <div key={b.id} className={`rounded-xl border p-3 ${borderClass} ${bgClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{b.product_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{b.batch_number || "No batch #"}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {expiryBadge(b.expiry_date)}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(b)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(b.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Expiry</span>
                      <p className="font-medium">{new Date(b.expiry_date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Qty</span>
                      <p className="font-bold">{b.quantity}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">MRP</span>
                      <p className="font-bold">UGX {b.mrp.toLocaleString()}</p>
                    </div>
                  </div>
                  {b.purchase_price > 0 && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      Cost: UGX {b.purchase_price.toLocaleString()} {b.mfg_date ? `· Mfg: ${b.mfg_date}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Batch" : "Add New Batch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Product *</label>
              <select value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Batch Number</label>
                <Input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} placeholder="e.g. BT-2026-001" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantity *</label>
                <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Mfg Date</label>
                <Input type="date" value={form.mfg_date} onChange={e => setForm({ ...form, mfg_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Expiry Date *</label>
                <Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Purchase Price</label>
                <Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">MRP (Selling Price)</label>
                <Input type="number" value={form.mrp} onChange={e => setForm({ ...form, mrp: Number(e.target.value) })} />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : editingId ? "Update Batch" : "Add Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchManagementPage;

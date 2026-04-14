import { useState, useEffect, useRef } from "react";
import CsvImportDialog from "./CsvImportDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Search, Edit2, Trash2, AlertTriangle, Clock,
  Package, Save, ImagePlus, X, Share2, ExternalLink, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  unit: string;
  stock: number;
  batch_number: string | null;
  expiry_date: string | null;
  requires_prescription: boolean;
  is_active: boolean;
  image_url: string | null;
  product_code: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

const EMPTY_FORM = {
  name: "", description: "", category_id: "", price: 0, wholesale_price: 0, buying_price: 0, unit: "Pack",
  stock: 0, batch_number: "", expiry_date: "", requires_prescription: false,
  is_active: true, product_code: "", prescription_info: "",
  pieces_per_unit: 1, unit_description: "",
};

const InventoryPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      category_id: p.category_id || "",
      price: p.price,
      wholesale_price: (p as any).wholesale_price || 0,
      buying_price: (p as any).buying_price || 0,
      unit: p.unit,
      pieces_per_unit: (p as any).pieces_per_unit || 1,
      unit_description: (p as any).unit_description || "",
      stock: p.stock,
      batch_number: p.batch_number || "",
      expiry_date: p.expiry_date || "",
      requires_prescription: p.requires_prescription,
      is_active: p.is_active,
      product_code: p.product_code || "",
      prescription_info: (p as any).prescription_info || "",
    });
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(p.image_url);
    setDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return existingImageUrl;
    const ext = imageFile.name.split(".").pop() || "jpg";
    const path = `${productId}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, imageFile, { upsert: true });
    if (error) {
      toast.error("Image upload failed: " + error.message);
      return existingImageUrl;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error("Name and price are required");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      category_id: form.category_id || null,
      price: Number(form.price),
      wholesale_price: Number(form.wholesale_price) || 0,
      buying_price: Number(form.buying_price) || 0,
      unit: form.unit,
      pieces_per_unit: Number(form.pieces_per_unit) || 1,
      unit_description: form.unit_description || null,
      stock: Number(form.stock),
      batch_number: form.batch_number || null,
      expiry_date: form.expiry_date || null,
      requires_prescription: form.requires_prescription,
      is_active: form.is_active,
      product_code: form.product_code || null,
    };

    let productId = editingId;

    if (editingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      productId = data.id;
    }

    // Upload image if selected
    if (imageFile && productId) {
      const imageUrl = await uploadImage(productId);
      if (imageUrl) {
        await supabase.from("products").update({ image_url: imageUrl }).eq("id", productId);
      }
    }

    toast.success(editingId ? "Product updated" : "Product added");
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Product deleted");
    fetchData();
  };

  const shareToWhatsApp = (p: Product) => {
    const productUrl = `${window.location.origin}/product/${p.id}`;
    const text = encodeURIComponent(
      `🏥 *${p.name}*\n\n` +
      `💊 Unit: ${p.unit}\n` +
      `💰 Price: UGX ${Number(p.price).toLocaleString()}\n` +
      `${p.description ? `📋 ${p.description}\n` : ""}` +
      `${p.stock > 0 ? `✅ In Stock` : `❌ Out of Stock`}\n\n` +
      `${p.image_url ? `📸 ${p.image_url}\n\n` : ""}` +
      `🔗 View & Order: ${productUrl}\n\n` +
      `Order now! 📲`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const daysUntilExpiry = (date: string | null) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const expiryBadge = (date: string | null) => {
    const days = daysUntilExpiry(date);
    if (days === null) return null;
    if (days < 0) return <Badge variant="destructive" className="text-xs">Expired</Badge>;
    if (days <= 30) return <Badge variant="destructive" className="text-xs">{days}d left</Badge>;
    if (days <= 90) return <Badge className="text-xs bg-warning text-warning-foreground">{days}d left</Badge>;
    return <Badge variant="secondary" className="text-xs">{days}d left</Badge>;
  };

  const stockLevel = (stock: number) => {
    if (stock === 0) return { color: "bg-destructive", label: "Out of stock", pct: 0 };
    if (stock <= 10) return { color: "bg-destructive", label: "Critical", pct: 10 };
    if (stock <= 25) return { color: "bg-warning", label: "Low", pct: 30 };
    return { color: "bg-success", label: "In stock", pct: Math.min(100, stock) };
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.batch_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || p.category_id === filterCategory;
    return matchSearch && matchCat;
  });

  const getCategoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name || "—";

  const currentPreview = imagePreview || existingImageUrl;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Products", value: products.length, icon: Package },
          { label: "Low Stock (<10)", value: products.filter(p => p.stock > 0 && p.stock <= 10).length, icon: AlertTriangle },
          { label: "Out of Stock", value: products.filter(p => p.stock === 0).length, icon: AlertTriangle },
          { label: "Expiring (<30d)", value: products.filter(p => { const d = daysUntilExpiry(p.expiry_date); return d !== null && d >= 0 && d <= 30; }).length, icon: Clock },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, batch, or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={openAdd} className="gap-2 rounded-lg">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">No products found</p>
        ) : filtered.map((p) => {
          const sl = stockLevel(p.stock);
          return (
            <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden group hover:shadow-md transition-shadow">
              <div className="aspect-[4/3] bg-muted flex items-center justify-center relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-10 w-10 text-muted-foreground" />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                    {p.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {p.requires_prescription && <Badge variant="secondary" className="text-[10px]">Rx</Badge>}
                </div>
                {expiryBadge(p.expiry_date) && (
                  <div className="absolute top-2 left-2">{expiryBadge(p.expiry_date)}</div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{getCategoryName(p.category_id)}</p>
                  {p.product_code && <p className="text-[10px] text-muted-foreground font-mono">{p.product_code}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-primary">UGX {Number(p.price).toLocaleString()}</p>
                    {(p as any).buying_price > 0 && (
                      <p className="text-[10px] text-muted-foreground">Cost: UGX {Number((p as any).buying_price).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${sl.color}`} />
                    <span className="text-xs text-muted-foreground">{p.stock} {p.unit}</span>
                  </div>
                </div>
                {(p as any).unit_description && (
                  <p className="text-[10px] text-muted-foreground italic">{(p as any).unit_description}</p>
                )}
                {p.batch_number && (
                  <p className="text-[10px] text-muted-foreground font-mono">Batch: {p.batch_number}</p>
                )}
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`/product/${p.id}`, "_blank")} title="Preview">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => shareToWhatsApp(p)} title="Share on WhatsApp">
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Edit">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id, p.name)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Image Upload */}
            <div>
              <label className="text-sm font-medium mb-2 block">Product Photo</label>
              <div className="flex items-start gap-4">
                {currentPreview ? (
                  <div className="relative">
                    <img
                      src={currentPreview}
                      alt="Preview"
                      className="h-24 w-24 rounded-xl object-cover border-2 border-border"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setExistingImageUrl(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-24 w-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-1 hover:bg-muted transition-colors"
                  >
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Add Photo</span>
                  </button>
                )}
                {currentPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2"
                  >
                    Change Photo
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Product Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amoxicillin 250mg" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                rows={2}
                placeholder="Brief description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Unit</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {["Pack", "Tablet", "Bottle", "Box", "Strip", "Tube", "Sachet", "Vial"].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Pieces per Unit</label>
                <Input type="number" min={1} value={form.pieces_per_unit} onChange={(e) => setForm({ ...form, pieces_per_unit: Number(e.target.value) })} placeholder="e.g. 50" />
                <p className="text-[10px] text-muted-foreground mt-0.5">How many sellable pieces in 1 {form.unit}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Unit Description</label>
                <Input value={form.unit_description} onChange={(e) => setForm({ ...form, unit_description: e.target.value })} placeholder="e.g. 1 Pack = 1 Strip = 50 Tablets" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Breakdown shown at POS</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Buying Price (UGX)</label>
                <Input type="number" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: Number(e.target.value) })} placeholder="Cost price" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Retail Price (UGX) *</label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Wholesale Price</label>
                <Input type="number" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: Number(e.target.value) })} placeholder="0 = same as retail" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Stock Quantity</label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
              </div>
            </div>
            {form.buying_price > 0 && form.price > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 flex gap-4">
                <span>💰 Margin: <strong>UGX {(form.price - form.buying_price).toLocaleString()}</strong></span>
                <span>📊 Markup: <strong>{((form.price - form.buying_price) / form.buying_price * 100).toFixed(1)}%</strong></span>
                {form.pieces_per_unit > 1 && (
                  <span>💊 Unit Price: <strong>UGX {Math.round(form.price / form.pieces_per_unit).toLocaleString()}/pc</strong></span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Product Code</label>
                <Input value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} placeholder="e.g. AMX001" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Batch Number</label>
                <Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} placeholder="e.g. AMX-2024-089" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Expiry Date</label>
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prescription Info</label>
              <textarea
                value={form.prescription_info}
                onChange={(e) => setForm({ ...form, prescription_info: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                rows={3}
                placeholder="Dosage instructions, usage directions, warnings, etc."
              />
              <p className="text-[10px] text-muted-foreground mt-1">This info will appear on prescriptions during POS sales</p>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requires_prescription} onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })} className="accent-primary" />
                Requires Prescription
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} target="products" onSuccess={fetchData} />
    </div>
  );
};

export default InventoryPage;

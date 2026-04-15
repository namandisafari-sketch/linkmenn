import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Eye, Share2, Package, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import logo from "@/assets/marvid-logo.png";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  wholesale_price: number;
  stock: number;
  unit: string;
  image_url: string | null;
  category_id: string | null;
  is_active: boolean;
  requires_prescription: boolean;
}

interface Category {
  id: string;
  name: string;
}

const ProductPreviewPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from("products").select("id, name, description, price, wholesale_price, stock, unit, image_url, category_id, is_active, requires_prescription").eq("is_active", true).order("name"),
        supabase.from("categories").select("*").order("name"),
      ]);
      setProducts((prods as Product[]) || []);
      setCategories(cats || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const getCategoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name || "General";

  const shareToWhatsApp = (p: Product) => {
    const productUrl = `${window.location.origin}/product/${p.id}`;
    const msg = [
      `*${p.name}*`,
      ``,
      `Unit: ${p.unit}`,
      `Price: UGX ${Number(p.price).toLocaleString()}`,
      p.wholesale_price > 0 ? `Wholesale: UGX ${Number(p.wholesale_price).toLocaleString()}` : "",
      p.description || "",
      p.stock > 0 ? `In Stock (${p.stock} ${p.unit})` : `Out of Stock`,
      ``,
      p.image_url || "",
      `View & Order: ${productUrl}`,
      ``,
      `Order now from Marvid Pharmaceutical UG!`,
    ].filter(Boolean).join("\n");
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const shareToStatus = async (p: Product) => {
    const productUrl = `${window.location.origin}/product/${p.id}`;
    const msg = [
      `*AVAILABLE NOW!*`,
      ``,
      p.name,
      `UGX ${Number(p.price).toLocaleString()}`,
      p.wholesale_price > 0 ? `Wholesale: UGX ${Number(p.wholesale_price).toLocaleString()}` : "",
      `In Stock`,
      ``,
      p.image_url || "",
      productUrl,
      ``,
      `Order now!`,
      `Marvid Pharmaceutical UG`,
    ].filter(Boolean).join("\n");

    // Try native share (works on mobile for status)
    if (navigator.share) {
      try {
        await navigator.share({ text: msg });
        return;
      } catch {}
    }
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(msg);
    toast.success("Copied to clipboard! Paste it in your WhatsApp Status.");
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products to preview..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{products.length} products</Badge>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden group hover:shadow-md transition-shadow">
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-12 w-12 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setPreviewProduct(p)}>
                    <Eye className="h-4 w-4 mr-1" /> Preview
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{getCategoryName(p.category_id)}</p>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <p className="text-sm font-bold text-primary">UGX {p.price.toLocaleString()}</p>
                    {p.wholesale_price > 0 && (
                      <p className="text-[10px] text-muted-foreground">W/S: UGX {p.wholesale_price.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex gap-1 items-center">
                    {p.requires_prescription && (
                      <Badge variant="destructive" className="text-[9px] gap-0.5 px-1">
                        Rx
                      </Badge>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => shareToWhatsApp(p)} title="Share on WhatsApp">
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`/product/${p.id}`, "_blank")} title="View page">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Preview Modal */}
      {previewProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-lg overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center relative">
              {previewProduct.image_url ? (
                <img src={previewProduct.image_url} alt={previewProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No image uploaded</p>
                </div>
              )}
              <div className="absolute top-3 left-3">
                <img src={logo} alt="Marvid" className="h-8" />
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <h2 className="text-xl font-bold">{previewProduct.name}</h2>
                <p className="text-sm text-muted-foreground">{getCategoryName(previewProduct.category_id)} · {previewProduct.unit}</p>
              </div>
              {previewProduct.description && (
                <p className="text-sm text-muted-foreground">{previewProduct.description}</p>
              )}
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-primary">UGX {previewProduct.price.toLocaleString()}</p>
                  {previewProduct.wholesale_price > 0 && (
                    <p className="text-sm text-muted-foreground">Wholesale: UGX {previewProduct.wholesale_price.toLocaleString()}</p>
                  )}
                </div>
                <Badge variant={previewProduct.stock > 0 ? "default" : "destructive"}>
                  {previewProduct.stock > 0 ? `${previewProduct.stock} in stock` : "Out of stock"}
                </Badge>
              </div>
              {/* Prescription Required Toggle */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`h-4 w-4 ${previewProduct.requires_prescription ? "text-destructive" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium">Requires Prescription</p>
                    <p className="text-[10px] text-muted-foreground">Requires Doctor's License Number at POS</p>
                  </div>
                </div>
                <Switch
                  checked={previewProduct.requires_prescription}
                  onCheckedChange={async (checked) => {
                    await supabase.from("products").update({ requires_prescription: checked } as any).eq("id", previewProduct.id);
                    setPreviewProduct({ ...previewProduct, requires_prescription: checked });
                    setProducts(prev => prev.map(p => p.id === previewProduct.id ? { ...p, requires_prescription: checked } : p));
                    toast.success(checked ? `${previewProduct.name} marked as prescription required` : `${previewProduct.name} unmarked`);
                  }}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => shareToWhatsApp(previewProduct)}>
                  <Share2 className="h-4 w-4" /> Share on WhatsApp
                </Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => shareToStatus(previewProduct)}>
                  📱 Share to Status
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setPreviewProduct(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPreviewPage;

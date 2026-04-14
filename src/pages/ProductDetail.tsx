import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: relatedProducts = [] } = useQuery({
    queryKey: ["related-products", product?.category_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .eq("category_id", product!.category_id!)
        .neq("id", product!.id)
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!product?.category_id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-96 bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
              <div className="h-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">Product not found.</p>
          <Link to="/" className="text-primary hover:underline mt-4 inline-block">Back to shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to products
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="rounded-2xl overflow-hidden border border-border bg-muted">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-[400px] object-cover" />
            ) : (
              <div className="w-full h-[400px] flex items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <span className="text-xs font-medium bg-accent text-accent-foreground px-2.5 py-1 rounded-full w-fit mb-3">
              {product.categories?.name || "General"}
            </span>
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            <p className="text-muted-foreground text-sm mb-4">{product.unit} · {product.batch_number ? `Batch: ${product.batch_number}` : ""} {product.expiry_date ? `· Exp: ${product.expiry_date}` : ""}</p>
            
            <p className="text-3xl font-bold text-primary mb-6">UGX {product.price.toLocaleString()}</p>

            {product.description && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{product.description}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              {product.stock > 0 ? (
                <span className="text-sm text-success font-medium">{product.stock} in stock</span>
              ) : (
                <span className="text-sm text-destructive font-medium">Out of stock</span>
              )}
              {product.requires_prescription && (
                <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">Prescription required</span>
              )}
            </div>

            <Button
              size="lg"
              className="rounded-full gap-2 w-fit mt-auto"
              disabled={product.stock <= 0}
              onClick={() => addItem({ id: product.id, name: product.name, price: product.price, unit: product.unit, requires_prescription: product.requires_prescription })}
            >
              <ShoppingCart className="h-4 w-4" /> Add to Cart
            </Button>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-bold mb-6">Related Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedProducts.map((p: any) => (
                <Link key={p.id} to={`/product/${p.id}`} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-sm mb-1">{p.name}</h3>
                    <p className="font-bold text-primary">UGX {p.price.toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ProductDetail;

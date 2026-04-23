import { ShoppingCart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

const FeaturedProducts = () => {
  const { addItem } = useCart();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicines")
        .select("*, categories:category_id(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return (
      <section className="py-12 md:py-16 bg-muted/50">
        <div className="container">
          <h2 className="text-2xl font-bold mb-2">Popular Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border h-72 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-16 bg-muted/50">
      <div className="container">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">Popular Products</h2>
            <p className="text-muted-foreground">Frequently ordered medicines and health essentials</p>
          </div>
          <Link to="/shop" className="text-sm font-medium text-primary hover:underline hidden sm:block">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col group">
              <Link to={`/product/${product.id}`} className="relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-36 bg-gradient-to-br from-accent to-muted flex items-center justify-center">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                {product.requires_prescription && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Rx</span>
                )}
                {product.stock <= 0 && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <span className="text-xs font-bold bg-destructive text-destructive-foreground px-3 py-1 rounded-full">Out of Stock</span>
                  </div>
                )}
              </Link>
              <div className="p-4 flex flex-col flex-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {product.categories?.name || "General"}
                </span>
                <Link to={`/product/${product.id}`}>
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2 hover:text-primary transition-colors leading-tight">{product.name}</h3>
                </Link>
                <p className="text-xs text-muted-foreground mb-3">{product.unit}</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">UGX {product.price.toLocaleString()}</span>
                  <Button
                    size="sm"
                    className="rounded-full h-8 w-8 p-0"
                    disabled={product.stock <= 0}
                    onClick={() =>
                      addItem({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        unit: product.unit,
                        requires_prescription: product.requires_prescription,
                      })
                    }
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;

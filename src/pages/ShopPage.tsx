import { useState } from "react";
import { ShoppingCart, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ShopPage = () => {
  const { addItem } = useCart();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["shop-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30">
        {/* Header */}
        <div className="bg-background border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-10">
            <h1 className="text-3xl font-bold text-foreground mb-2">Our Products</h1>
            <p className="text-muted-foreground">Browse our complete range of quality pharmaceutical products</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={selectedCategory === null ? "default" : "outline"}
                className="rounded-full text-xs"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  className="rounded-full text-xs"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Products grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-card rounded-2xl border border-border h-64 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Filter className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">No products found</p>
              <p className="text-sm text-muted-foreground/70">Try adjusting your search or filter</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">{filtered.length} product{filtered.length !== 1 ? "s" : ""}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map((product) => (
                  <div key={product.id} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col group">
                    <Link to={`/product/${product.id}`} className="relative">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
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
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ShopPage;

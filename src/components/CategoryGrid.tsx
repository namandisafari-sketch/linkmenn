import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Heart, Leaf, Baby, Syringe, ShieldPlus, Stethoscope, Droplets } from "lucide-react";

const iconMap: Record<string, any> = {
  Antibiotics: ShieldPlus,
  Painkillers: Pill,
  Supplements: Leaf,
  "Heart Health": Heart,
  "Baby Care": Baby,
  Vaccines: Syringe,
  "Pain & Inflammation": Pill,
  Antimalarials: Droplets,
};

const CategoryGrid = () => {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .limit(8);
      if (error) throw error;
      // Get product counts per category
      const { data: products } = await supabase
        .from("products")
        .select("category_id")
        .eq("is_active", true);
      const counts: Record<string, number> = {};
      products?.forEach((p) => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
      return data.map((c) => ({ ...c, count: counts[c.id] || 0 }));
    },
  });

  if (categories.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      <div className="container">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">Shop by Category</h2>
            <p className="text-muted-foreground">Browse our wide selection of pharmaceutical products</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.slice(0, 8).map((cat) => {
            const Icon = iconMap[cat.name] || Stethoscope;
            return (
              <button
                key={cat.id}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border hover:border-primary hover:shadow-lg transition-all duration-200"
              >
                <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                  <Icon className="h-7 w-7" />
                </div>
                <span className="text-sm font-semibold">{cat.name}</span>
                <span className="text-xs text-muted-foreground">{cat.count} items</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;

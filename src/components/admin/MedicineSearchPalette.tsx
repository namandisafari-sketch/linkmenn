import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, AlertTriangle, Package } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ugx } from "@/lib/format";

interface Med {
  id: string;
  name: string;
  generic_name: string | null;
  brand: string | null;
  barcode: string | null;
  price: number;
  stock: number | null;
  reorder_level: number | null;
  unit: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MedicineSearchPalette = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Med[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const q = query.trim();
      setLoading(true);
      const builder = supabase
        .from("medicines")
        .select("id,name,generic_name,brand,barcode,price,stock,reorder_level,unit")
        .eq("is_active", true)
        .limit(20);
      const res = q
        ? await builder.or(
            `name.ilike.%${q}%,generic_name.ilike.%${q}%,brand.ilike.%${q}%,barcode.ilike.%${q}%`,
          )
        : await builder.order("name");
      setResults(((res.data as Med[]) ?? []));
      setActive(0);
      setLoading(false);
    }, 180);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, open]);

  const select = (m: Med) => {
    onOpenChange(false);
    navigate(`/admin/inventory?focus=${m.id}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); select(results[active]); }
  };

  const items = useMemo(() => results, [results]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 top-[15%] translate-y-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search by name, generic, brand, barcode…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {loading && <span className="text-xs text-muted-foreground">searching…</span>}
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {query ? "No matches" : "Start typing to search medicines"}
            </div>
          ) : (
            items.map((m, i) => {
              const lowStock = (m.reorder_level ?? 0) > 0 && (m.stock ?? 0) <= (m.reorder_level ?? 0);
              return (
                <button
                  key={m.id}
                  onClick={() => select(m)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-border/50 ${
                    i === active ? "bg-accent" : ""
                  }`}
                >
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[m.generic_name, m.brand, m.barcode].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lowStock && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> LOW
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{m.stock ?? 0} {m.unit}</span>
                    <span className="text-sm font-semibold">{ugx(m.price)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>↑↓ navigate · Enter select · Esc close</span>
          <span>{items.length} result{items.length === 1 ? "" : "s"}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedicineSearchPalette;

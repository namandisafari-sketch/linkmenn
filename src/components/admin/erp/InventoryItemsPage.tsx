import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ugx } from "@/lib/format";

const schema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(120),
  unit: z.string().max(20).optional(),
  cost_price: z.coerce.number().min(0).default(0),
  sale_price: z.coerce.number().min(0).default(0),
  stock_qty: z.coerce.number().default(0),
});
type V = z.input<typeof schema>;
interface Item { id: string; code: string; name: string; unit: string | null; cost_price: number; sale_price: number; stock_qty: number; }

const InventoryItemsPage = () => {
  const [rows, setRows] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { code: "", name: "", unit: "pcs", cost_price: 0, sale_price: 0, stock_qty: 0 } });

  const load = async () => { const r = await supabase.from("inventory_items").select("*").order("code"); setRows((r.data || []) as Item[]); };
  useEffect(() => { load(); }, []);

  const onSubmit = async (v: V) => {
    const payload = {
      ...v,
      cost_price: Number(v.cost_price) || 0,
      sale_price: Number(v.sale_price) || 0,
      stock_qty: Number(v.stock_qty) || 0,
    };
    const { error } = editing
      ? await supabase.from("inventory_items").update(payload).eq("id", editing.id)
      : await supabase.from("inventory_items").insert([payload as any]);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); load();
  };

  const filtered = rows.filter(r => !search || r.code.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setEditing(null); form.reset({ code: "", name: "", unit: "pcs", cost_price: 0, sale_price: 0, stock_qty: 0 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Item
        </Button>
      </div>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Sale</TableHead><TableHead className="text-right">Stock</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => { setEditing(r); form.reset({ ...r, unit: r.unit || "pcs" }); setOpen(true); }}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.unit || "—"}</TableCell>
                <TableCell className="text-right font-mono">{ugx(r.cost_price)}</TableCell>
                <TableCell className="text-right font-mono">{ugx(r.sale_price)}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.stock_qty).toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {!filtered.length && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No items</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? "Edit" : "New"} Item</SheetTitle></SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 mt-6">
            <div><label className="text-sm font-medium">Code</label><Input {...form.register("code")} /></div>
            <div><label className="text-sm font-medium">Name</label><Input {...form.register("name")} /></div>
            <div><label className="text-sm font-medium">Unit</label><Input {...form.register("unit")} placeholder="pcs, kg, ltr…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Cost Price</label><Input type="number" step="0.01" {...form.register("cost_price")} /></div>
              <div><label className="text-sm font-medium">Sale Price</label><Input type="number" step="0.01" {...form.register("sale_price")} /></div>
            </div>
            <div><label className="text-sm font-medium">Stock Qty</label><Input type="number" step="0.001" {...form.register("stock_qty")} /></div>
            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default InventoryItemsPage;

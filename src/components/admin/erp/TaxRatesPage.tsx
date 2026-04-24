import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  rate: z.coerce.number().min(0).max(100),
  tax_type: z.enum(["VAT", "WHT", "PAYE", "NSSF", "OTHER"]),
  is_active: z.boolean().default(true),
});
type V = z.input<typeof schema>;
interface Tax { id: string; name: string; rate: number; tax_type: string; is_active: boolean; }

const TaxRatesPage = () => {
  const [rows, setRows] = useState<Tax[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: "", rate: 0, tax_type: "VAT", is_active: true } });

  const load = async () => { const r = await supabase.from("tax_rates").select("*").order("tax_type"); setRows((r.data || []) as Tax[]); };
  useEffect(() => { load(); }, []);

  const onSubmit = async (v: V) => {
    const payload = { ...v, rate: Number(v.rate) || 0 };
    const { error } = editing
      ? await supabase.from("tax_rates").update(payload).eq("id", editing.id)
      : await supabase.from("tax_rates").insert([payload as any]);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); form.reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Rate</Button>
      </div>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Rate</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => { setEditing(r); form.reset({ ...r, tax_type: r.tax_type as any }); setOpen(true); }}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.tax_type}</Badge></TableCell>
                <TableCell className="text-right font-mono">{Number(r.rate).toFixed(2)}%</TableCell>
                <TableCell>{r.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? "Edit" : "New"} Tax Rate</SheetTitle></SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 mt-6">
            <div><label className="text-sm font-medium">Name</label><Input {...form.register("name")} /></div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Controller control={form.control} name="tax_type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["VAT","WHT","PAYE","NSSF","OTHER"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div><label className="text-sm font-medium">Rate (%)</label><Input type="number" step="0.001" {...form.register("rate")} /></div>
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

export default TaxRatesPage;

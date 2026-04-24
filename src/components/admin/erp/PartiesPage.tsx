import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  party_type: z.enum(["customer", "supplier", "both"]),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(300).optional(),
  tax_id: z.string().max(50).optional(),
});
type Vals = z.infer<typeof schema>;

interface Party { id: string; name: string; party_type: string; phone: string | null; email: string | null; address: string | null; tax_id: string | null; }

interface Props { filter?: "customer" | "supplier" | "both"; }

const PartiesPage = ({ filter = "both" }: Props) => {
  const [rows, setRows] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);

  const form = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", party_type: filter === "both" ? "customer" : filter, phone: "", email: "", address: "", tax_id: "" },
  });

  const load = async () => {
    let q = supabase.from("parties").select("*").order("name");
    if (filter !== "both") q = q.in("party_type", [filter, "both"]);
    const r = await q;
    setRows((r.data || []) as Party[]);
  };
  useEffect(() => { load(); }, [filter]);

  const filtered = rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.phone || "").includes(search));

  const openNew = () => { setEditing(null); form.reset({ name: "", party_type: filter === "both" ? "customer" : filter, phone: "", email: "", address: "", tax_id: "" }); setOpen(true); };
  const openEdit = (p: Party) => { setEditing(p); form.reset({ ...p, party_type: p.party_type as any, email: p.email || "", phone: p.phone || "", address: p.address || "", tax_id: p.tax_id || "" }); setOpen(true); };

  const onSubmit = async (v: Vals) => {
    const payload = { ...v, email: v.email || null, phone: v.phone || null, address: v.address || null, tax_id: v.tax_id || null };
    const { error } = editing
      ? await supabase.from("parties").update(payload).eq("id", editing.id)
      : await supabase.from("parties").insert([payload as any]);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated" : "Created");
    setOpen(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New {filter === "supplier" ? "Supplier" : "Customer"}</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Tax ID</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.party_type}</Badge></TableCell>
                  <TableCell>{p.phone || "—"}</TableCell>
                  <TableCell>{p.email || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.tax_id || "—"}</TableCell>
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No records</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? "Edit" : "New"} Party</SheetTitle></SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 mt-6">
            <div><label className="text-sm font-medium">Name</label><Input {...form.register("name")} /></div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Controller control={form.control} name="party_type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div><label className="text-sm font-medium">Phone</label><Input {...form.register("phone")} /></div>
            <div><label className="text-sm font-medium">Email</label><Input type="email" {...form.register("email")} /></div>
            <div><label className="text-sm font-medium">Address</label><Input {...form.register("address")} /></div>
            <div><label className="text-sm font-medium">Tax ID / TIN</label><Input {...form.register("tax_id")} /></div>
            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Save" : "Create"}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PartiesPage;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(3),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
}).refine(d => new Date(d.end_date) > new Date(d.start_date), { message: "End must be after start", path: ["end_date"] });
type V = z.infer<typeof schema>;
interface FY { id: string; name: string; start_date: string; end_date: string; is_active: boolean; is_closed: boolean; }

const FiscalYearsPage = () => {
  const [rows, setRows] = useState<FY[]>([]);
  const [open, setOpen] = useState(false);
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: "", start_date: "", end_date: "" } });

  const load = async () => { const r = await supabase.from("fiscal_years").select("*").order("start_date", { ascending: false }); setRows((r.data || []) as FY[]); };
  useEffect(() => { load(); }, []);

  const onSubmit = async (v: V) => {
    const { error } = await supabase.from("fiscal_years").insert([v as any]);
    if (error) return toast.error(error.message);
    toast.success("Created"); setOpen(false); load();
  };

  const setActive = async (id: string) => {
    await supabase.from("fiscal_years").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("fiscal_years").update({ is_active: true }).eq("id", id);
    toast.success("Active fiscal year set"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { form.reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Fiscal Year</Button>
      </div>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.start_date}</TableCell>
                <TableCell>{r.end_date}</TableCell>
                <TableCell>{r.is_active ? <Badge>Active</Badge> : r.is_closed ? <Badge variant="secondary">Closed</Badge> : <Badge variant="outline">Open</Badge>}</TableCell>
                <TableCell className="text-right">{!r.is_active && <Button size="sm" variant="outline" onClick={() => setActive(r.id)}>Set Active</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>New Fiscal Year</SheetTitle></SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 mt-6">
            <div><label className="text-sm font-medium">Name</label><Input {...form.register("name")} placeholder="FY 2026-2027" /></div>
            <div><label className="text-sm font-medium">Start Date</label><Input type="date" {...form.register("start_date")} /></div>
            <div><label className="text-sm font-medium">End Date</label><Input type="date" {...form.register("end_date")} /></div>
            {form.formState.errors.end_date && <p className="text-xs text-destructive">{form.formState.errors.end_date.message}</p>}
            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default FiscalYearsPage;

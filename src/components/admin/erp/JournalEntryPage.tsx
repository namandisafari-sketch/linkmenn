import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ugx } from "@/lib/format";
import { VOUCHER_TYPES } from "@/lib/erp";

const lineSchema = z.object({
  account_id: z.string().uuid({ message: "Pick an account" }),
  narration: z.string().max(200).optional(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
});
const schema = z.object({
  voucher_date: z.string().min(1),
  voucher_type: z.string().min(1),
  party_name: z.string().max(120).optional(),
  narration: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(2, "At least 2 lines"),
});
type FormVals = z.input<typeof schema>;

interface AcctRow { id: string; code: string; name: string; }

const JournalEntryPage = () => {
  const [accounts, setAccounts] = useState<AcctRow[]>([]);
  const [posting, setPosting] = useState(false);

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      voucher_date: new Date().toISOString().slice(0, 10),
      voucher_type: "journal",
      party_name: "",
      narration: "",
      lines: [
        { account_id: "", narration: "", debit: 0, credit: 0 },
        { account_id: "", narration: "", debit: 0, credit: 0 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");

  useEffect(() => {
    supabase.from("accounts").select("id, code, name").order("code").then(r => setAccounts((r.data || []) as AcctRow[]));
  }, []);

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit: d, credit: c, balanced: Math.abs(d - c) < 0.005 && d > 0 };
  }, [lines]);

  const onPost = async (vals: FormVals) => {
    if (!totals.balanced) return toast.error("Debits must equal credits");
    setPosting(true);
    try {
      // Generate voucher number
      const { data: vno, error: ne } = await supabase.rpc("next_voucher_number", { p_voucher_type: vals.voucher_type });
      if (ne) throw ne;

      const { data: jrn, error: je } = await supabase.from("journals").insert([{
        voucher_type: vals.voucher_type,
        voucher_number: vno as string,
        voucher_date: vals.voucher_date,
        party_name: vals.party_name || null,
        narration: vals.narration || null,
        status: "draft",
        total_amount: totals.debit,
      }]).select("id").single();
      if (je) throw je;

      const linesPayload = vals.lines.map(l => {
        const acc = accounts.find(a => a.id === l.account_id);
        return {
          journal_id: jrn.id,
          account_id: l.account_id,
          account_name: acc?.name || "Unknown",
          account_type: "general",
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration || vals.narration || null,
          entry_date: vals.voucher_date,
        };
      });
      const { error: le } = await supabase.from("journal_lines").insert(linesPayload);
      if (le) throw le;

      // Mark posted (this will trigger balance check)
      const { error: pe } = await supabase.from("journals").update({ status: "posted" }).eq("id", jrn.id);
      if (pe) throw pe;

      toast.success(`Posted ${vno}`);
      form.reset({
        voucher_date: new Date().toISOString().slice(0, 10),
        voucher_type: "journal", party_name: "", narration: "",
        lines: [
          { account_id: "", narration: "", debit: 0, credit: 0 },
          { account_id: "", narration: "", debit: 0, credit: 0 },
        ],
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to post");
    } finally { setPosting(false); }
  };

  return (
    <form onSubmit={form.handleSubmit(onPost)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Voucher Header</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium">Date</label>
            <Input type="date" {...form.register("voucher_date")} />
          </div>
          <div>
            <label className="text-xs font-medium">Voucher Type</label>
            <Controller control={form.control} name="voucher_type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOUCHER_TYPES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium">Party (optional)</label>
            <Input {...form.register("party_name")} placeholder="Customer / Supplier" />
          </div>
          <div className="md:col-span-4">
            <label className="text-xs font-medium">Narration</label>
            <Textarea rows={2} {...form.register("narration")} placeholder="Description / reference" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => append({ account_id: "", narration: "", debit: 0, credit: 0 })}>
            <Plus className="h-4 w-4 mr-1" />Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <div className="col-span-4">Account</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2 text-right">Debit</div>
            <div className="col-span-2 text-right">Credit</div>
            <div className="col-span-1"></div>
          </div>
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 gap-2">
              <Controller control={form.control} name={`lines.${i}.account_id`} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="col-span-4"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <Input className="col-span-3" {...form.register(`lines.${i}.narration`)} placeholder="Description" />
              <Input className="col-span-2 text-right font-mono" type="number" step="0.01" {...form.register(`lines.${i}.debit`)} />
              <Input className="col-span-2 text-right font-mono" type="number" step="0.01" {...form.register(`lines.${i}.credit`)} />
              <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => fields.length > 2 && remove(i)} disabled={fields.length <= 2}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="grid grid-cols-12 gap-2 pt-3 border-t mt-2 text-sm font-semibold">
            <div className="col-span-7 text-right">Totals</div>
            <div className="col-span-2 text-right font-mono">{ugx(totals.debit)}</div>
            <div className="col-span-2 text-right font-mono">{ugx(totals.credit)}</div>
            <div className="col-span-1"></div>
          </div>
          {!totals.balanced && (totals.debit > 0 || totals.credit > 0) && (
            <p className="text-xs text-destructive text-right">Difference: {ugx(Math.abs(totals.debit - totals.credit))}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!totals.balanced || posting}>
          <Save className="h-4 w-4 mr-2" />
          {posting ? "Posting…" : totals.balanced ? "Post Voucher" : "Unbalanced"}
        </Button>
      </div>
    </form>
  );
};

export default JournalEntryPage;

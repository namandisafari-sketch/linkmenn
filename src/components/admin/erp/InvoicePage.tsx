import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ugx } from "@/lib/format";

const lineSchema = z.object({
  item_name: z.string().min(1, "Required"),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  tax_rate_id: z.string().optional(),
});
const schema = z.object({
  party_id: z.string().uuid("Select customer"),
  invoice_date: z.string().min(1),
  due_date: z.string().min(1),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});
type FormVals = z.input<typeof schema>;

interface Party { id: string; name: string; }
interface Tax { id: string; name: string; rate: number; }
interface Acct { id: string; code: string; name: string; }

const InvoicePage = () => {
  const [parties, setParties] = useState<Party[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [posting, setPosting] = useState(false);

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      party_id: "", invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      reference: "",
      lines: [{ item_name: "", qty: 1, unit_price: 0, tax_rate_id: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");

  useEffect(() => {
    Promise.all([
      supabase.from("parties").select("id, name").in("party_type", ["customer", "both"]).order("name"),
      supabase.from("tax_rates").select("id, name, rate").eq("tax_type", "VAT").eq("is_active", true),
      supabase.from("accounts").select("id, code, name").in("code", ["1004", "4001", "2002"]),
    ]).then(([p, t, a]) => {
      setParties((p.data || []) as Party[]);
      setTaxes((t.data || []) as Tax[]);
      setAccounts((a.data || []) as Acct[]);
    });
  }, []);

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    lines.forEach(l => {
      const amt = (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
      sub += amt;
      const rate = taxes.find(t => t.id === l.tax_rate_id)?.rate || 0;
      tax += amt * (Number(rate) / 100);
    });
    return { sub, tax, grand: sub + tax };
  }, [lines, taxes]);

  const onPost = async (vals: FormVals) => {
    const ar = accounts.find(a => a.code === "1004");
    const rev = accounts.find(a => a.code === "4001");
    const vat = accounts.find(a => a.code === "2002");
    if (!ar || !rev || !vat) return toast.error("Required accounts missing (1004, 4001, 2002)");

    setPosting(true);
    try {
      const party = parties.find(p => p.id === vals.party_id);
      const { data: vno, error: ne } = await supabase.rpc("next_voucher_number", { p_voucher_type: "sale" });
      if (ne) throw ne;

      const { data: jrn, error: je } = await supabase.from("journals").insert([{
        voucher_type: "sale",
        voucher_number: vno as string,
        voucher_date: vals.invoice_date,
        party_name: party?.name || null,
        narration: `Invoice ${vno} — ${party?.name || ""}`,
        reference: vals.reference || null,
        status: "draft",
        total_amount: totals.grand,
      }]).select("id").single();
      if (je) throw je;

      const linesPayload: any[] = [
        { journal_id: jrn.id, account_id: ar.id, account_name: ar.name, account_type: "asset", debit: totals.grand, credit: 0, entry_date: vals.invoice_date, narration: `Invoice ${vno}` },
        { journal_id: jrn.id, account_id: rev.id, account_name: rev.name, account_type: "income", debit: 0, credit: totals.sub, entry_date: vals.invoice_date, narration: `Invoice ${vno}` },
      ];
      if (totals.tax > 0) {
        linesPayload.push({ journal_id: jrn.id, account_id: vat.id, account_name: vat.name, account_type: "liability", debit: 0, credit: totals.tax, entry_date: vals.invoice_date, narration: `VAT ${vno}` });
      }
      const { error: le } = await supabase.from("journal_lines").insert(linesPayload);
      if (le) throw le;

      const { error: pe } = await supabase.from("journals").update({ status: "posted" }).eq("id", jrn.id);
      if (pe) throw pe;

      toast.success(`Invoice ${vno} posted`);
      form.reset();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setPosting(false); }
  };

  return (
    <form onSubmit={form.handleSubmit(onPost)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Invoice</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium">Customer</label>
            <Controller control={form.control} name="party_id" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {!parties.length && <p className="text-xs text-muted-foreground mt-1">Create a customer in Sales → Customers first</p>}
          </div>
          <div><label className="text-xs font-medium">Invoice Date</label><Input type="date" {...form.register("invoice_date")} /></div>
          <div><label className="text-xs font-medium">Due Date</label><Input type="date" {...form.register("due_date")} /></div>
          <div className="md:col-span-4"><label className="text-xs font-medium">Reference</label><Input {...form.register("reference")} placeholder="PO number, etc." /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => append({ item_name: "", qty: 1, unit_price: 0, tax_rate_id: "" })}>
            <Plus className="h-4 w-4 mr-1" />Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-4">Item</div><div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Price</div><div className="col-span-2">Tax</div>
            <div className="col-span-2 text-right">Amount</div><div className="col-span-1"></div>
          </div>
          {fields.map((f, i) => {
            const amt = (Number(lines[i]?.qty) || 0) * (Number(lines[i]?.unit_price) || 0);
            return (
              <div key={f.id} className="grid grid-cols-12 gap-2">
                <Input className="col-span-4" {...form.register(`lines.${i}.item_name`)} placeholder="Item / service" />
                <Input className="col-span-1 text-right font-mono" type="number" step="0.01" {...form.register(`lines.${i}.qty`)} />
                <Input className="col-span-2 text-right font-mono" type="number" step="0.01" {...form.register(`lines.${i}.unit_price`)} />
                <Controller control={form.control} name={`lines.${i}.tax_rate_id`} render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger className="col-span-2"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No tax</SelectItem>
                      {taxes.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                <div className="col-span-2 text-right font-mono py-2 text-sm">{ugx(amt)}</div>
                <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => fields.length > 1 && remove(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          <div className="border-t pt-3 mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{ugx(totals.sub)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className="font-mono">{ugx(totals.tax)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="font-mono">{ugx(totals.grand)}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={posting || totals.grand <= 0}>
          <Save className="h-4 w-4 mr-2" />{posting ? "Posting…" : "Post Invoice"}
        </Button>
      </div>
    </form>
  );
};

export default InvoicePage;

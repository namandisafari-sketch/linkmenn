import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, ChevronDown, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { acctTypeFromCode, ACCT_TYPE_LABEL, ACCT_TYPE_ORDER, AcctType, closingBalance } from "@/lib/erp";
import { ugx } from "@/lib/format";

const schema = z.object({
  code: z.string().trim().min(3, "Min 3 chars").max(10),
  name: z.string().trim().min(2).max(120),
  opening_balance: z.coerce.number().default(0),
});
type FormVals = z.infer<typeof schema>;

interface AcctRow { id: string; code: string; name: string; opening_balance: number; is_system: boolean; }
interface LedgerAgg { account_id: string; debit: number; credit: number; }

const ChartOfAccountsPage = () => {
  const [rows, setRows] = useState<AcctRow[]>([]);
  const [agg, setAgg] = useState<Record<string, LedgerAgg>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcctRow | null>(null);
  const [collapsed, setCollapsed] = useState<Set<AcctType>>(new Set());

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", name: "", opening_balance: 0 },
  });

  const load = async () => {
    setLoading(true);
    const [a, l] = await Promise.all([
      supabase.from("accounts").select("id, code, name, opening_balance, is_system").order("code"),
      supabase.from("ledger_entries").select("account_id, debit, credit"),
    ]);
    setRows((a.data || []) as AcctRow[]);
    const map: Record<string, LedgerAgg> = {};
    (l.data || []).forEach((e: any) => {
      const k = e.account_id;
      if (!map[k]) map[k] = { account_id: k, debit: 0, credit: 0 };
      map[k].debit += Number(e.debit) || 0;
      map[k].credit += Number(e.credit) || 0;
    });
    setAgg(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const filt = rows.filter(r =>
      !search || r.code.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase())
    );
    const g: Record<AcctType, AcctRow[]> = { asset: [], liability: [], equity: [], revenue: [], expense: [] };
    filt.forEach(r => g[acctTypeFromCode(r.code)].push(r));
    return g;
  }, [rows, search]);

  const totals = useMemo(() => {
    const t: Record<AcctType, number> = { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 };
    rows.forEach(r => {
      const type = acctTypeFromCode(r.code);
      const a = agg[r.id] || { debit: 0, credit: 0 };
      t[type] += closingBalance(type, Number(r.opening_balance) || 0, a.debit, a.credit);
    });
    return t;
  }, [rows, agg]);

  const openNew = () => { setEditing(null); form.reset({ code: "", name: "", opening_balance: 0 }); setOpen(true); };
  const openEdit = (r: AcctRow) => { setEditing(r); form.reset({ code: r.code, name: r.name, opening_balance: Number(r.opening_balance) || 0 }); setOpen(true); };

  const onSubmit = async (vals: FormVals) => {
    const payload = { ...vals };
    if (editing) {
      const { error } = await supabase.from("accounts").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Account updated");
    } else {
      const { error } = await supabase.from("accounts").insert([{ ...payload, pharmacy_id: "00000000-0000-0000-0000-000000000001" } as any]);
      if (error) return toast.error(error.message);
      toast.success("Account created");
    }
    setOpen(false);
    load();
  };

  const toggle = (t: AcctType) => {
    const n = new Set(collapsed);
    n.has(t) ? n.delete(t) : n.add(t);
    setCollapsed(n);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search code or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Account</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading chart of accounts…</div>
      ) : (
        <div className="space-y-3">
          {ACCT_TYPE_ORDER.map(type => {
            const list = grouped[type];
            if (!list.length) return null;
            const isCollapsed = collapsed.has(type);
            return (
              <Card key={type}>
                <CardHeader className="cursor-pointer py-3" onClick={() => toggle(type)}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {ACCT_TYPE_LABEL[type]}
                      <Badge variant="secondary" className="ml-2">{list.length}</Badge>
                    </span>
                    <span className="font-mono text-sm">{ugx(totals[type])}</span>
                  </CardTitle>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent className="pt-0">
                    <div className="divide-y">
                      {list.map(r => {
                        const a = agg[r.id] || { debit: 0, credit: 0 };
                        const bal = closingBalance(type, Number(r.opening_balance) || 0, a.debit, a.credit);
                        return (
                          <button key={r.id} onClick={() => openEdit(r)} className="w-full grid grid-cols-12 gap-2 py-2.5 text-sm hover:bg-muted/50 transition rounded px-2 text-left">
                            <span className="col-span-2 font-mono text-muted-foreground">{r.code}</span>
                            <span className="col-span-6 font-medium truncate">{r.name}{r.is_system && <Badge variant="outline" className="ml-2 text-[10px]">system</Badge>}</span>
                            <span className="col-span-4 text-right font-mono">{ugx(bal)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? "Edit Account" : "New Account"}</SheetTitle></SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <div>
              <label className="text-sm font-medium">Code</label>
              <Input {...form.register("code")} placeholder="e.g. 6020" disabled={!!editing?.is_system} />
              <p className="text-xs text-muted-foreground mt-1">First digit decides type: 1=Asset, 2=Liability, 3=Equity, 4=Revenue, 5–9=Expense</p>
              {form.formState.errors.code && <p className="text-xs text-destructive mt-1">{form.formState.errors.code.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...form.register("name")} placeholder="e.g. Marketing Expense" />
              {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Opening Balance (UGX)</label>
              <Input type="number" step="0.01" {...form.register("opening_balance")} />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Save" : "Create"}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ChartOfAccountsPage;

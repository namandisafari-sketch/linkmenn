import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { ugx } from "@/lib/format";
import { acctTypeFromCode, closingBalance } from "@/lib/erp";
import * as XLSX from "xlsx";

interface FY { id: string; name: string; start_date: string; end_date: string; is_active: boolean; }
interface AcctRow { id: string; code: string; name: string; opening_balance: number; }

const TrialBalancePage = () => {
  const [fys, setFys] = useState<FY[]>([]);
  const [fyId, setFyId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accounts, setAccounts] = useState<AcctRow[]>([]);
  const [agg, setAgg] = useState<Record<string, { debit: number; credit: number }>>({});

  useEffect(() => {
    supabase.from("fiscal_years").select("*").order("start_date", { ascending: false }).then(r => {
      const list = (r.data || []) as FY[];
      setFys(list);
      const active = list.find(f => f.is_active) || list[0];
      if (active) {
        setFyId(active.id);
        setFrom(active.start_date);
        setTo(active.end_date);
      }
    });
    supabase.from("accounts").select("id, code, name, opening_balance").order("code").then(r => setAccounts((r.data || []) as AcctRow[]));
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    supabase.from("ledger_entries").select("account_id, debit, credit, entry_date")
      .gte("entry_date", from).lte("entry_date", to)
      .then(r => {
        const m: Record<string, { debit: number; credit: number }> = {};
        (r.data || []).forEach((e: any) => {
          const k = e.account_id;
          if (!m[k]) m[k] = { debit: 0, credit: 0 };
          m[k].debit += Number(e.debit) || 0;
          m[k].credit += Number(e.credit) || 0;
        });
        setAgg(m);
      });
  }, [from, to]);

  const rows = useMemo(() => {
    return accounts.map(a => {
      const t = acctTypeFromCode(a.code);
      const x = agg[a.id] || { debit: 0, credit: 0 };
      const open = Number(a.opening_balance) || 0;
      const close = closingBalance(t, open, x.debit, x.credit);
      return { ...a, type: t, opening: open, debit: x.debit, credit: x.credit, closing: close };
    }).filter(r => r.opening !== 0 || r.debit !== 0 || r.credit !== 0 || r.closing !== 0);
  }, [accounts, agg]);

  const totals = useMemo(() => ({
    opening: rows.reduce((s, r) => s + r.opening, 0),
    debit: rows.reduce((s, r) => s + r.debit, 0),
    credit: rows.reduce((s, r) => s + r.credit, 0),
    closing: rows.reduce((s, r) => s + r.closing, 0),
  }), [rows]);

  const onExport = () => {
    const data = rows.map(r => ({
      Code: r.code, Account: r.name, Type: r.type,
      Opening: r.opening, Debit: r.debit, Credit: r.credit, Closing: r.closing,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
    XLSX.writeFile(wb, `trial-balance-${from}-to-${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium">Fiscal Year</label>
            <Select value={fyId} onValueChange={(v) => {
              setFyId(v);
              const fy = fys.find(f => f.id === v);
              if (fy) { setFrom(fy.start_date); setTo(fy.end_date); }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{fys.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">From</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">To</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />Export XLSX
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{ugx(r.opening)}</TableCell>
                  <TableCell className="text-right font-mono">{ugx(r.debit)}</TableCell>
                  <TableCell className="text-right font-mono">{ugx(r.credit)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{ugx(r.closing)}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No activity in this period</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Totals</TableCell>
                <TableCell className="text-right font-mono">{ugx(totals.opening)}</TableCell>
                <TableCell className="text-right font-mono">{ugx(totals.debit)}</TableCell>
                <TableCell className="text-right font-mono">{ugx(totals.credit)}</TableCell>
                <TableCell className="text-right font-mono">{ugx(totals.closing)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialBalancePage;

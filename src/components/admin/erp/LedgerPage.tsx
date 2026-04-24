import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ugx } from "@/lib/format";
import { acctTypeFromCode, closingBalance } from "@/lib/erp";

interface AcctRow { id: string; code: string; name: string; opening_balance: number; }
interface Entry { id: string; entry_date: string; debit: number; credit: number; narration: string | null; journal_id: string; }

const LedgerPage = () => {
  const [accounts, setAccounts] = useState<AcctRow[]>([]);
  const [acctId, setAcctId] = useState("");
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    supabase.from("accounts").select("id, code, name, opening_balance").order("code")
      .then(r => { const list = (r.data || []) as AcctRow[]; setAccounts(list); if (!acctId && list[0]) setAcctId(list[0].id); });
  }, []);

  useEffect(() => {
    if (!acctId) return;
    supabase.from("ledger_entries").select("id, entry_date, debit, credit, narration, journal_id")
      .eq("account_id", acctId).gte("entry_date", from).lte("entry_date", to).order("entry_date")
      .then(r => setEntries((r.data || []) as Entry[]));
  }, [acctId, from, to]);

  const acct = accounts.find(a => a.id === acctId);
  const type = acct ? acctTypeFromCode(acct.code) : "asset";

  const rows = useMemo(() => {
    let running = Number(acct?.opening_balance) || 0;
    return entries.map(e => {
      const d = Number(e.debit) || 0;
      const c = Number(e.credit) || 0;
      running = closingBalance(type, running, d, c);
      return { ...e, running };
    });
  }, [entries, acct, type]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium">Account</label>
            <Select value={acctId} onValueChange={setAcctId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="text-xs font-medium">From</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="text-xs font-medium">To</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={4} className="font-medium">Opening Balance</TableCell><TableCell className="text-right font-mono">{ugx(Number(acct?.opening_balance) || 0)}</TableCell></TableRow>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.entry_date}</TableCell>
                  <TableCell className="text-sm">{r.narration || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{r.debit ? ugx(r.debit) : ""}</TableCell>
                  <TableCell className="text-right font-mono">{r.credit ? ugx(r.credit) : ""}</TableCell>
                  <TableCell className="text-right font-mono">{ugx(r.running)}</TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No entries</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LedgerPage;

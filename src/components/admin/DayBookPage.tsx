import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Search, Filter, BookOpen, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface VoucherEntry {
  id: string;
  voucher_number: string;
  voucher_type: string;
  voucher_date: string;
  party_name: string | null;
  narration: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  ledger_entries: LedgerEntry[];
}

interface LedgerEntry {
  id: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  narration: string | null;
}

const VOUCHER_TYPE_COLORS: Record<string, string> = {
  sales: "bg-green-500/10 text-green-700 border-green-200",
  purchase: "bg-blue-500/10 text-blue-700 border-blue-200",
  receipt: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  payment: "bg-orange-500/10 text-orange-700 border-orange-200",
  journal: "bg-purple-500/10 text-purple-700 border-purple-200",
  contra: "bg-muted text-muted-foreground border-border",
};

const DayBookPage = () => {
  const [vouchers, setVouchers] = useState<VoucherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: vouchersData }, { data: ledgerData }] = await Promise.all([
      supabase.from("vouchers").select("*")
        .gte("voucher_date", dateFrom)
        .lte("voucher_date", dateTo)
        .order("voucher_date", { ascending: sortOrder === "asc" }),
      supabase.from("general_ledger").select("*")
        .gte("entry_date", dateFrom)
        .lte("entry_date", dateTo),
    ]);

    const ledgerMap = new Map<string, LedgerEntry[]>();
    (ledgerData || []).forEach((l: any) => {
      const entries = ledgerMap.get(l.voucher_id) || [];
      entries.push(l);
      ledgerMap.set(l.voucher_id, entries);
    });

    const enriched: VoucherEntry[] = (vouchersData || []).map((v: any) => ({
      ...v,
      ledger_entries: ledgerMap.get(v.id) || [],
    }));

    setVouchers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo, sortOrder]);

  const filtered = useMemo(() => {
    return vouchers.filter(v => {
      if (typeFilter && v.voucher_type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          v.voucher_number.toLowerCase().includes(s) ||
          (v.party_name || "").toLowerCase().includes(s) ||
          (v.narration || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [vouchers, search, typeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, VoucherEntry[]>();
    filtered.forEach(v => {
      const date = v.voucher_date;
      const list = map.get(date) || [];
      list.push(v);
      map.set(date, list);
    });
    return Array.from(map.entries()).sort((a, b) =>
      sortOrder === "desc" ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    );
  }, [filtered, sortOrder]);

  const totals = useMemo(() => {
    let totalDebit = 0, totalCredit = 0;
    filtered.forEach(v => {
      v.ledger_entries.forEach(e => {
        totalDebit += e.debit;
        totalCredit += e.credit;
      });
    });
    return { totalDebit, totalCredit, count: filtered.length };
  }, [filtered]);

  const voucherTypes = useMemo(() => {
    const types = new Set(vouchers.map(v => v.voucher_type));
    return Array.from(types).sort();
  }, [vouchers]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Vouchers</p>
          <p className="text-2xl font-black mt-1">{totals.count}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Debit</p>
          <p className="text-2xl font-black mt-1 text-green-600">UGX {totals.totalDebit.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Credit</p>
          <p className="text-2xl font-black mt-1 text-blue-600">UGX {totals.totalCredit.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground font-medium">Difference</p>
          <p className={`text-2xl font-black mt-1 ${Math.abs(totals.totalDebit - totals.totalCredit) < 1 ? "text-green-600" : "text-destructive"}`}>
            UGX {Math.abs(totals.totalDebit - totals.totalCredit).toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground">{Math.abs(totals.totalDebit - totals.totalCredit) < 1 ? "✓ Balanced" : "⚠ Imbalanced"}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-background text-sm w-36">
            <option value="">All Types</option>
            {voucherTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Voucher #, party, narration..." className="pl-9" />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")} className="gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortOrder === "desc" ? "Newest First" : "Oldest First"}
        </Button>
      </div>

      {/* Day Book Entries */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading day book...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No vouchers found for this period</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, entries]) => {
            const dayDebit = entries.reduce((s, v) => s + v.ledger_entries.reduce((t, e) => t + e.debit, 0), 0);
            const dayCredit = entries.reduce((s, v) => s + v.ledger_entries.reduce((t, e) => t + e.credit, 0), 0);
            return (
              <div key={date} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-bold text-sm">{new Date(date + "T00:00:00").toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                    <Badge variant="outline" className="text-[10px]">{entries.length} entries</Badge>
                  </div>
                  <div className="flex gap-4 text-xs font-semibold">
                    <span className="text-green-600">Dr: UGX {dayDebit.toLocaleString()}</span>
                    <span className="text-blue-600">Cr: UGX {dayCredit.toLocaleString()}</span>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {entries.map(v => (
                    <div key={v.id}>
                      <button
                        onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                        className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {expandedId === v.id ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <Badge className={`text-[10px] border ${VOUCHER_TYPE_COLORS[v.voucher_type] || VOUCHER_TYPE_COLORS.contra}`}>
                            {v.voucher_type.toUpperCase()}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">{v.voucher_number}</span>
                          <span className="font-semibold text-sm flex-1 truncate">{v.party_name || v.narration || "—"}</span>
                          <span className="font-bold text-sm">UGX {v.total_amount.toLocaleString()}</span>
                        </div>
                      </button>
                      {expandedId === v.id && v.ledger_entries.length > 0 && (
                        <div className="px-4 pb-3 ml-7">
                          <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-2 font-medium">Account</th>
                                  <th className="text-left px-3 py-2 font-medium">Type</th>
                                  <th className="text-right px-3 py-2 font-medium">Debit (Dr)</th>
                                  <th className="text-right px-3 py-2 font-medium">Credit (Cr)</th>
                                  <th className="text-left px-3 py-2 font-medium">Narration</th>
                                </tr>
                              </thead>
                              <tbody>
                                {v.ledger_entries.map(e => (
                                  <tr key={e.id} className="border-t border-border">
                                    <td className="px-3 py-1.5 font-semibold">{e.account_name}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground capitalize">{e.account_type}</td>
                                    <td className="px-3 py-1.5 text-right font-medium text-green-600">{e.debit > 0 ? `UGX ${e.debit.toLocaleString()}` : "—"}</td>
                                    <td className="px-3 py-1.5 text-right font-medium text-blue-600">{e.credit > 0 ? `UGX ${e.credit.toLocaleString()}` : "—"}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{e.narration || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {v.narration && <p className="text-xs text-muted-foreground mt-2 italic">📝 {v.narration}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DayBookPage;

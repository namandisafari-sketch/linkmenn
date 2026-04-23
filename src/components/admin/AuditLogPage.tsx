import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";

interface AuditRow {
  id: number;
  table_name: string;
  action: string;
  record_id: string | null;
  changed_by: string | null;
  old_data: any;
  new_data: any;
  changed_at: string;
}

const AuditLogPage = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [from, setFrom] = useState(format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("audit_log").select("*")
        .gte("changed_at", `${from}T00:00:00`).lte("changed_at", `${to}T23:59:59`)
        .order("changed_at", { ascending: false }).limit(500);
      if (tableFilter) q = q.eq("table_name", tableFilter);
      if (actionFilter) q = q.eq("action", actionFilter);
      const { data } = await q;
      setRows((data as AuditRow[]) ?? []);
      setLoading(false);
    })();
  }, [from, to, tableFilter, actionFilter]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    return JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
  });

  const renderDiff = (oldD: any, newD: any) => {
    const keys = new Set([...Object.keys(oldD || {}), ...Object.keys(newD || {})]);
    return (
      <div className="space-y-1 text-xs font-mono">
        {Array.from(keys).map((k) => {
          const o = oldD?.[k], n = newD?.[k];
          const same = JSON.stringify(o) === JSON.stringify(n);
          if (same) return null;
          return (
            <div key={k} className="grid grid-cols-[120px_1fr_1fr] gap-2 border-b border-border/50 py-1">
              <span className="text-primary">{k}</span>
              <span className="text-destructive line-through">{o == null ? "—" : JSON.stringify(o)}</span>
              <span className="text-primary">{n == null ? "—" : JSON.stringify(n)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div><label className="text-xs text-muted-foreground block mb-1">Search</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="any keyword" className="w-56" /></div>
        <div><label className="text-xs text-muted-foreground block mb-1">Table</label>
          <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="h-10 border border-input rounded-md px-3 text-sm bg-background">
            <option value="">All</option>
            <option value="journals">journals</option>
            <option value="journal_lines">journal_lines</option>
            <option value="medicines">medicines</option>
            <option value="medicine_batches">medicine_batches</option>
            <option value="goods_received_notes">goods_received_notes</option>
            <option value="purchase_orders">purchase_orders</option>
          </select>
        </div>
        <div><label className="text-xs text-muted-foreground block mb-1">Action</label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="h-10 border border-input rounded-md px-3 text-sm bg-background">
            <option value="">All</option><option>INSERT</option><option>UPDATE</option><option>DELETE</option>
          </select>
        </div>
        <div><label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div><label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">When</th>
              <th className="text-left p-3">Table</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Record</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No audit entries</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id}>
                <td className="p-3 whitespace-nowrap text-xs">{format(new Date(r.changed_at), "yyyy-MM-dd HH:mm:ss")}</td>
                <td className="p-3 font-mono text-xs">{r.table_name}</td>
                <td className="p-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  r.action === "INSERT" ? "bg-primary/10 text-primary" :
                  r.action === "UPDATE" ? "bg-amber-500/10 text-amber-600" :
                  "bg-destructive/10 text-destructive"
                }`}>{r.action}</span></td>
                <td className="p-3 font-mono text-[10px] text-muted-foreground">{r.record_id?.slice(0, 8)}</td>
                <td className="p-3 text-right"><Button variant="outline" size="sm" onClick={() => setDetail(r)}>View diff</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.action} on {detail?.table_name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">{format(new Date(detail.changed_at), "PPpp")}</p>
              <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs font-semibold border-b border-border pb-1 mb-2">
                <span>Field</span><span className="text-destructive">Old</span><span className="text-primary">New</span>
              </div>
              {renderDiff(detail.old_data, detail.new_data)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogPage;

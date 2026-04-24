import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ugx } from "@/lib/format";

interface V { id: string; voucher_number: string | null; voucher_type: string | null; voucher_date: string | null; party_name: string | null; total_amount: number | null; status: string | null; }

interface Props { limit?: number; }

const RecentVouchersPage = ({ limit = 50 }: Props) => {
  const [rows, setRows] = useState<V[]>([]);
  useEffect(() => {
    supabase.from("journals").select("id, voucher_number, voucher_type, voucher_date, party_name, total_amount, status")
      .order("created_at", { ascending: false }).limit(limit)
      .then(r => setRows((r.data || []) as V[]));
  }, [limit]);

  return (
    <Card><CardContent className="pt-6">
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Type</TableHead><TableHead>Party</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map(v => (
            <TableRow key={v.id}>
              <TableCell className="text-xs">{v.voucher_date || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{v.voucher_number || "—"}</TableCell>
              <TableCell><Badge variant="outline">{v.voucher_type || "—"}</Badge></TableCell>
              <TableCell>{v.party_name || "—"}</TableCell>
              <TableCell className="text-right font-mono">{ugx(v.total_amount || 0)}</TableCell>
              <TableCell><Badge variant={v.status === "posted" ? "default" : "secondary"}>{v.status || "draft"}</Badge></TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No vouchers</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
};

export default RecentVouchersPage;

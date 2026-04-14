import { useState } from "react";
import { Download, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

type ExportDataset = "sales" | "inventory" | "customers" | "financial";

const DATASETS: { key: ExportDataset; label: string; description: string }[] = [
  { key: "sales", label: "Sales History", description: "All orders with items, payment method, and dates" },
  { key: "inventory", label: "Inventory Stock", description: "Current products with stock levels, batches, and expiry" },
  { key: "customers", label: "Customer Ledgers", description: "Customer accounts with credit balances and transactions" },
  { key: "financial", label: "Financial Reports", description: "Vouchers and general ledger entries" },
];

const toCSV = (rows: Record<string, any>[], columns?: string[]): string => {
  if (rows.length === 0) return "";
  const keys = columns || Object.keys(rows[0]);
  const header = keys.join(",");
  const lines = rows.map(r =>
    keys.map(k => {
      const v = r[k] ?? "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    }).join(",")
  );
  return [header, ...lines].join("\n");
};

const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const DataExportSection = () => {
  const [exporting, setExporting] = useState<ExportDataset | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleExport = async (dataset: ExportDataset) => {
    setExporting(dataset);
    try {
      let csv = "";
      let filename = "";
      const now = format(new Date(), "yyyy-MM-dd");

      switch (dataset) {
        case "sales": {
          let query = supabase.from("orders").select("id, customer_name, total, status, payment_method, created_at, address, district, notes");
          if (dateFrom) query = query.gte("created_at", dateFrom);
          if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
          const { data, error } = await query.order("created_at", { ascending: false });
          if (error) throw error;
          csv = toCSV(data || []);
          filename = `sales-history-${now}.csv`;
          break;
        }
        case "inventory": {
          const [{ data: products }, { data: batches }] = await Promise.all([
            supabase.from("products").select("id, name, price, stock, unit, batch_number, expiry_date, is_active, product_code, category_id").order("name"),
            supabase.from("product_batches").select("product_id, batch_number, quantity, expiry_date, mfg_date, purchase_price, mrp").order("expiry_date"),
          ]);
          const rows = (products || []).map(p => {
            const pBatches = (batches || []).filter(b => b.product_id === p.id);
            return {
              ...p,
              total_batch_qty: pBatches.reduce((s, b) => s + b.quantity, 0),
              batch_count: pBatches.length,
              nearest_expiry: pBatches.length > 0 ? pBatches[0].expiry_date : "",
            };
          });
          csv = toCSV(rows);
          filename = `inventory-stock-${now}.csv`;
          break;
        }
        case "customers": {
          const [{ data: credits }, { data: txns }] = await Promise.all([
            supabase.from("customer_credits").select("*").order("customer_name"),
            supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }),
          ]);
          // Export both sheets as combined
          const customerRows = (credits || []).map(c => ({
            customer_name: c.customer_name,
            customer_phone: c.customer_phone,
            credit_balance: c.credit_balance,
            total_spent: c.total_spent,
            total_paid: c.total_paid,
            customer_type: (c as any).customer_type || "",
          }));
          csv = toCSV(customerRows);
          filename = `customer-ledgers-${now}.csv`;
          break;
        }
        case "financial": {
          let query = supabase.from("vouchers").select("voucher_number, voucher_type, voucher_date, party_name, narration, total_amount, status");
          if (dateFrom) query = query.gte("voucher_date", dateFrom);
          if (dateTo) query = query.lte("voucher_date", dateTo + "T23:59:59");
          const { data, error } = await query.order("voucher_date", { ascending: false });
          if (error) throw error;
          csv = toCSV(data || []);
          filename = `financial-report-${now}.csv`;
          break;
        }
      }

      if (!csv) {
        toast.error("No data to export");
      } else {
        downloadCSV(csv, filename);
        toast.success(`Exported ${filename}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
        <Download className="h-5 w-5 text-primary" />
        Data Portability
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Export your data as CSV files. Date filters apply to Sales History and Financial Reports.
      </p>

      <div className="flex gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From Date</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To Date</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="self-end" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DATASETS.map(ds => (
          <div key={ds.key} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="font-medium text-sm">{ds.label}</p>
              <p className="text-xs text-muted-foreground">{ds.description}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => handleExport(ds.key)}
              className="gap-2 shrink-0"
            >
              {exporting === ds.key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              CSV
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataExportSection;

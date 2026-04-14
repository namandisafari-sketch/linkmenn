import { useState } from "react";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const DATASETS = [
  { key: "products", label: "Products", description: "All products with prices, stock, and categories" },
  { key: "categories", label: "Categories", description: "Product categories" },
  { key: "orders", label: "Orders", description: "Sales orders with customer info and totals", dateField: "created_at" },
  { key: "order_items", label: "Order Items", description: "Individual line items for each order" },
  { key: "batches", label: "Product Batches", description: "Batch numbers, expiry dates, and quantities" },
  { key: "customers", label: "Customers", description: "Customer accounts with credit balances" },
  { key: "credit_txns", label: "Credit Transactions", description: "Customer payment and credit history", dateField: "created_at" },
  { key: "vouchers", label: "Vouchers", description: "Accounting vouchers and journal entries", dateField: "voucher_date" },
  { key: "ledger", label: "General Ledger", description: "Ledger entries with debits and credits", dateField: "entry_date" },
  { key: "suppliers", label: "Suppliers", description: "Supplier contact and payment details" },
  { key: "invoices", label: "Purchase Invoices", description: "Supplier invoices and payment status", dateField: "invoice_date" },
] as const;

type DatasetKey = typeof DATASETS[number]["key"];

const ExcelExportSection = () => {
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<DatasetKey>>(new Set(DATASETS.map(d => d.key)));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const toggleAll = () => {
    if (selected.size === DATASETS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(DATASETS.map(d => d.key)));
    }
  };

  const toggle = (key: DatasetKey) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };

  const fetchData = async (key: DatasetKey) => {
    const ds = DATASETS.find(d => d.key === key)!;
    const dateField = "dateField" in ds ? (ds as any).dateField : null;

    const tableMap: Record<DatasetKey, string> = {
      products: "products", categories: "categories", orders: "orders",
      order_items: "order_items", batches: "product_batches", customers: "customer_credits",
      credit_txns: "credit_transactions", vouchers: "vouchers", ledger: "general_ledger",
      suppliers: "suppliers", invoices: "purchase_invoices",
    };

    const table = tableMap[key] as any;
    let query = supabase.from(table).select("*");
    if (dateField && dateFrom) query = query.gte(dateField, dateFrom);
    if (dateField && dateTo) query = query.lte(dateField, dateTo + "T23:59:59");
    query = query.order(dateField || "created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return (data as any[]) || [];
  };

  const handleExport = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one dataset to export");
      return;
    }
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      for (const ds of DATASETS) {
        if (!selected.has(ds.key)) continue;
        const data = await fetchData(ds.key);
        let ws: XLSX.WorkSheet;
        if (data.length === 0) {
          ws = XLSX.utils.aoa_to_sheet([["No data"]]);
        } else {
          ws = XLSX.utils.json_to_sheet(data);
          ws["!cols"] = Object.keys(data[0]).map(k => ({
            wch: Math.min(Math.max(k.length, ...data.slice(0, 50).map(r => String(r[k] ?? "").length)) + 2, 40),
          }));
        }
        XLSX.utils.book_append_sheet(wb, ws, ds.label);
      }

      const now = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `marvid-export-${now}.xlsx`);
      toast.success("Data exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const hasDateFilters = DATASETS.some(d => selected.has(d.key) && "dateField" in d);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        Data Export
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Select the datasets you want to export and optionally filter by date range. Each dataset becomes a separate worksheet in the Excel file.
      </p>

      {/* Date Range */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From Date</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To Date</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>
        )}
        {hasDateFilters && (dateFrom || dateTo) && (
          <p className="text-xs text-muted-foreground">Date filters apply to: Orders, Credit Transactions, Vouchers, General Ledger, Purchase Invoices</p>
        )}
      </div>

      {/* Dataset Selection */}
      <div className="mb-4">
        <button
          onClick={toggleAll}
          className="text-xs font-medium text-primary hover:underline mb-2 inline-block"
        >
          {selected.size === DATASETS.length ? "Deselect All" : "Select All"}
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DATASETS.map(ds => (
            <label
              key={ds.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected.has(ds.key) ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
              }`}
            >
              <Checkbox
                checked={selected.has(ds.key)}
                onCheckedChange={() => toggle(ds.key)}
                className="mt-0.5"
              />
              <div>
                <p className="font-medium text-sm">{ds.label}</p>
                <p className="text-xs text-muted-foreground">{ds.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <Button onClick={handleExport} disabled={exporting || selected.size === 0} className="gap-2">
        {exporting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Exporting {selected.size} datasets...</>
        ) : (
          <><Download className="h-4 w-4" /> Export Selected ({selected.size}) as .xlsx</>
        )}
      </Button>
    </div>
  );
};

export default ExcelExportSection;

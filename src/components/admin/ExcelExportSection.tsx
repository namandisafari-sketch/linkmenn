import { useState } from "react";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const ExcelExportSection = () => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const [
        { data: products },
        { data: categories },
        { data: orders },
        { data: orderItems },
        { data: batches },
        { data: customers },
        { data: creditTxns },
        { data: vouchers },
        { data: ledger },
        { data: suppliers },
        { data: purchaseInvoices },
      ] = await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase.from("categories").select("*").order("name"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("order_items").select("*"),
        supabase.from("product_batches").select("*").order("expiry_date"),
        supabase.from("customer_credits").select("*").order("customer_name"),
        supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("vouchers").select("*").order("voucher_date", { ascending: false }),
        supabase.from("general_ledger").select("*").order("entry_date", { ascending: false }),
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("purchase_invoices").select("*").order("invoice_date", { ascending: false }),
      ]);

      const wb = XLSX.utils.book_new();

      const addSheet = (name: string, data: any[] | null) => {
        if (!data || data.length === 0) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["No data"]]), name);
          return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        // Auto-width columns
        const colWidths = Object.keys(data[0]).map(key => {
          const maxLen = Math.max(
            key.length,
            ...data.map(r => String(r[key] ?? "").length)
          );
          return { wch: Math.min(maxLen + 2, 40) };
        });
        ws["!cols"] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, name);
      };

      addSheet("Products", products);
      addSheet("Categories", categories);
      addSheet("Orders", orders);
      addSheet("Order Items", orderItems);
      addSheet("Product Batches", batches);
      addSheet("Customers", customers);
      addSheet("Credit Transactions", creditTxns);
      addSheet("Vouchers", vouchers);
      addSheet("General Ledger", ledger);
      addSheet("Suppliers", suppliers);
      addSheet("Purchase Invoices", purchaseInvoices);

      const now = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `marvid-system-data-${now}.xlsx`);
      toast.success("System data exported to Excel");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        Full System Export (Excel)
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Export all system data into a single Excel file with separate worksheets for Products, Orders, Customers, Batches, Vouchers, Suppliers, and more.
      </p>
      <Button onClick={handleExport} disabled={exporting} className="gap-2">
        {exporting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Exporting...</>
        ) : (
          <><Download className="h-4 w-4" /> Export All Data (.xlsx)</>
        )}
      </Button>
    </div>
  );
};

export default ExcelExportSection;

import { useState, useRef } from "react";
import { Upload, Loader2, FileText, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ImportTarget = "medicines" | "suppliers" | "medicine_batches" | "customer_credits";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ImportTarget;
  onSuccess?: () => void;
}

const TARGET_CONFIG: Record<ImportTarget, {
  label: string;
  requiredColumns: string[];
  optionalColumns: string[];
  sampleRow: Record<string, string>;
}> = {
  medicines: {
    label: "Medicines / Inventory",
    requiredColumns: ["name", "price", "unit"],
    optionalColumns: ["description", "stock", "batch_number", "expiry_date", "product_code", "is_active", "requires_prescription"],
    sampleRow: { name: "Paracetamol 500mg", price: "2500", unit: "Box", stock: "100", batch_number: "BT-001", expiry_date: "2027-06-30", product_code: "PC-001" },
  },
  suppliers: {
    label: "Suppliers",
    requiredColumns: ["name"],
    optionalColumns: ["contact_person", "phone", "email", "address", "payment_terms"],
    sampleRow: { name: "MedPharma Ltd", contact_person: "John Doe", phone: "+256700000000", email: "info@medpharma.ug", address: "Kampala" },
  },
  medicine_batches: {
    label: "Medicine Batches",
    requiredColumns: ["medicine_id", "batch_number", "expiry_date", "quantity"],
    optionalColumns: ["mfg_date", "purchase_price", "mrp"],
    sampleRow: { medicine_id: "uuid-here", batch_number: "BT-001", expiry_date: "2027-06-30", quantity: "50", purchase_price: "1500", mrp: "2500" },
  },
  customer_credits: {
    label: "Customer Accounts",
    requiredColumns: ["customer_name", "customer_phone"],
    optionalColumns: ["credit_balance", "total_spent", "total_paid", "customer_type"],
    sampleRow: { customer_name: "Jane Doe", customer_phone: "+256700000000", credit_balance: "0", total_spent: "0", total_paid: "0" },
  },
};

const parseCSV = (text: string): Record<string, string>[] => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += char; }
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
};

const CsvImportDialog = ({ open, onOpenChange, target, onSuccess }: CsvImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const config = TARGET_CONFIG[target];

  const handleFile = async (f: File) => {
    setFile(f);
    setErrors([]);
    const text = await f.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      setErrors(["File is empty or has no data rows"]);
      setPreview([]);
      return;
    }
    // Validate required columns
    const headers = Object.keys(rows[0]);
    const missing = config.requiredColumns.filter(c => !headers.includes(c));
    if (missing.length > 0) {
      setErrors([`Missing required columns: ${missing.join(", ")}`]);
    }
    setPreview(rows.slice(0, 5));
  };

  const downloadTemplate = () => {
    const allCols = [...config.requiredColumns, ...config.optionalColumns];
    const header = allCols.join(",");
    const sample = allCols.map(c => config.sampleRow[c] || "").join(",");
    const csv = `${header}\n${sample}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${target}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file || errors.length > 0) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      // Transform rows based on target
      const records = rows.map(row => {
        const record: Record<string, any> = {};
        const allCols = [...config.requiredColumns, ...config.optionalColumns];
        allCols.forEach(col => {
          if (row[col] !== undefined && row[col] !== "") {
            // Type coercion
            if (["price", "stock", "quantity", "purchase_price", "mrp", "credit_balance", "total_spent", "total_paid", "wholesale_price"].includes(col)) {
              record[col] = Number(row[col]) || 0;
            } else if (["is_active", "requires_prescription"].includes(col)) {
              record[col] = row[col].toLowerCase() === "true" || row[col] === "1";
            } else {
              record[col] = row[col];
            }
          }
        });
        return record;
      });

      if (records.length === 0) throw new Error("No valid rows to import");

      // Batch insert (Supabase supports up to 1000 rows at a time)
      const batchSize = 500;
      let imported = 0;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase.from(target).insert(batch as any);
        if (error) throw error;
        imported += batch.length;
      }

      toast.success(`Imported ${imported} records into ${config.label}`);
      setFile(null);
      setPreview([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import {config.label} from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Template download */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Download CSV Template</p>
              <p className="text-xs text-muted-foreground">Required: {config.requiredColumns.join(", ")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Template
            </Button>
          </div>

          {/* File upload */}
          {!file ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 hover:bg-muted/30 transition-colors"
            >
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select CSV file</p>
              <p className="text-xs text-muted-foreground">Supports .csv files</p>
            </button>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />

          {/* Errors */}
          {errors.length > 0 && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Preview (first {preview.length} rows):</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {Object.keys(preview[0]).map(h => (
                        <th key={h} className="px-2 py-1.5 font-semibold text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-2 py-1.5 whitespace-nowrap max-w-[150px] truncate">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import button */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button onClick={handleImport} disabled={!file || errors.length > 0 || importing} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Importing..." : "Import Data"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CsvImportDialog;

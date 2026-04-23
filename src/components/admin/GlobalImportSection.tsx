import { useState, useRef } from "react";
import { Upload, Loader2, FileUp, CheckCircle, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

type ImportTarget = "medicines" | "suppliers" | "customer_credits" | "medicine_batches";

const TARGET_CONFIG: Record<ImportTarget, { label: string; columns: string[] }> = {
  products: { label: "Products / Inventory", columns: ["name", "price", "stock", "unit"] },
  suppliers: { label: "Suppliers", columns: ["name"] },
  customer_credits: { label: "Customer Accounts", columns: ["customer_name", "customer_phone"] },
  product_batches: { label: "Product Batches", columns: ["product_id", "batch_number", "expiry_date"] },
};

// Deep character normalization — handles encoding artifacts, invisible chars, smart quotes etc.
const deepClean = (val: string): string => {
  return val
    // BOM and zero-width chars
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, "")
    // Smart quotes to regular
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // En/em dashes
    .replace(/[\u2013\u2014]/g, "-")
    // Ellipsis
    .replace(/\u2026/g, "...")
    // Non-breaking space
    .replace(/\u00A0/g, " ")
    // Multiple spaces
    .replace(/\s+/g, " ")
    // Trim
    .trim();
};

const normalizeHeader = (h: string): string => {
  return deepClean(h)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};

const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const cleaned = deepClean(text);
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const rawHeaders = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  const headers = rawHeaders.map(normalizeHeader);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals: string[] = [];
    let current = "";
    let inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { vals.push(deepClean(current)); current = ""; continue; }
      current += ch;
    }
    vals.push(deepClean(current));

    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = vals[j] || ""; });
    rows.push(row);
  }

  return { headers, rows };
};

const GlobalImportSection = () => {
  const [target, setTarget] = useState<ImportTarget>("medicines");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const data = parseCSV(text);
      setParsed(data);
      toast.success(`Parsed ${data.rows.length} rows with deep character scan`);
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setProgress(0);
    const res = { imported: 0, skipped: 0, errors: [] as string[] };
    const batchSize = 20;

    for (let i = 0; i < parsed.rows.length; i += batchSize) {
      const batch = parsed.rows.slice(i, i + batchSize);
      
      for (const row of batch) {
        // Coerce types
        const record: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (!v) continue;
          if (["price", "stock", "credit_balance", "total_spent", "total_paid", "quantity", "purchase_price", "mrp", "buying_price", "wholesale_price", "pieces_per_unit"].includes(k)) {
            record[k] = parseFloat(v) || 0;
          } else if (["is_active", "requires_prescription"].includes(k)) {
            record[k] = v.toLowerCase() === "true" || v === "1";
          } else {
            record[k] = deepClean(v);
          }
        }

        // Skip rows missing required columns
        const required = TARGET_CONFIG[target].columns;
        const missing = required.filter(c => !record[c]);
        if (missing.length > 0) {
          res.skipped++;
          continue;
        }

        const { error } = await (supabase.from(target) as any).insert(record);
        if (error) {
          if (error.code === "23505") {
            res.skipped++;
          } else {
            res.errors.push(`Row ${i + batch.indexOf(row) + 2}: ${error.message}`);
          }
        } else {
          res.imported++;
        }
      }
      setProgress(Math.round(((i + batch.length) / parsed.rows.length) * 100));
    }

    setResult(res);
    setImporting(false);
    if (res.errors.length === 0) {
      toast.success(`Imported ${res.imported} records, ${res.skipped} skipped`);
    } else {
      toast.error(`Completed with ${res.errors.length} errors`);
    }
  };

  const reset = () => {
    setFile(null);
    setParsed(null);
    setResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
        <Search className="h-5 w-5 text-primary" />
        Global Import with Deep Character Scan
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Import CSV files with advanced character normalization — handles encoding issues, smart quotes, invisible characters, and BOM markers automatically.
      </p>

      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={target}
            onChange={(e) => { setTarget(e.target.value as ImportTarget); reset(); }}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            {Object.entries(TARGET_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" /> Select CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
        </div>

        {parsed && parsed.headers.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground">
              <strong>Detected columns:</strong> {parsed.headers.join(", ")}
            </div>
            <div className="rounded-lg border border-border overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {parsed.headers.slice(0, 6).map(h => (
                      <th key={h} className="text-left px-2 py-1.5 font-medium">{h}</th>
                    ))}
                    {parsed.headers.length > 6 && <th className="px-2 py-1.5">...</th>}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {parsed.headers.slice(0, 6).map(h => (
                        <td key={h} className="px-2 py-1 truncate max-w-[150px]">{row[h]}</td>
                      ))}
                      {parsed.headers.length > 6 && <td className="px-2 py-1">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground">{parsed.rows.length} total rows</div>

            {importing && <Progress value={progress} className="h-2" />}

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing} className="gap-2">
                {importing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing {progress}%</>
                ) : (
                  <><FileUp className="h-4 w-4" /> Import {parsed.rows.length} Records</>
                )}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={importing}>Clear</Button>
            </div>
          </>
        )}

        {result && (
          <div className={`p-4 rounded-lg border ${result.errors.length > 0 ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-500/5"}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.errors.length > 0 ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              <span className="font-semibold">Import Complete</span>
            </div>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✅ {result.imported} records imported</li>
              {result.skipped > 0 && <li>⏭️ {result.skipped} skipped (duplicates or missing fields)</li>}
              {result.errors.length > 0 && (
                <li className="text-destructive">❌ {result.errors.length} errors:
                  <ul className="ml-4 mt-1 space-y-0.5">
                    {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalImportSection;

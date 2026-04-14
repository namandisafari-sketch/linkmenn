import { useState, useRef, useCallback } from "react";
import {
  Brain, Upload, FileText, Loader2, CheckCircle, AlertTriangle,
  ArrowRight, RefreshCw, Sparkles, ChevronDown, ChevronUp, X, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  parseCSV, parseTallyXML, analyzeData, transformRows, deepClean,
  TABLE_SCHEMAS, type AnalysisResult, type ImportTarget,
} from "@/lib/import-engine";

type Phase = "idle" | "parsing" | "analyzing" | "ready" | "importing" | "done";

const SmartImportEngine = ({ onSuccess }: { onSuccess?: () => void }) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ImportTarget | null>(null);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [showReasoning, setShowReasoning] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setFile(null);
    setRawData(null);
    setAnalysis(null);
    setSelectedTarget(null);
    setProgress(0);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setPhase("parsing");
    setImportResult(null);

    const text = await readFileText(f);
    let headers: string[] = [];
    let rows: Record<string, string>[] = [];
    let xmlType: string | undefined;

    // Detect format
    const trimmed = text.trim();
    if (trimmed.startsWith("<") || trimmed.startsWith("\uFEFF<")) {
      // XML
      const result = parseTallyXML(text);
      headers = result.headers;
      rows = result.rows;
      xmlType = result.xmlType;
    } else {
      // CSV
      const result = parseCSV(text);
      headers = result.headers;
      rows = result.rows;
    }

    if (rows.length === 0) {
      toast.error("No data found in file");
      reset();
      return;
    }

    setRawData({ headers, rows });
    setPhase("analyzing");

    // Small delay for visual feedback
    await new Promise((r) => setTimeout(r, 400));

    const result = analyzeData(headers, rows, xmlType);
    setAnalysis(result);
    setSelectedTarget(result.detectedTarget);
    setPhase("ready");

    toast.success(`Analyzed ${rows.length} rows — ${result.confidence}% confidence`);
  }, [reset]);

  const handleImport = useCallback(async () => {
    if (!rawData || !selectedTarget || !analysis) return;
    setPhase("importing");
    setProgress(0);

    const columnMap = selectedTarget === analysis.detectedTarget
      ? analysis.columnMap
      : buildAutoMap(rawData.headers, selectedTarget);

    const records = transformRows(rawData.rows, columnMap, selectedTarget);
    if (records.length === 0) {
      toast.error("No valid records to import after transformation");
      setPhase("ready");
      return;
    }

    const result = { imported: 0, skipped: 0, errors: [] as string[] };
    const batchSize = 50;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error, data } = await (supabase.from(selectedTarget) as any).insert(batch).select("id");

      if (error) {
        if (error.code === "23505") {
          result.skipped += batch.length;
        } else {
          // Try individual inserts for partial success
          for (const rec of batch) {
            const { error: singleErr } = await (supabase.from(selectedTarget) as any).insert(rec);
            if (singleErr) {
              if (singleErr.code === "23505") result.skipped++;
              else result.errors.push(`${singleErr.message}`);
            } else {
              result.imported++;
            }
          }
        }
      } else {
        result.imported += data?.length || batch.length;
      }

      setProgress(Math.round(((i + batch.length) / records.length) * 100));
    }

    setImportResult(result);
    setPhase("done");

    if (result.errors.length === 0) {
      toast.success(`✅ Imported ${result.imported} records, ${result.skipped} skipped`);
    } else {
      toast.error(`Completed with ${result.errors.length} errors`);
    }
    onSuccess?.();
  }, [rawData, selectedTarget, analysis, onSuccess]);

  const buildAutoMap = (headers: string[], target: ImportTarget): Record<string, string> => {
    const schema = TABLE_SCHEMAS.find((s) => s.table === target);
    if (!schema) return {};
    const map: Record<string, string> = {};
    const used = new Set<string>();
    for (const h of headers) {
      const hNorm = h.toLowerCase().replace(/[^a-z0-9]/g, "_");
      for (const col of schema.columns) {
        if (used.has(col.name)) continue;
        const allNames = [col.name, ...col.aliases].map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, "_"));
        if (allNames.some((a) => hNorm === a || (hNorm.length > 3 && a.includes(hNorm)) || (a.length > 3 && hNorm.includes(a)))) {
          map[h] = col.name;
          used.add(col.name);
          break;
        }
      }
    }
    return map;
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Smart Import Engine</h3>
            <p className="text-xs text-muted-foreground">
              Auto-detects format, maps columns, validates & imports — CSV and Tally XML
            </p>
          </div>
          {phase !== "idle" && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Phase: Idle — File upload */}
        {phase === "idle" && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center gap-3 hover:bg-muted/30 hover:border-primary/40 transition-all group"
          >
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">Drop a file or click to select</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports CSV, Tally XML (Vouchers, Stock Summary, Balance Sheet, Day Book)
              </p>
            </div>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xml,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        {/* Phase: Parsing */}
        {phase === "parsing" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium text-sm">Parsing {file?.name}...</p>
              <p className="text-xs text-muted-foreground">Scanning for format, encoding, and structure</p>
            </div>
          </div>
        )}

        {/* Phase: Analyzing */}
        {phase === "analyzing" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            <Sparkles className="h-5 w-5 animate-pulse text-primary" />
            <div>
              <p className="font-medium text-sm">Analyzing data structure...</p>
              <p className="text-xs text-muted-foreground">
                Matching columns, detecting patterns, validating integrity
              </p>
            </div>
          </div>
        )}

        {/* Phase: Ready — Show analysis results */}
        {(phase === "ready" || phase === "importing" || phase === "done") && analysis && (
          <>
            {/* File info */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{file?.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {rawData?.rows.length} rows
                </Badge>
                {analysis.xmlType && (
                  <Badge variant="outline" className="text-xs">
                    {analysis.xmlType.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${analysis.confidence > 70 ? "bg-green-500" : analysis.confidence > 40 ? "bg-yellow-500" : "bg-red-500"}`} />
                <span className="text-xs font-medium">{analysis.confidence}% confidence</span>
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Brain className="h-4 w-4 text-primary" />
                  Analysis Reasoning
                </span>
                {showReasoning ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showReasoning && (
                <div className="px-4 py-3 space-y-1.5 bg-muted/10 max-h-48 overflow-y-auto">
                  {analysis.reasoning.map((r, i) => (
                    <p key={i} className="text-xs text-muted-foreground font-mono">{r}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Target selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Import Target</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TABLE_SCHEMAS.filter(s => ["products", "suppliers", "customer_credits", "tally_vouchers", "categories", "product_batches", "purchase_invoices"].includes(s.table)).map((s) => (
                  <button
                    key={s.table}
                    onClick={() => setSelectedTarget(s.table)}
                    disabled={phase === "importing"}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      selectedTarget === s.table
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    } ${analysis.detectedTarget === s.table ? "ring-1 ring-primary/30" : ""}`}
                  >
                    {s.label}
                    {analysis.detectedTarget === s.table && (
                      <Zap className="inline h-3 w-3 ml-1 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Column mapping */}
            {Object.keys(analysis.columnMap).length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Column Mapping</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(analysis.columnMap).map(([src, tgt]) => (
                    <div key={src} className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 text-xs">
                      <span className="text-muted-foreground">{src}</span>
                      <ArrowRight className="h-3 w-3 text-primary" />
                      <span className="font-medium">{tgt}</span>
                    </div>
                  ))}
                </div>
                {analysis.unmappedColumns.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Skipped: {analysis.unmappedColumns.join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total", value: analysis.stats.totalRows, color: "text-foreground" },
                { label: "Valid", value: analysis.stats.validRows, color: "text-green-500" },
                { label: "Duplicates", value: analysis.stats.duplicateRows, color: "text-yellow-500" },
                { label: "Empty", value: analysis.stats.emptyRows, color: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {analysis.warnings.length > 0 && (
              <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-1">
                {analysis.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Suggested Actions */}
            {analysis.suggestedActions.length > 0 && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
                <p className="text-xs font-medium text-primary mb-1">Suggested Actions:</p>
                {analysis.suggestedActions.map((a, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    {a}
                  </p>
                ))}
              </div>
            )}

            {/* Data preview */}
            {rawData && (
              <div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mb-2"
                >
                  {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showPreview ? "Hide" : "Show"} data preview
                </button>
                {showPreview && (
                  <div className="rounded-lg border border-border overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          {rawData.headers.slice(0, 6).map((h) => (
                            <th key={h} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{h}</th>
                          ))}
                          {rawData.headers.length > 6 && <th className="px-2">...</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rawData.rows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {rawData.headers.slice(0, 6).map((h) => (
                              <td key={h} className="px-2 py-1 truncate max-w-[150px]">{row[h]}</td>
                            ))}
                            {rawData.headers.length > 6 && <td className="px-2">...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Import progress */}
            {phase === "importing" && (
              <Progress value={progress} className="h-2" />
            )}

            {/* Import result */}
            {importResult && (
              <div className={`p-4 rounded-lg border ${importResult.errors.length > 0 ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-500/5"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {importResult.errors.length > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span className="font-semibold text-sm">Import Complete</span>
                </div>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>✅ {importResult.imported} records imported</p>
                  {importResult.skipped > 0 && <p>⏭️ {importResult.skipped} skipped (duplicates or missing fields)</p>}
                  {importResult.errors.length > 0 && (
                    <div className="text-destructive">
                      ❌ {importResult.errors.length} errors:
                      <ul className="ml-4 mt-1 space-y-0.5">
                        {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {phase === "ready" && selectedTarget && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleImport} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Import {analysis.stats.validRows} Records → {TABLE_SCHEMAS.find((s) => s.table === selectedTarget)?.label}
                </Button>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
              </div>
            )}

            {phase === "done" && (
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={reset} className="gap-2">
                  <Upload className="h-4 w-4" /> Import Another File
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Helper to read file with encoding detection
async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for UTF-16 BOM
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  // UTF-8 (with or without BOM)
  return new TextDecoder("utf-8").decode(buffer);
}

export default SmartImportEngine;

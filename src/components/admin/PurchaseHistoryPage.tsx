import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Search, ChevronDown, ChevronUp, FileArchive, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface TallyItem {
  name: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

interface ImportValidation {
  totalVouchers: number;
  validVouchers: number;
  skippedDuplicates: number;
  supplierBreakdown: Record<string, number>;
  warnings: string[];
  errors: string[];
  records: any[];
  duplicateGuids: string[];
}

function parseXmlVouchers(xmlText: string): ImportValidation {
  const result: ImportValidation = {
    totalVouchers: 0,
    validVouchers: 0,
    skippedDuplicates: 0,
    supplierBreakdown: {},
    warnings: [],
    errors: [],
    records: [],
    duplicateGuids: [],
  };

  const xmlStart = xmlText.indexOf("<");
  if (xmlStart === -1) {
    result.errors.push("No XML content found in file");
    return result;
  }
  const cleanXml = xmlText.substring(xmlStart);

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanXml, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    result.errors.push(`XML parse error: ${parseError.textContent?.slice(0, 200)}`);
    return result;
  }

  const allVouchers = doc.getElementsByTagName("VOUCHER");
  const purchaseVouchers: Element[] = [];

  for (let i = 0; i < allVouchers.length; i++) {
    const v = allVouchers[i];
    const vchType = v.getAttribute("VCHTYPE") || "";
    if (vchType === "Purchase") {
      purchaseVouchers.push(v);
    }
  }

  result.totalVouchers = purchaseVouchers.length;

  if (purchaseVouchers.length === 0) {
    result.errors.push("No purchase vouchers found in the XML file");
    const types: Record<string, number> = {};
    for (let i = 0; i < allVouchers.length; i++) {
      const t = allVouchers[i].getAttribute("VCHTYPE") || "unknown";
      types[t] = (types[t] || 0) + 1;
    }
    if (Object.keys(types).length > 0) {
      result.errors.push(`Found voucher types: ${Object.entries(types).map(([k, v]) => `${k}(${v})`).join(", ")}`);
    }
    return result;
  }

  purchaseVouchers.forEach((v, idx) => {
    const rowNum = idx + 1;

    const getField = (tagName: string): string => {
      const els = v.getElementsByTagName(tagName);
      return els.length > 0 ? (els[0].textContent || "").trim() : "";
    };

    const dateStr = getField("DATE");
    if (!dateStr || dateStr.length < 8) {
      result.warnings.push(`Voucher #${rowNum}: Invalid or missing date "${dateStr}"`);
    }
    const dateFmt = dateStr.length === 8
      ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      : dateStr;
    const year = parseInt(dateStr.slice(0, 4)) || new Date().getFullYear();

    const party = getField("PARTYLEDGERNAME") || getField("PARTYNAME") || "";
    const vnum = getField("VOUCHERNUMBER") || "";
    const ref = getField("REFERENCE") || "";
    const guid = getField("GUID") || "";
    const addrEl = v.getElementsByTagName("ADDRESS");
    const addr = addrEl.length > 0 ? (addrEl[0].textContent || "").trim() : "";

    if (!party) {
      result.warnings.push(`Voucher #${rowNum} (${vnum}): Missing supplier/party name`);
    }
    if (!guid) {
      result.warnings.push(`Voucher #${rowNum} (${vnum}): Missing GUID - deduplication won't work`);
    }

    let total = 0;
    const ledgerLists = v.getElementsByTagName("ALLLEDGERENTRIES.LIST");
    for (let i = 0; i < ledgerLists.length; i++) {
      const le = ledgerLists[i];
      const isParty = le.getElementsByTagName("ISPARTYLEDGER");
      if (isParty.length > 0 && isParty[0].textContent === "Yes") {
        const amtEl = le.getElementsByTagName("AMOUNT");
        if (amtEl.length > 0) {
          total = Math.abs(parseFloat(amtEl[0].textContent || "0"));
        }
      }
    }

    if (total === 0) {
      result.warnings.push(`Voucher #${rowNum} (${vnum}): Total amount is 0 - check ledger entries`);
    }

    const items: TallyItem[] = [];
    const invLists = v.getElementsByTagName("INVENTORYALLOCATIONS.LIST");
    for (let i = 0; i < invLists.length; i++) {
      const inv = invLists[i];
      const nameEl = inv.getElementsByTagName("STOCKITEMNAME");
      const name = nameEl.length > 0 ? (nameEl[0].textContent || "").trim() : "";
      
      const rateEl = inv.getElementsByTagName("RATE");
      const rateStr = rateEl.length > 0 ? (rateEl[0].textContent || "0") : "0";
      const rate = Math.abs(parseFloat(rateStr.split("/")[0]) || 0);
      
      const amtEl = inv.getElementsByTagName("AMOUNT");
      const amount = amtEl.length > 0 ? Math.abs(parseFloat(amtEl[0].textContent || "0")) : 0;
      
      const qtyEl = inv.getElementsByTagName("ACTUALQTY");
      const qtyStr = qtyEl.length > 0 ? (qtyEl[0].textContent || "0").trim() : "0";
      const qtyMatch = qtyStr.match(/^([\d.]+)/);
      const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
      const unitMatch = qtyStr.match(/[\d.]+\s+(\w+)/);
      const unit = unitMatch ? unitMatch[1] : "pc";

      if (name) {
        items.push({ name, qty, unit, rate, amount });
      }
    }

    if (items.length === 0) {
      result.warnings.push(`Voucher #${rowNum} (${vnum}): No inventory items found`);
    }

    const supplierKey = party || "Unknown";
    result.supplierBreakdown[supplierKey] = (result.supplierBreakdown[supplierKey] || 0) + 1;

    result.records.push({
      voucher_number: vnum,
      voucher_type: "Purchase",
      voucher_date: dateFmt,
      party_name: party,
      reference: ref,
      total_amount: total,
      address: addr,
      year,
      guid: guid || undefined,
      items,
    });

    result.validVouchers++;
  });

  return result;
}

const PurchaseHistoryPage = () => {
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress state
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState("");
  const [importStats, setImportStats] = useState({ imported: 0, skipped: 0, errors: 0 });

  const { data: vouchers = [], isLoading, refetch } = useQuery({
    queryKey: ["tally-vouchers", yearFilter],
    queryFn: async () => {
      let q = supabase
        .from("tally_vouchers")
        .select("*")
        .order("voucher_date", { ascending: false });
      if (yearFilter !== "all") {
        q = q.eq("year", parseInt(yearFilter));
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filteredVouchers = vouchers.filter(
    (v) =>
      v.party_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.voucher_number?.toLowerCase().includes(search.toLowerCase()) ||
      v.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const years = [...new Set(vouchers.map((v) => v.year))].sort((a, b) => b - a);
  const totalAmount = filteredVouchers.reduce((s, v) => s + Number(v.total_amount), 0);

  const handleFileSelect = async (file: File) => {
    try {
      setImportStage("Parsing XML file...");
      setImportProgress(10);
      const text = await file.text();
      const result = parseXmlVouchers(text);

      // Check for existing duplicates in database
      setImportStage("Checking for duplicates...");
      setImportProgress(30);

      const guids = result.records.map((r: any) => r.guid).filter(Boolean);
      if (guids.length > 0) {
        const { data: existing } = await supabase
          .from("tally_vouchers")
          .select("guid")
          .in("guid", guids);

        const existingGuids = new Set((existing || []).map((e: any) => e.guid));
        const newRecords: any[] = [];
        const dupGuids: string[] = [];

        result.records.forEach((r: any) => {
          if (r.guid && existingGuids.has(r.guid)) {
            dupGuids.push(r.guid);
          } else {
            newRecords.push(r);
          }
        });

        result.duplicateGuids = dupGuids;
        result.skippedDuplicates = dupGuids.length;
        result.records = newRecords;
        result.validVouchers = newRecords.length;

        if (dupGuids.length > 0) {
          result.warnings.unshift(`${dupGuids.length} voucher(s) already exist and will be skipped`);
        }
      }

      setImportProgress(50);
      setImportStage("");
      setValidation(result);
      setShowPreview(true);
    } catch (err: any) {
      toast.error(`Failed to read file: ${err.message}`);
      setImportStage("");
      setImportProgress(0);
    }
  };

  const handleConfirmImport = async () => {
    if (!validation || validation.records.length === 0) return;
    setImporting(true);
    setShowPreview(false);
    setImportStats({ imported: 0, skipped: validation.skippedDuplicates, errors: 0 });
    setImportProgress(0);

    try {
      const batchSize = 50;
      let imported = 0;
      let errorCount = 0;
      const totalRecords = validation.records.length;

      for (let i = 0; i < totalRecords; i += batchSize) {
        const batch = validation.records.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(totalRecords / batchSize);

        setImportStage(`Importing batch ${batchNum}/${totalBatches}... (${imported}/${totalRecords} records)`);
        setImportProgress(Math.round((i / totalRecords) * 100));

        const { error } = await supabase
          .from("tally_vouchers" as any)
          .insert(batch as any);

        if (error) {
          // If insert fails (maybe some duplicates slipped through), try one-by-one
          for (const record of batch) {
            const { error: singleErr } = await supabase
              .from("tally_vouchers" as any)
              .insert(record as any);
            if (singleErr) {
              errorCount++;
            } else {
              imported++;
            }
          }
        } else {
          imported += batch.length;
        }

        setImportStats({ imported, skipped: validation.skippedDuplicates, errors: errorCount });
      }

      setImportProgress(100);
      setImportStage("Import complete!");

      if (errorCount > 0) {
        toast.error(`Imported ${imported}, skipped ${validation.skippedDuplicates} duplicates, ${errorCount} errors`);
      } else {
        toast.success(
          `Successfully imported ${imported} new vouchers. ${validation.skippedDuplicates > 0 ? `${validation.skippedDuplicates} duplicates skipped.` : ""}`
        );
      }

      refetch();
      setTimeout(() => {
        setImporting(false);
        setImportStage("");
        setImportProgress(0);
        setImportStats({ imported: 0, skipped: 0, errors: 0 });
        setValidation(null);
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setImporting(false);
      setImportStage("");
      setImportProgress(0);
    }
  };

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileSelect(f);
          e.target.value = "";
        }}
      />

      {/* Import Button & Progress */}
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          className="gap-2"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {importing ? "Importing..." : "Import Tally XML"}
        </Button>
      </div>

      {/* Import Progress Bar */}
      {(importing || importStage) && (
        <div className="bg-card rounded-xl border border-border p-4 mb-6 space-y-3">
          <div className="flex items-center gap-3">
            {importing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {importProgress === 100 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            <span className="text-sm font-medium">{importStage}</span>
          </div>
          <Progress value={importProgress} className="h-2" />
          {importStats.imported > 0 || importStats.skipped > 0 ? (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {importStats.imported} imported
              </span>
              {importStats.skipped > 0 && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                  {importStats.skipped} skipped (duplicates)
                </span>
              )}
              {importStats.errors > 0 && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  {importStats.errors} errors
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Import Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Preview & Validation</DialogTitle>
          </DialogHeader>
          {validation && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 pr-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Found in File</p>
                    <p className="text-xl font-bold">{validation.totalVouchers}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">New (to import)</p>
                    <p className="text-xl font-bold text-primary">{validation.validVouchers}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Duplicates (skip)</p>
                    <p className="text-xl font-bold text-yellow-600">{validation.skippedDuplicates}</p>
                  </div>
                </div>

                {/* Supplier Breakdown */}
                <div>
                  <p className="text-sm font-semibold mb-2">Suppliers Detected</p>
                  <div className="space-y-1">
                    {Object.entries(validation.supplierBreakdown).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          {name}
                        </span>
                        <span className="text-muted-foreground">{count} vouchers</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Errors */}
                {validation.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-destructive mb-2">Errors</p>
                    {validation.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded px-3 py-2 mb-1">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-warning mb-2">Warnings ({validation.warnings.length})</p>
                    {validation.warnings.slice(0, 10).map((warn, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-warning bg-warning/10 rounded px-3 py-2 mb-1">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {warn}
                      </div>
                    ))}
                    {validation.warnings.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-1">...and {validation.warnings.length - 10} more warnings</p>
                    )}
                  </div>
                )}

                {/* Items sample */}
                <div>
                  <p className="text-sm font-semibold mb-2">
                    Total Items: {validation.records.reduce((s, r) => s + (r.items?.length || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total Amount: UGX {validation.records.reduce((s, r) => s + r.total_amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Cancel</Button>
            <Button
              onClick={handleConfirmImport}
              disabled={!validation || validation.errors.length > 0 || validation.validVouchers === 0}
            >
              {validation?.validVouchers === 0 ? "Nothing to Import" : `Import ${validation?.validVouchers || 0} New Vouchers`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search supplier, voucher no, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Vouchers</p>
          <p className="text-2xl font-bold">{filteredVouchers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
          <p className="text-2xl font-bold">UGX {totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Suppliers</p>
          <p className="text-2xl font-bold">{new Set(filteredVouchers.map((v) => v.party_name)).size}</p>
        </div>
      </div>

      {/* Voucher list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border h-20 animate-pulse" />
          ))}
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="text-center py-16">
          <FileArchive className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No purchase vouchers found</p>
          <p className="text-xs text-muted-foreground mt-1">Import a Tally XML file to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredVouchers.map((v) => {
            const items = (v.items as unknown as TallyItem[]) || [];
            const isExpanded = expandedId === v.id;
            return (
              <div key={v.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-sm">#{v.voucher_number}</span>
                      <span className="text-xs text-muted-foreground">{v.reference}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{v.party_name}</span>
                      <span>•</span>
                      <span>{format(new Date(v.voucher_date), "dd MMM yyyy")}</span>
                      <span>•</span>
                      <span>{items.length} items</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">UGX {Number(v.total_amount).toLocaleString()}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isExpanded && items.length > 0 && (
                  <div className="border-t border-border px-4 py-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left py-1.5 font-medium">Item</th>
                          <th className="text-right py-1.5 font-medium">Qty</th>
                          <th className="text-right py-1.5 font-medium">Rate</th>
                          <th className="text-right py-1.5 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((item, i) => (
                          <tr key={i}>
                            <td className="py-1.5">{item.name}</td>
                            <td className="text-right py-1.5">{item.qty} {item.unit}</td>
                            <td className="text-right py-1.5">{Number(item.rate).toLocaleString()}</td>
                            <td className="text-right py-1.5 font-medium">{Number(item.amount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PurchaseHistoryPage;

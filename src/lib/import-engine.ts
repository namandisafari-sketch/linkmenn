/**
 * Smart Import Engine
 * Analyzes file contents (CSV/XML), auto-detects target table,
 * maps columns, transforms data, and validates before import.
 */

// ── Schema definitions for each importable table ──────────────────────
export type ImportTarget =
  | "medicines"
  | "suppliers"
  | "customer_credits"
  | "medicine_batches"
  | "tally_vouchers"
  | "categories"
  | "purchase_invoices";

interface ColumnDef {
  name: string;
  type: "text" | "number" | "boolean" | "date" | "uuid" | "jsonb";
  required: boolean;
  aliases: string[]; // fuzzy match names
}

interface TableSchema {
  label: string;
  table: ImportTarget;
  columns: ColumnDef[];
  /** Fingerprint patterns: if these columns exist, it's likely this table */
  fingerprints: string[][];
  /** Content patterns: regex patterns on cell values that hint at this table */
  contentHints: RegExp[];
}

const TABLE_SCHEMAS: TableSchema[] = [
  {
    label: "Products / Inventory",
    table: "medicines",
    fingerprints: [
      ["name", "price", "unit"],
      ["stock_item", "rate", "quantity"],
      ["product", "selling_price"],
      ["item_name", "mrp"],
      ["name", "stock", "buying_price"],
    ],
    contentHints: [
      /tab(let)?s?$/i, /syrup/i, /capsule/i, /injection/i, /cream/i,
      /\d+\s*(mg|ml|gm|kg)/i, /strip|veil|box|pack|dozen|dz/i,
    ],
    columns: [
      { name: "name", type: "text", required: true, aliases: ["product_name", "item_name", "stock_item", "stockitemname", "item", "product", "description", "drug_name", "medicine"] },
      { name: "price", type: "number", required: false, aliases: ["selling_price", "rate", "mrp", "retail_price", "sale_price", "sp", "unit_price"] },
      { name: "buying_price", type: "number", required: false, aliases: ["cost", "cost_price", "purchase_price", "bp", "cp", "buy_price"] },
      { name: "wholesale_price", type: "number", required: false, aliases: ["ws_price", "bulk_price", "trade_price"] },
      { name: "stock", type: "number", required: false, aliases: ["quantity", "qty", "opening_stock", "closing_stock", "balance", "on_hand"] },
      { name: "unit", type: "text", required: false, aliases: ["uom", "unit_of_measure", "measure", "pack_type"] },
      { name: "batch_number", type: "text", required: false, aliases: ["batch", "batch_no", "lot", "lot_number", "batchname"] },
      { name: "expiry_date", type: "date", required: false, aliases: ["expiry", "exp_date", "exp", "best_before", "shelf_life"] },
      { name: "product_code", type: "text", required: false, aliases: ["code", "sku", "barcode", "item_code", "product_id"] },
      { name: "description", type: "text", required: false, aliases: ["desc", "details", "notes", "remarks"] },
      { name: "is_active", type: "boolean", required: false, aliases: ["active", "status", "enabled"] },
      { name: "requires_prescription", type: "boolean", required: false, aliases: ["prescription", "rx", "rx_required"] },
      { name: "pieces_per_unit", type: "number", required: false, aliases: ["pcs_per_unit", "pieces", "count_per_pack"] },
      { name: "unit_description", type: "text", required: false, aliases: ["unit_desc", "pack_description", "pack_info"] },
    ],
  },
  {
    label: "Suppliers",
    table: "suppliers",
    fingerprints: [
      ["name", "contact_person"],
      ["supplier", "phone"],
      ["vendor", "address"],
      ["ledgername", "party"],
      ["name", "payment_terms"],
    ],
    contentHints: [
      /pharma/i, /ltd|limited/i, /supplier/i, /vendor/i,
      /\+256\d+/i, /kampala|jinja|entebbe/i,
    ],
    columns: [
      { name: "name", type: "text", required: true, aliases: ["supplier_name", "vendor_name", "company", "ledgername", "party_name", "firm"] },
      { name: "contact_person", type: "text", required: false, aliases: ["contact", "person", "rep", "representative"] },
      { name: "phone", type: "text", required: false, aliases: ["tel", "telephone", "mobile", "cell", "phone_number"] },
      { name: "email", type: "text", required: false, aliases: ["e_mail", "email_address", "mail"] },
      { name: "address", type: "text", required: false, aliases: ["location", "addr", "city", "town"] },
      { name: "payment_terms", type: "text", required: false, aliases: ["terms", "credit_terms", "pay_terms"] },
    ],
  },
  {
    label: "Customer Accounts",
    table: "customer_credits",
    fingerprints: [
      ["customer_name", "customer_phone"],
      ["customer", "phone", "balance"],
      ["name", "phone", "credit"],
      ["client", "mobile", "owing"],
    ],
    contentHints: [
      /d\/s/i, /drug\s*shop/i, /clinic/i, /hospital/i, /pharmacy/i,
    ],
    columns: [
      { name: "customer_name", type: "text", required: true, aliases: ["name", "customer", "client", "client_name", "party_name", "account_name"] },
      { name: "customer_phone", type: "text", required: true, aliases: ["phone", "mobile", "tel", "telephone", "contact"] },
      { name: "credit_balance", type: "number", required: false, aliases: ["balance", "owing", "credit", "amount_due", "outstanding"] },
      { name: "total_spent", type: "number", required: false, aliases: ["spent", "purchases", "total_purchases"] },
      { name: "total_paid", type: "number", required: false, aliases: ["paid", "payments", "total_payments"] },
      { name: "customer_type", type: "text", required: false, aliases: ["type", "category", "classification", "class"] },
    ],
  },
  {
    label: "Product Batches",
    table: "medicine_batches",
    fingerprints: [
      ["product_id", "batch_number", "expiry_date"],
      ["batch", "expiry", "quantity"],
      ["lot", "mfg_date", "exp_date"],
    ],
    contentHints: [
      /^BT-\d+/i, /^\d{4}-\d{2}-\d{2}$/,
    ],
    columns: [
      { name: "product_id", type: "uuid", required: true, aliases: ["product", "item_id", "stock_item_id"] },
      { name: "batch_number", type: "text", required: true, aliases: ["batch", "batch_no", "lot", "lot_number"] },
      { name: "expiry_date", type: "date", required: true, aliases: ["expiry", "exp_date", "exp", "best_before"] },
      { name: "quantity", type: "number", required: false, aliases: ["qty", "stock", "count", "units"] },
      { name: "mfg_date", type: "date", required: false, aliases: ["manufacture_date", "mfg", "production_date"] },
      { name: "purchase_price", type: "number", required: false, aliases: ["cost", "buying_price", "cp"] },
      { name: "mrp", type: "number", required: false, aliases: ["retail_price", "selling_price", "sp", "max_retail_price"] },
    ],
  },
  {
    label: "Tally Vouchers",
    table: "tally_vouchers",
    fingerprints: [
      ["voucher_number", "voucher_date", "voucher_type"],
      ["vouchernumber", "date", "vouchertypename"],
      ["voucher_no", "date", "type"],
    ],
    contentHints: [
      /purchase|sales|receipt|payment|journal/i,
      /^\d{8}$/, // Tally date format YYYYMMDD
    ],
    columns: [
      { name: "voucher_number", type: "text", required: true, aliases: ["voucher_no", "vouchernumber", "vch_no", "invoice_no"] },
      { name: "voucher_date", type: "date", required: true, aliases: ["date", "vch_date", "invoice_date"] },
      { name: "voucher_type", type: "text", required: false, aliases: ["type", "vouchertypename", "vch_type"] },
      { name: "party_name", type: "text", required: false, aliases: ["party", "partyname", "customer", "supplier"] },
      { name: "total_amount", type: "number", required: false, aliases: ["amount", "total", "value", "grand_total"] },
      { name: "year", type: "number", required: false, aliases: ["fy", "financial_year", "period"] },
      { name: "reference", type: "text", required: false, aliases: ["ref", "ref_no", "reference_number"] },
      { name: "address", type: "text", required: false, aliases: ["addr", "location"] },
      { name: "guid", type: "text", required: false, aliases: ["id", "unique_id", "remote_id"] },
      { name: "items", type: "jsonb", required: false, aliases: ["line_items", "inventory", "details"] },
    ],
  },
  {
    label: "Categories",
    table: "categories",
    fingerprints: [
      ["name", "icon"],
      ["category", "description"],
      ["group_name"],
      ["stock_group"],
    ],
    contentHints: [
      /analgesic/i, /antibiotic/i, /anti.?fungal/i, /supplement/i,
    ],
    columns: [
      { name: "name", type: "text", required: true, aliases: ["category_name", "group_name", "stock_group", "category", "group"] },
      { name: "description", type: "text", required: false, aliases: ["desc", "details", "notes"] },
      { name: "icon", type: "text", required: false, aliases: ["emoji", "symbol"] },
    ],
  },
  {
    label: "Purchase Invoices",
    table: "purchase_invoices",
    fingerprints: [
      ["supplier_name", "invoice_number", "total_amount"],
      ["invoice", "supplier", "amount"],
      ["bill_no", "vendor", "total"],
    ],
    contentHints: [
      /invoice/i, /bill/i, /unpaid|paid|partial/i,
    ],
    columns: [
      { name: "supplier_name", type: "text", required: true, aliases: ["supplier", "vendor", "vendor_name", "party"] },
      { name: "invoice_number", type: "text", required: false, aliases: ["invoice_no", "bill_no", "inv_no", "number"] },
      { name: "invoice_date", type: "date", required: false, aliases: ["date", "bill_date", "inv_date"] },
      { name: "total_amount", type: "number", required: false, aliases: ["total", "amount", "grand_total", "value"] },
      { name: "amount_paid", type: "number", required: false, aliases: ["paid", "payment", "received"] },
      { name: "amount_due", type: "number", required: false, aliases: ["due", "balance", "outstanding", "owing"] },
      { name: "status", type: "text", required: false, aliases: ["payment_status", "state"] },
    ],
  },
];

// ── Deep character normalization ──────────────────────────────────────
export const deepClean = (val: string): string =>
  val
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeHeader = (h: string): string =>
  deepClean(h)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

// ── CSV Parsing ──────────────────────────────────────────────────────
export const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const cleaned = deepClean(text);
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const rawHeaders = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
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

// ── Tally XML Parsing ────────────────────────────────────────────────
const getTag = (line: string): { tag: string; value: string } | null => {
  const m = line.match(/<(\w[\w.]*?)>(.*?)<\/\1>/);
  return m ? { tag: m[1], value: m[2].trim() } : null;
};

export const parseTallyXML = (text: string): { headers: string[]; rows: Record<string, string>[]; xmlType: string } => {
  // Detect Tally voucher XML
  if (text.includes("<VOUCHER") && text.includes("VCHTYPE")) {
    return parseTallyVouchers(text);
  }
  // Detect stock summary
  if (text.includes("<DSPSTKINFO>") || text.includes("<DSPSTKCL>")) {
    return parseTallyStockSummary(text);
  }
  // Detect balance sheet
  if (text.includes("<BSNAME>") && text.includes("<BSAMT>")) {
    return parseTallyBalanceSheet(text);
  }
  // Detect group summary (sales books)
  if (text.includes("<DSPACCNAME>") && text.includes("<DSPCLCRAMTA>")) {
    return parseTallyGroupSummary(text);
  }
  return { headers: [], rows: [], xmlType: "unknown" };
};

function parseTallyVouchers(text: string): { headers: string[]; rows: Record<string, string>[]; xmlType: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/xml");
  const vouchers = doc.querySelectorAll("VOUCHER");
  const rows: Record<string, string>[] = [];

  vouchers.forEach((v) => {
    const dateRaw = v.querySelector("DATE")?.textContent || "";
    const vtype = v.querySelector("VOUCHERTYPENAME")?.textContent || "";
    const vnum = v.querySelector("VOUCHERNUMBER")?.textContent || "";
    const party = v.querySelector("PARTYNAME")?.textContent || v.querySelector("PARTYLEDGERNAME")?.textContent || "";
    const guid = v.querySelector("GUID")?.textContent || "";
    const ref = v.querySelector("REFERENCE")?.textContent || "";
    const addr = v.querySelector("ADDRESS")?.textContent || "";
    const posCash = v.querySelector("POSCASHRECEIVED")?.textContent || "0";

    // Get total
    let total = 0;
    v.querySelectorAll("ALLLEDGERENTRIES\\.LIST, LEDGERENTRIES\\.LIST").forEach((le) => {
      const amt = parseFloat(le.querySelector("AMOUNT")?.textContent || "0");
      if (amt > 0) total = Math.max(total, amt);
    });
    if (!total) total = Math.abs(parseFloat(posCash) || 0);

    // Inventory items
    const items: any[] = [];
    v.querySelectorAll("INVENTORYALLOCATIONS\\.LIST, ALLINVENTORYENTRIES\\.LIST").forEach((ie) => {
      items.push({
        name: ie.querySelector("STOCKITEMNAME")?.textContent || "",
        rate: ie.querySelector("RATE")?.textContent || "",
        amount: ie.querySelector("AMOUNT")?.textContent || "0",
        qty: ie.querySelector("ACTUALQTY")?.textContent || ie.querySelector("BILLEDQTY")?.textContent || "",
        batch: ie.querySelector("BATCHALLOCATIONS\\.LIST BATCHNAME")?.textContent || "",
      });
    });

    const dateFmt = dateRaw.length === 8
      ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6)}`
      : dateRaw;

    rows.push({
      voucher_number: vnum,
      voucher_date: dateFmt,
      voucher_type: vtype,
      party_name: party,
      total_amount: String(Math.abs(total)),
      year: dateRaw.slice(0, 4),
      reference: ref,
      address: addr,
      guid,
      items: JSON.stringify(items),
      _item_count: String(items.length),
    });
  });

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows, xmlType: "tally_vouchers" };
}

function parseTallyStockSummary(text: string): { headers: string[]; rows: Record<string, string>[]; xmlType: string } {
  const lines = text.split(/\r?\n/);
  const rows: Record<string, string>[] = [];
  let currentName = "";

  for (const line of lines) {
    const nameMatch = line.match(/<DSPDISPNAME>(.*?)<\/DSPDISPNAME>/);
    if (nameMatch) currentName = nameMatch[1].trim();
    const amtMatch = line.match(/<DSPCLAMTA>(.*?)<\/DSPCLAMTA>/);
    if (amtMatch && currentName) {
      const val = amtMatch[1].trim();
      rows.push({
        name: currentName,
        closing_amount: String(Math.abs(parseFloat(val) || 0)),
      });
      currentName = "";
    }
  }
  return { headers: ["name", "closing_amount"], rows, xmlType: "stock_summary" };
}

function parseTallyBalanceSheet(text: string): { headers: string[]; rows: Record<string, string>[]; xmlType: string } {
  const lines = text.split(/\r?\n/);
  const rows: Record<string, string>[] = [];
  let currentName = "";

  for (const line of lines) {
    const nameMatch = line.match(/<DSPDISPNAME>(.*?)<\/DSPDISPNAME>/);
    if (nameMatch) currentName = nameMatch[1].trim();
    const amtMatch = line.match(/<BSMAINAMT>(.*?)<\/BSMAINAMT>/);
    if (amtMatch && currentName) {
      rows.push({
        account_name: currentName,
        amount: amtMatch[1].trim() || "0",
      });
      currentName = "";
    }
  }
  return { headers: ["account_name", "amount"], rows, xmlType: "balance_sheet" };
}

function parseTallyGroupSummary(text: string): { headers: string[]; rows: Record<string, string>[]; xmlType: string } {
  const lines = text.split(/\r?\n/);
  const rows: Record<string, string>[] = [];
  let currentName = "";

  for (const line of lines) {
    const nameMatch = line.match(/<DSPDISPNAME>(.*?)<\/DSPDISPNAME>/);
    if (nameMatch) currentName = nameMatch[1].trim();
    const crMatch = line.match(/<DSPCLCRAMTA>(.*?)<\/DSPCLCRAMTA>/);
    if (crMatch && currentName) {
      rows.push({ name: currentName, credit_amount: crMatch[1].trim() || "0" });
      currentName = "";
    }
  }
  return { headers: ["name", "credit_amount"], rows, xmlType: "group_summary" };
}

// ── Analysis Engine ──────────────────────────────────────────────────

export interface AnalysisResult {
  detectedTarget: ImportTarget | null;
  confidence: number; // 0-100
  reasoning: string[];
  columnMap: Record<string, string>; // source -> target
  unmappedColumns: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    duplicateRows: number;
    emptyRows: number;
  };
  suggestedActions: string[];
  xmlType?: string;
}

export function analyzeData(
  headers: string[],
  rows: Record<string, string>[],
  xmlType?: string
): AnalysisResult {
  const reasoning: string[] = [];
  const warnings: string[] = [];
  const suggestedActions: string[] = [];

  // ── Step 1: If XML type is known, use it directly ──
  if (xmlType === "tally_vouchers") {
    reasoning.push("🔍 Detected Tally voucher XML format (contains VOUCHER elements with dates, parties, and inventory)");
    const colMap = buildColumnMap(headers, TABLE_SCHEMAS.find((s) => s.table === "tally_vouchers")!);
    const stats = computeStats(rows, colMap, TABLE_SCHEMAS.find((s) => s.table === "tally_vouchers")!);
    const totalItems = rows.reduce((sum, r) => sum + (parseInt(r._item_count) || 0), 0);
    reasoning.push(`📦 Found ${rows.length} vouchers containing ${totalItems} inventory line items`);
    const types: Record<string, number> = {};
    rows.forEach((r) => { types[r.voucher_type] = (types[r.voucher_type] || 0) + 1; });
    reasoning.push(`📊 Voucher types: ${Object.entries(types).map(([t, c]) => `${t} (${c})`).join(", ")}`);
    suggestedActions.push("Import vouchers with embedded inventory items as JSONB");
    suggestedActions.push("Extract product prices from purchase voucher line items");

    return {
      detectedTarget: "tally_vouchers",
      confidence: 98,
      reasoning,
      columnMap: colMap,
      unmappedColumns: headers.filter((h) => !colMap[h] && h !== "_item_count"),
      warnings,
      stats,
      suggestedActions,
      xmlType,
    };
  }

  if (xmlType === "stock_summary") {
    reasoning.push("📊 Detected Tally Stock Summary — contains category/product valuations");
    suggestedActions.push("Update category descriptions with stock valuations");
    suggestedActions.push("Cross-reference products with closing amounts");
    return {
      detectedTarget: "categories",
      confidence: 75,
      reasoning,
      columnMap: { name: "name" },
      unmappedColumns: ["closing_amount"],
      warnings: ["Stock summary contains both categories and products — will match against existing data"],
      stats: { totalRows: rows.length, validRows: rows.length, duplicateRows: 0, emptyRows: 0 },
      suggestedActions,
      xmlType,
    };
  }

  if (xmlType === "balance_sheet" || xmlType === "group_summary") {
    reasoning.push(`📋 Detected Tally ${xmlType === "balance_sheet" ? "Balance Sheet" : "Group Summary"} — financial summary data`);
    suggestedActions.push("Store as reference data for financial reporting");
    return {
      detectedTarget: null,
      confidence: 90,
      reasoning,
      columnMap: {},
      unmappedColumns: headers,
      warnings: ["This is summary/report data — best stored as a reference snapshot rather than imported into a transaction table"],
      stats: { totalRows: rows.length, validRows: rows.length, duplicateRows: 0, emptyRows: 0 },
      suggestedActions,
      xmlType,
    };
  }

  // ── Step 2: Fingerprint matching (column names) ────
  const normalizedHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "_"));
  let bestMatch: TableSchema | null = null;
  let bestScore = 0;

  for (const schema of TABLE_SCHEMAS) {
    let schemaScore = 0;

    // Fingerprint check
    for (const fp of schema.fingerprints) {
      const fpNorm = fp.map((f) => f.toLowerCase().replace(/[^a-z0-9]/g, "_"));
      const matched = fpNorm.filter((f) =>
        normalizedHeaders.some((h) => h === f || h.includes(f) || f.includes(h))
      );
      const fpScore = (matched.length / fp.length) * 60;
      schemaScore = Math.max(schemaScore, fpScore);
    }

    // Alias matching for columns
    let aliasMatches = 0;
    for (const col of schema.columns) {
      const allNames = [col.name, ...col.aliases].map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, "_"));
      if (normalizedHeaders.some((h) => allNames.some((a) => h === a || h.includes(a)))) {
        aliasMatches++;
      }
    }
    const aliasScore = (aliasMatches / Math.min(schema.columns.length, headers.length)) * 25;
    schemaScore += aliasScore;

    // Content hint check (sample first 10 rows)
    let contentMatches = 0;
    const sampleValues = rows.slice(0, 10).flatMap((r) => Object.values(r));
    for (const hint of schema.contentHints) {
      if (sampleValues.some((v) => hint.test(v))) contentMatches++;
    }
    const contentScore = schema.contentHints.length > 0
      ? (contentMatches / schema.contentHints.length) * 15
      : 0;
    schemaScore += contentScore;

    if (schemaScore > bestScore) {
      bestScore = schemaScore;
      bestMatch = schema;
    }

    reasoning.push(
      `🔎 ${schema.label}: fingerprint=${Math.round(schemaScore - aliasScore - contentScore)}%, alias=${Math.round(aliasScore)}%, content=${Math.round(contentScore)}% → total ${Math.round(schemaScore)}%`
    );
  }

  if (!bestMatch || bestScore < 20) {
    reasoning.push("⚠️ Could not confidently detect the target table — manual selection recommended");
    return {
      detectedTarget: null,
      confidence: 0,
      reasoning,
      columnMap: {},
      unmappedColumns: headers,
      warnings: ["Unable to auto-detect target. Please select manually."],
      stats: { totalRows: rows.length, validRows: rows.length, duplicateRows: 0, emptyRows: 0 },
      suggestedActions: ["Select target table manually and map columns"],
    };
  }

  reasoning.push(`✅ Best match: ${bestMatch.label} (confidence: ${Math.round(bestScore)}%)`);

  // ── Step 3: Build column mapping ───────────────────
  const columnMap = buildColumnMap(headers, bestMatch);
  const unmappedColumns = headers.filter((h) => !columnMap[h]);
  if (unmappedColumns.length > 0) {
    warnings.push(`Unmapped columns will be skipped: ${unmappedColumns.join(", ")}`);
  }

  // Check required columns
  const mappedTargets = new Set(Object.values(columnMap));
  const missingRequired = bestMatch.columns.filter((c) => c.required && !mappedTargets.has(c.name));
  if (missingRequired.length > 0) {
    warnings.push(`Missing required columns: ${missingRequired.map((c) => c.name).join(", ")}`);
  }

  // ── Step 4: Compute stats ─────────────────────────
  const stats = computeStats(rows, columnMap, bestMatch);
  if (stats.emptyRows > 0) warnings.push(`${stats.emptyRows} empty rows will be skipped`);
  if (stats.duplicateRows > 0) warnings.push(`${stats.duplicateRows} potential duplicate rows detected`);

  // ── Step 5: Suggested actions ─────────────────────
  if (bestMatch.table === "medicines") {
    suggestedActions.push("New products will be added; existing ones with same name will be skipped");
    if (mappedTargets.has("buying_price")) suggestedActions.push("Buying prices will be set from import data");
  }
  if (bestMatch.table === "suppliers") {
    suggestedActions.push("Suppliers with duplicate names will be skipped automatically");
  }
  if (bestMatch.table === "customer_credits") {
    suggestedActions.push("Customer accounts will be created with initial balances");
  }

  return {
    detectedTarget: bestMatch.table,
    confidence: Math.min(Math.round(bestScore), 99),
    reasoning,
    columnMap,
    unmappedColumns,
    warnings,
    stats,
    suggestedActions,
  };
}

function buildColumnMap(headers: string[], schema: TableSchema): Record<string, string> {
  const map: Record<string, string> = {};
  const usedTargets = new Set<string>();

  for (const header of headers) {
    const hNorm = header.toLowerCase().replace(/[^a-z0-9]/g, "_");
    for (const col of schema.columns) {
      if (usedTargets.has(col.name)) continue;
      const allNames = [col.name, ...col.aliases].map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, "_"));
      if (allNames.some((a) => hNorm === a || (hNorm.length > 3 && a.includes(hNorm)) || (a.length > 3 && hNorm.includes(a)))) {
        map[header] = col.name;
        usedTargets.add(col.name);
        break;
      }
    }
  }
  return map;
}

function computeStats(
  rows: Record<string, string>[],
  columnMap: Record<string, string>,
  schema: TableSchema
): AnalysisResult["stats"] {
  let validRows = 0;
  let emptyRows = 0;
  const seen = new Set<string>();
  let duplicateRows = 0;

  const requiredCols = schema.columns.filter((c) => c.required).map((c) => c.name);
  const reverseMap: Record<string, string> = {};
  for (const [src, tgt] of Object.entries(columnMap)) reverseMap[tgt] = src;

  for (const row of rows) {
    const allEmpty = Object.values(row).every((v) => !v.trim());
    if (allEmpty) { emptyRows++; continue; }

    const hasRequired = requiredCols.every((col) => {
      const srcCol = reverseMap[col];
      return srcCol && row[srcCol]?.trim();
    });
    if (hasRequired) validRows++;

    // Dedupe key: first required column value
    const key = requiredCols.map((c) => row[reverseMap[c]] || "").join("|");
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  }

  return { totalRows: rows.length, validRows, duplicateRows, emptyRows };
}

// ── Data Transformation ──────────────────────────────────────────────

export function transformRows(
  rows: Record<string, string>[],
  columnMap: Record<string, string>,
  target: ImportTarget
): Record<string, any>[] {
  const schema = TABLE_SCHEMAS.find((s) => s.table === target);
  if (!schema) return [];

  const colTypes: Record<string, ColumnDef["type"]> = {};
  for (const col of schema.columns) colTypes[col.name] = col.type;

  return rows
    .filter((row) => !Object.values(row).every((v) => !v.trim()))
    .map((row) => {
      const record: Record<string, any> = {};
      for (const [src, tgt] of Object.entries(columnMap)) {
        const rawVal = deepClean(row[src] || "");
        if (!rawVal) continue;

        switch (colTypes[tgt]) {
          case "number":
            record[tgt] = parseFloat(rawVal.replace(/,/g, "")) || 0;
            break;
          case "boolean":
            record[tgt] = rawVal.toLowerCase() === "true" || rawVal === "1" || rawVal.toLowerCase() === "yes";
            break;
          case "date": {
            // Handle YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY etc.
            let d = rawVal;
            if (/^\d{8}$/.test(d)) d = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
            else if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
              const [dd, mm, yyyy] = d.split("/");
              d = `${yyyy}-${mm}-${dd}`;
            }
            record[tgt] = d;
            break;
          }
          case "jsonb":
            try { record[tgt] = JSON.parse(rawVal); } catch { record[tgt] = rawVal; }
            break;
          default:
            record[tgt] = rawVal;
        }
      }
      return record;
    })
    .filter((r) => Object.keys(r).length > 0);
}

export { TABLE_SCHEMAS };

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ugx, VAT_RATE } from "@/lib/format";
import MedicineSearchPalette from "@/components/admin/MedicineSearchPalette";
import { Button } from "@/components/ui/button";
import { Trash2, Search, Printer, Loader2 } from "lucide-react";

/** Tally-style inline POS — full-grid line entry, sidebar totals, single-screen payment. */

interface MedLite {
  id: string;
  name: string;
  generic_name: string | null;
  brand: string | null;
  barcode: string | null;
  price: number;
  stock: number | null;
  unit: string | null;
  vat_applicable: boolean | null;
}

interface BatchLite {
  id: string;
  batch_number: string | null;
  expiry_date: string | null;
  qty_remaining: number;
}

interface Line {
  uid: string;
  medicine: MedLite | null;
  query: string;
  batch_id: string | null;
  batches: BatchLite[];
  qty: number;
  unit: string;
  rate: number;
  discount_pct: number;
  vat: boolean;
}

const blankLine = (): Line => ({
  uid: crypto.randomUUID(),
  medicine: null,
  query: "",
  batch_id: null,
  batches: [],
  qty: 1,
  unit: "pc",
  rate: 0,
  discount_pct: 0,
  vat: true,
});

const lineNet = (l: Line) => Math.max(0, l.qty * l.rate * (1 - l.discount_pct / 100));
const lineVat = (l: Line) => (l.vat ? lineNet(l) * (VAT_RATE / 100) : 0);
const lineTotal = (l: Line) => lineNet(l) + lineVat(l);

const POSInlinePage = () => {
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [paletteOpenFor, setPaletteOpenFor] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Record<string, MedLite[]>>({});
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit" | "mobile">("cash");
  const [tendered, setTendered] = useState<number>(0);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [posting, setPosting] = useState(false);
  const firstQtyRef = useRef<HTMLInputElement>(null);
  const debounceMap = useRef<Record<string, number>>({});

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0, vat = 0, discount = 0;
    for (const l of lines) {
      const gross = l.qty * l.rate;
      const disc = gross * (l.discount_pct / 100);
      discount += disc;
      subtotal += gross - disc;
      vat += lineVat(l);
    }
    return { subtotal, vat, discount, grand: subtotal + vat };
  }, [lines]);

  const change = Math.max(0, tendered - totals.grand);

  // Ensure last line is always blank (auto-append)
  useEffect(() => {
    const last = lines[lines.length - 1];
    if (last && last.medicine) setLines((ls) => [...ls, blankLine()]);
  }, [lines]);

  const updateLine = (uid: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));

  const removeLine = (uid: string) =>
    setLines((ls) => {
      const next = ls.filter((l) => l.uid !== uid);
      return next.length === 0 ? [blankLine()] : next;
    });

  // Inline medicine search per row
  const searchMeds = useCallback((uid: string, q: string) => {
    if (debounceMap.current[uid]) window.clearTimeout(debounceMap.current[uid]);
    if (!q.trim()) { setSearchResults((r) => ({ ...r, [uid]: [] })); return; }
    debounceMap.current[uid] = window.setTimeout(async () => {
      const { data } = await supabase
        .from("medicines")
        .select("id,name,generic_name,brand,barcode,price,stock,unit,vat_applicable")
        .eq("is_active", true)
        .or(`name.ilike.%${q}%,generic_name.ilike.%${q}%,brand.ilike.%${q}%,barcode.ilike.%${q}%`)
        .limit(8);
      setSearchResults((r) => ({ ...r, [uid]: (data as MedLite[]) ?? [] }));
    }, 150);
  }, []);

  const pickMedicine = async (uid: string, m: MedLite) => {
    // load batches FEFO
    const { data: batches } = await supabase
      .from("medicine_batches")
      .select("id,batch_number,expiry_date,qty_remaining")
      .eq("medicine_id", m.id)
      .gt("qty_remaining", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    const bs = (batches as BatchLite[]) ?? [];
    updateLine(uid, {
      medicine: m,
      query: m.name,
      rate: Number(m.price) || 0,
      unit: m.unit ?? "pc",
      vat: m.vat_applicable ?? true,
      batches: bs,
      batch_id: bs[0]?.id ?? null,
    });
    setSearchResults((r) => ({ ...r, [uid]: [] }));
  };

  // Ctrl+Enter posts the sale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void postSale();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, paymentMethod, tendered, customerName]);

  const resetForm = () => {
    setLines([blankLine()]);
    setTendered(0);
    setCustomerName("Walk-in Customer");
    setPaymentMethod("cash");
    setTimeout(() => {
      const first = document.querySelector<HTMLInputElement>("input[data-pos-search='1']");
      first?.focus();
    }, 50);
  };

  const postSale = async () => {
    const valid = lines.filter((l) => l.medicine && l.qty > 0 && l.rate > 0);
    if (valid.length === 0) { toast.error("Add at least one item"); return; }
    if (paymentMethod === "cash" && tendered < totals.grand) {
      toast.error("Tendered amount is less than grand total");
      return;
    }
    setPosting(true);
    try {
      // Ensure customer record (walk-in or named)
      let customerId: string | null = null;
      const { data: existing } = await supabase
        .from("customer_credits")
        .select("id")
        .eq("customer_name", customerName)
        .maybeSingle();
      if (existing?.id) customerId = existing.id;
      else {
        const { data: created } = await supabase
          .from("customer_credits")
          .insert({ customer_name: customerName })
          .select("id")
          .single();
        customerId = created?.id ?? null;
      }

      const sale_lines = valid.map((l) => ({
        medicine_id: l.medicine!.id,
        qty: l.qty,
        rate: l.rate,
        discount: l.qty * l.rate * (l.discount_pct / 100),
      }));

      const { data, error } = await supabase.rpc("post_sale_voucher", {
        p_sale_lines: sale_lines,
        p_customer_id: customerId!,
        p_payment_method: paymentMethod,
      });
      if (error) throw error;
      toast.success(`Sale posted · Voucher ${String(data).slice(0, 8)}`);
      window.print();
      resetForm();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to post sale";
      toast.error(msg);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-9rem)]">
      {/* Main grid */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-md overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="bg-transparent border-b border-border px-1 py-0.5 text-sm font-medium focus:outline-none focus:border-primary min-w-[180px]"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono text-[10px]">F3</kbd> search ·{" "}
            <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono text-[10px]">Ctrl+Enter</kbd> post
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="w-10 px-2 py-2 text-left font-semibold border-b border-border">#</th>
                <th className="px-2 py-2 text-left font-semibold border-b border-border min-w-[260px]">Medicine</th>
                <th className="w-32 px-2 py-2 text-left font-semibold border-b border-border">Batch</th>
                <th className="w-20 px-2 py-2 text-right font-semibold border-b border-border">Qty</th>
                <th className="w-16 px-2 py-2 text-left font-semibold border-b border-border">Unit</th>
                <th className="w-28 px-2 py-2 text-right font-semibold border-b border-border">Rate</th>
                <th className="w-20 px-2 py-2 text-right font-semibold border-b border-border">Disc%</th>
                <th className="w-16 px-2 py-2 text-center font-semibold border-b border-border">Tax</th>
                <th className="w-32 px-2 py-2 text-right font-semibold border-b border-border">Amount</th>
                <th className="w-10 border-b border-border" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const results = searchResults[l.uid] ?? [];
                const isLast = idx === lines.length - 1;
                return (
                  <tr key={l.uid} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-2 py-1.5 text-muted-foreground text-xs">{l.medicine ? idx + 1 : "·"}</td>
                    <td className="px-2 py-1.5 relative">
                      <input
                        data-pos-search={idx === 0 ? "1" : undefined}
                        value={l.query}
                        placeholder={isLast ? "Type medicine name, brand or barcode…" : ""}
                        onChange={(e) => {
                          updateLine(l.uid, { query: e.target.value, medicine: e.target.value === "" ? null : l.medicine });
                          searchMeds(l.uid, e.target.value);
                        }}
                        className="w-full bg-transparent outline-none text-sm py-0.5"
                      />
                      {results.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 top-full mt-0.5 bg-popover border border-border rounded shadow-lg max-h-72 overflow-auto">
                          {results.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => pickMedicine(l.uid, m)}
                              className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm flex justify-between gap-2 border-b border-border/40 last:border-b-0"
                            >
                              <span className="truncate">
                                <span className="font-medium">{m.name}</span>
                                <span className="text-muted-foreground text-xs ml-1">{m.generic_name ?? ""}</span>
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">stk {m.stock ?? 0} · {ugx(m.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {l.batches.length > 0 ? (
                        <select
                          value={l.batch_id ?? ""}
                          onChange={(e) => updateLine(l.uid, { batch_id: e.target.value })}
                          className="w-full bg-transparent outline-none text-xs border-b border-transparent focus:border-primary"
                        >
                          {l.batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.batch_number ?? "—"} · exp {b.expiry_date ?? "—"} · {b.qty_remaining}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={l.qty || ""}
                        onChange={(e) => updateLine(l.uid, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full bg-transparent outline-none text-right text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{l.unit}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={l.rate || ""}
                        onChange={(e) => updateLine(l.uid, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full bg-transparent outline-none text-right text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={l.discount_pct || ""}
                        onChange={(e) => updateLine(l.uid, { discount_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                        className="w-full bg-transparent outline-none text-right text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={l.vat}
                        onChange={(e) => updateLine(l.uid, { vat: e.target.checked })}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-sm font-semibold tabular-nums">
                      {l.medicine ? ugx(lineTotal(l)) : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      {l.medicine && (
                        <button onClick={() => removeLine(l.uid)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Payment row */}
        <div className="border-t border-border bg-muted/30 px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Payment</label>
            <div className="flex gap-1 mt-1">
              {(["cash", "credit", "mobile"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                    paymentMethod === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-accent"
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Amount Tendered</label>
            <input
              type="number"
              value={tendered || ""}
              onChange={(e) => setTendered(Math.max(0, parseFloat(e.target.value) || 0))}
              disabled={paymentMethod !== "cash"}
              className="mt-1 w-full bg-background border border-border rounded px-2 py-1.5 text-right text-sm tabular-nums disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Change Due</label>
            <div className="mt-1 px-2 py-1.5 bg-background border border-border rounded text-right text-sm font-bold tabular-nums">
              {ugx(change)}
            </div>
          </div>
          <Button onClick={postSale} disabled={posting} className="h-10 gap-2">
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Post & Print (Ctrl+Enter)
          </Button>
        </div>
      </div>

      {/* Sidebar totals */}
      <div className="lg:w-72 flex flex-col gap-3">
        <div className="bg-card border border-border rounded-md p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Running Total</div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums font-medium">{ugx(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums">−{ugx(totals.discount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">VAT ({VAT_RATE}%)</dt>
              <dd className="tabular-nums">{ugx(totals.vat)}</dd>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-base font-bold">
              <dt>Grand Total</dt>
              <dd className="tabular-nums">{ugx(totals.grand)}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-card border border-border rounded-md p-4 text-xs text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground mb-1">Shortcuts</div>
          <div><kbd className="px-1 py-0.5 bg-muted border rounded font-mono text-[10px]">F3</kbd> Open medicine search</div>
          <div><kbd className="px-1 py-0.5 bg-muted border rounded font-mono text-[10px]">Tab</kbd> Move across cells</div>
          <div><kbd className="px-1 py-0.5 bg-muted border rounded font-mono text-[10px]">Ctrl+Enter</kbd> Post sale & print</div>
        </div>
      </div>

      <MedicineSearchPalette
        open={paletteOpenFor !== null}
        onOpenChange={(v) => !v && setPaletteOpenFor(null)}
      />
    </div>
  );
};

export default POSInlinePage;

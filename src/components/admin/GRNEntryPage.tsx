import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, FileCheck2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ugx } from "@/lib/format";

interface Supplier { id: string; name: string; }
interface Medicine { id: string; name: string; unit: string | null; buying_price: number | null; }

interface Line {
  medicine_id: string;
  medicine_name: string;
  batch_number: string;
  manufacture_date: string;
  expiry_date: string;
  qty_received: number;
  rate: number;
}

const blankLine = (): Line => ({
  medicine_id: "",
  medicine_name: "",
  batch_number: "",
  manufacture_date: "",
  expiry_date: "",
  qty_received: 1,
  rate: 0,
});

const GRNEntryPage = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [grnDate, setGrnDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [grnId, setGrnId] = useState<string | null>(null);
  const [grnNumber, setGrnNumber] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [sup, med] = await Promise.all([
        supabase.from("suppliers").select("id,name").order("name"),
        supabase.from("medicines").select("id,name,unit,buying_price").eq("is_active", true).order("name").limit(2000),
      ]);
      if (sup.data) setSuppliers(sup.data as Supplier[]);
      if (med.data) setMedicines(med.data as Medicine[]);
    })();
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, []);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty_received) || 0) * (Number(l.rate) || 0), 0),
    [lines]
  );

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((p) => [...p, blankLine()]);
  const removeLine = (i: number) => setLines((p) => (p.length === 1 ? [blankLine()] : p.filter((_, idx) => idx !== i)));

  const onMedicineSelect = (i: number, id: string) => {
    const m = medicines.find((x) => x.id === id);
    updateLine(i, {
      medicine_id: id,
      medicine_name: m?.name ?? "",
      rate: Number(m?.buying_price) || 0,
    });
  };

  const validate = (): string | null => {
    if (!supplierName.trim()) return "Select or enter a supplier";
    const valid = lines.filter((l) => l.medicine_id && l.qty_received > 0 && l.expiry_date);
    if (!valid.length) return "Add at least one line with medicine, quantity, and expiry";
    for (const l of lines) {
      if (l.medicine_id && !l.expiry_date) return `Expiry date required for ${l.medicine_name}`;
      if (l.medicine_id && l.qty_received <= 0) return `Quantity > 0 required for ${l.medicine_name}`;
    }
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const { data: seq } = await supabase.rpc("next_voucher_number", { p_voucher_type: "grn" });
      const grnNo = (seq as string) || `GRN-${Date.now()}`;
      const { data: grn, error } = await supabase
        .from("goods_received_notes")
        .insert({
          grn_number: grnNo,
          grn_date: grnDate,
          supplier_id: supplierId || null,
          supplier_name: supplierName,
          invoice_reference: invoiceRef || null,
          notes: notes || null,
          status: "draft",
          total_amount: total,
        })
        .select("id,grn_number")
        .single();
      if (error) throw error;
      const linesPayload = lines
        .filter((l) => l.medicine_id && l.qty_received > 0)
        .map((l) => ({
          grn_id: grn.id,
          medicine_id: l.medicine_id,
          batch_number: l.batch_number || null,
          manufacture_date: l.manufacture_date || null,
          expiry_date: l.expiry_date,
          qty_received: l.qty_received,
          rate: l.rate,
          total: l.qty_received * l.rate,
        }));
      const { error: lineErr } = await supabase.from("grn_lines").insert(linesPayload);
      if (lineErr) throw lineErr;
      setGrnId(grn.id);
      setGrnNumber(grn.grn_number);
      toast.success(`Draft saved: ${grn.grn_number}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save GRN");
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!grnId) { toast.error("Save the draft first"); return; }
    setPosting(true);
    try {
      const { data, error } = await supabase.rpc("post_grn", { p_grn_id: grnId });
      if (error) throw error;
      toast.success(`GRN posted — Journal ${data}`);
      // Reset for next entry
      setLines([blankLine()]);
      setSupplierId(""); setSupplierName(""); setInvoiceRef(""); setNotes("");
      setGrnId(null); setGrnNumber(null);
      firstInputRef.current?.focus();
    } catch (e: any) {
      toast.error(e.message || "Failed to post GRN");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>Goods Received Note (F9)</span>
            {grnNumber && <Badge variant="secondary" className="font-mono">{grnNumber}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Supplier</Label>
            <Input
              ref={firstInputRef}
              list="supplier-list"
              value={supplierName}
              onChange={(e) => {
                setSupplierName(e.target.value);
                const m = suppliers.find((s) => s.name === e.target.value);
                setSupplierId(m?.id ?? "");
              }}
              placeholder="Type supplier name"
            />
            <datalist id="supplier-list">
              {suppliers.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><CalendarIcon className="h-3 w-3" />GRN Date</Label>
            <Input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Invoice Ref</Label>
            <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="INV-1234" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line (Alt+N)</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Medicine</th>
                <th className="text-left px-3 py-2 w-32">Batch #</th>
                <th className="text-left px-3 py-2 w-36">Mfg Date</th>
                <th className="text-left px-3 py-2 w-36">Expiry *</th>
                <th className="text-right px-3 py-2 w-24">Qty *</th>
                <th className="text-right px-3 py-2 w-32">Rate (UGX)</th>
                <th className="text-right px-3 py-2 w-32">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1">
                    <Input
                      list={`med-list-${i}`}
                      value={l.medicine_name}
                      onChange={(e) => {
                        const m = medicines.find((x) => x.name === e.target.value);
                        if (m) onMedicineSelect(i, m.id);
                        else updateLine(i, { medicine_name: e.target.value, medicine_id: "" });
                      }}
                      placeholder="Type to search..."
                      className="h-8"
                    />
                    <datalist id={`med-list-${i}`}>
                      {medicines.slice(0, 500).map((m) => <option key={m.id} value={m.name} />)}
                    </datalist>
                  </td>
                  <td className="px-2 py-1"><Input value={l.batch_number} onChange={(e) => updateLine(i, { batch_number: e.target.value })} className="h-8" /></td>
                  <td className="px-2 py-1"><Input type="date" value={l.manufacture_date} onChange={(e) => updateLine(i, { manufacture_date: e.target.value })} className="h-8" /></td>
                  <td className="px-2 py-1"><Input type="date" value={l.expiry_date} onChange={(e) => updateLine(i, { expiry_date: e.target.value })} className="h-8" required /></td>
                  <td className="px-2 py-1"><Input type="number" min={0} value={l.qty_received} onChange={(e) => updateLine(i, { qty_received: parseInt(e.target.value) || 0 })} className="h-8 text-right" /></td>
                  <td className="px-2 py-1"><Input type="number" min={0} step="0.01" value={l.rate} onChange={(e) => updateLine(i, { rate: parseFloat(e.target.value) || 0 })} className="h-8 text-right" /></td>
                  <td className="px-3 py-1 text-right font-mono">{ugx(l.qty_received * l.rate)}</td>
                  <td className="px-2 py-1 text-center">
                    <Button size="icon" variant="ghost" onClick={() => removeLine(i)} className="h-7 w-7 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td colSpan={6} className="px-3 py-2 text-right">Grand Total</td>
                <td className="px-3 py-2 text-right font-mono">{ugx(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={handleSaveDraft} disabled={saving || posting}>
          <Save className="h-4 w-4 mr-1" />{saving ? "Saving..." : "Save Draft"}
        </Button>
        <Button onClick={handlePost} disabled={!grnId || posting || saving}>
          <FileCheck2 className="h-4 w-4 mr-1" />{posting ? "Posting..." : "Post & Update Stock"}
        </Button>
      </div>
    </div>
  );
};

export default GRNEntryPage;

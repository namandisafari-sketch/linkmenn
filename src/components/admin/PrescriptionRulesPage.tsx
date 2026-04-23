import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Pill, Search, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PrescriptionRule {
  id: string;
  product_id: string | null;
  disease: string;
  symptoms: string | null;
  age_min: number;
  age_max: number;
  dosage: string;
  instructions: string | null;
  timing_notes: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  product_id: "",
  disease: "",
  symptoms: "",
  age_min: 0,
  age_max: 120,
  dosage: "",
  instructions: "",
  timing_notes: "",
};

const COMMON_DISEASES = [
  "Malaria", "Typhoid", "UTI", "Flu/Cold", "Pneumonia", "Diarrhea",
  "Hypertension", "Diabetes", "Asthma", "Skin Infection", "Eye Infection",
  "Ear Infection", "Dental Pain", "Headache/Migraine", "Arthritis",
];

const PrescriptionRulesPage = () => {
  const [rules, setRules] = useState<PrescriptionRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterDisease, setFilterDisease] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: rulesData }, { data: prodsData }] = await Promise.all([
      supabase.from("prescription_rules").select("*").order("disease"),
      supabase.from("medicines").select("id, name").eq("is_active", true).order("name"),
    ]);
    setRules((rulesData as PrescriptionRule[]) || []);
    setProducts(prodsData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getProductName = (id: string | null) => products.find(p => p.id === id)?.name || "Any Drug";

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (r: PrescriptionRule) => {
    setEditingId(r.id);
    setForm({
      product_id: r.product_id || "",
      disease: r.disease,
      symptoms: r.symptoms || "",
      age_min: r.age_min,
      age_max: r.age_max,
      dosage: r.dosage,
      instructions: r.instructions || "",
      timing_notes: r.timing_notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.disease || !form.dosage) {
      toast.error("Disease and dosage are required");
      return;
    }
    setSaving(true);
    const payload = {
      product_id: form.product_id || null,
      disease: form.disease,
      symptoms: form.symptoms || null,
      age_min: Number(form.age_min),
      age_max: Number(form.age_max),
      dosage: form.dosage,
      instructions: form.instructions || null,
      timing_notes: form.timing_notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("prescription_rules").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("prescription_rules").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    toast.success(editingId ? "Rule updated" : "Rule created");
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prescription rule?")) return;
    const { error } = await supabase.from("prescription_rules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rule deleted");
    fetchData();
  };

  const diseases = [...new Set(rules.map(r => r.disease))].sort();

  const filtered = rules.filter(r => {
    const matchSearch = r.disease.toLowerCase().includes(search.toLowerCase()) ||
      (r.symptoms || "").toLowerCase().includes(search.toLowerCase()) ||
      getProductName(r.product_id).toLowerCase().includes(search.toLowerCase());
    const matchDisease = !filterDisease || r.disease === filterDisease;
    return matchSearch && matchDisease;
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Rules", value: rules.length, icon: Pill },
          { label: "Diseases Covered", value: diseases.length, icon: Pill },
          { label: "Linked Products", value: new Set(rules.filter(r => r.product_id).map(r => r.product_id)).size, icon: Pill },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search rules..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={filterDisease} onChange={(e) => setFilterDisease(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">All Diseases</option>
            {diseases.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-lg">
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">No prescription rules found. Add one to get started.</p>
        ) : filtered.map(r => (
          <div key={r.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <Badge className="text-xs mb-1">{r.disease}</Badge>
                <p className="text-sm font-bold mt-1">{getProductName(r.product_id)}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Age:</span>
                <span className="font-medium text-xs">{r.age_min} - {r.age_max} years</span>
              </div>
              <div className="bg-primary/10 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">Dosage</p>
                <p className="font-bold text-primary">{r.dosage}</p>
              </div>
              {r.symptoms && (
                <div>
                  <p className="text-xs text-muted-foreground">Symptoms</p>
                  <p className="text-xs">{r.symptoms}</p>
                </div>
              )}
              {r.instructions && (
                <div>
                  <p className="text-xs text-muted-foreground">Instructions</p>
                  <p className="text-xs">{r.instructions}</p>
                </div>
              )}
              {r.timing_notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Default Timing</p>
                  <p className="text-xs font-medium">{r.timing_notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Prescription Rule" : "Add Prescription Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Disease / Condition *</label>
              <div className="flex gap-2">
                <Input
                  value={form.disease}
                  onChange={(e) => setForm({ ...form, disease: e.target.value })}
                  placeholder="e.g. Malaria"
                  list="diseases-list"
                />
                <datalist id="diseases-list">
                  {COMMON_DISEASES.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Symptoms</label>
              <textarea
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                rows={2}
                placeholder="e.g. High temperature, body aches, chills"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Drug / Product (optional)</label>
              <select
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Any / General</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Min Age</label>
                <Input type="number" value={form.age_min} onChange={(e) => setForm({ ...form, age_min: Number(e.target.value) })} min={0} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Max Age</label>
                <Input type="number" value={form.age_max} onChange={(e) => setForm({ ...form, age_max: Number(e.target.value) })} max={120} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Dosage *</label>
              <Input
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                placeholder="e.g. 3 tablets × 4 times daily"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Format: quantity × frequency (e.g. "2 × 3" means 2 tablets, 3 times a day)</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Instructions</label>
              <textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                rows={2}
                placeholder="e.g. Take after meals. Complete the full course."
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Default Timing</label>
              <Input
                value={form.timing_notes}
                onChange={(e) => setForm({ ...form, timing_notes: e.target.value })}
                placeholder="e.g. Morning, Afternoon, Evening, Bedtime"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Pharmacist can override timing at POS during dispensing</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrescriptionRulesPage;

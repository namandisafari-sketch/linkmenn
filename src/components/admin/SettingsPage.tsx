import { useState, useRef } from "react";
import { Save, RotateCcw, Eye, Upload, X, Loader2, Maximize2 } from "lucide-react";
import ExcelExportSection from "./ExcelExportSection";
import SmartImportEngine from "./SmartImportEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_RECEIPT = {
  businessName: "Marvid Pharmaceutical UG",
  tagline: "Your Health, Our Priority",
  address: "Kampala, Uganda",
  phone: "+256 700 000 000",
  email: "info@marvid.com",
  footerNote: "Thank you for choosing Marvid Pharmaceutical!",
  showLogo: true,
  logoUrl: "",
  logoSize: "60px",
  logoAlign: "center" as "left" | "center" | "right",
  paperWidth: "80mm",
  fontSize: "12px",
};

const SettingsPage = () => {
  const [receipt, setReceipt] = useState(() => {
    const saved = localStorage.getItem("marvid_receipt_settings");
    return saved ? { ...DEFAULT_RECEIPT, ...JSON.parse(saved) } : DEFAULT_RECEIPT;
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateField = (field: string, value: string | boolean) => {
    setReceipt((prev: typeof DEFAULT_RECEIPT) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `receipt-logo/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    updateField("logoUrl", publicUrl);
    setUploading(false);
    toast.success("Logo uploaded");
  };

  const handleSave = () => {
    localStorage.setItem("marvid_receipt_settings", JSON.stringify(receipt));
    toast.success("Receipt settings saved");
  };

  const handleReset = () => {
    setReceipt(DEFAULT_RECEIPT);
    localStorage.removeItem("marvid_receipt_settings");
    toast.success("Reset to defaults");
  };




  const handlePreviewPrint = () => {
    const previewHtml = buildFullPreviewHtml();
    const win = window.open("", "_blank", "width=420,height=700");
    if (!win) return;
    win.document.write(previewHtml);
    win.document.close();
    win.print();
  };

  const [fullScreenPreview, setFullScreenPreview] = useState(false);

  const buildFullPreviewHtml = () => {
    const logoHtml = receipt.showLogo && receipt.logoUrl
      ? `<img class="header-logo" src="${receipt.logoUrl}" alt="Logo" />`
      : "";
    return `<html><head><title>Receipt Preview</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: ${receipt.paperWidth} auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, sans-serif; font-size: ${receipt.fontSize}; width: 100%; padding: 14px; color: #0a0a0a; line-height: 1.6; font-weight: 500; }
        .header { padding-bottom: 14px; border-bottom: 1px dashed #ccc; margin-bottom: 14px; }
        .header-row { display: flex; align-items: center; gap: 10px; }
        .header-logo { width: ${receipt.logoSize || '40px'}; height: ${receipt.logoSize || '40px'}; object-fit: contain; border-radius: 50%; }
        .header-info { flex: 1; }
        .header h1 { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; margin: 0; }
        .header .tagline { font-size: 12px; color: #555; font-weight: 600; margin-top: 2px; }
        .header .address { font-size: 11px; color: #666; margin-top: 4px; }
        .header .contact { font-size: 11px; color: #1F617A; margin-top: 2px; font-weight: 600; }
        .meta { font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 14px; }
        .meta-row { display: flex; justify-content: flex-start; padding: 2px 0; }
        .meta-label { color: #666; font-weight: 600; margin-right: 4px; }
        .meta-value { font-weight: 700; }
        .items-header { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #666; padding: 8px 0; border-bottom: 1px dashed #ccc; }
        .item-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
        .item-name { flex: 1; font-weight: 700; }
        .item-qty { width: 45px; text-align: center; font-weight: 700; }
        .item-price { width: 90px; text-align: right; font-weight: 800; }
        .total-section { border-top: 1px dashed #ccc; padding: 12px 0; margin: 14px 0; display: flex; justify-content: space-between; }
        .total-label { font-size: 14px; font-weight: 900; }
        .total-value { font-size: 18px; font-weight: 900; }
        .qr-section { text-align: center; padding: 14px 0; border-top: 2px dashed #ccc; }
        .qr-section img { margin: 0 auto; }
        .qr-section p { font-size: 9px; color: #888; margin-top: 6px; }
        .footer { text-align: center; padding-top: 14px; border-top: 1px dashed #ccc; }
        .footer p { font-size: 11px; color: #666; font-weight: 600; }
        .footer .powered { margin-top: 6px; font-size: 9px; color: #aaa; }
      </style></head><body>
        <div class="header">
          <div class="header-row">
            ${logoHtml}
            <div class="header-info">
              <h1>${receipt.businessName}</h1>
              <div class="tagline">${receipt.tagline || ""}</div>
              <div class="address">${receipt.address || ""}</div>
              <div class="contact">${receipt.phone || ""}${receipt.email ? " | " + receipt.email : ""}</div>
            </div>
          </div>
        </div>
        <div class="meta">
          <div class="meta-row"><span class="meta-label">Receipt</span><span class="meta-value">#REC-000123</span></div>
          <div class="meta-row"><span class="meta-label">Customer</span><span class="meta-value">John Doe</span></div>
          <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${new Date().toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
          <div class="meta-row"><span class="meta-label">Payment</span><span class="meta-value">💵 Cash</span></div>
        </div>
        <div class="items-header"><span style="flex:1">Item</span><span style="width:45px;text-align:center">Qty</span><span style="width:90px;text-align:right">Amount</span></div>
        <div class="item-row"><span class="item-name">Paracetamol 500mg</span><span class="item-qty">2</span><span class="item-price">UGX 4,000</span></div>
        <div class="item-row"><span class="item-name">Amoxicillin 250mg</span><span class="item-qty">1</span><span class="item-price">UGX 8,500</span></div>
        <div class="item-row"><span class="item-name">Vitamin C 1000mg</span><span class="item-qty">3</span><span class="item-price">UGX 15,000</span></div>
        <div class="total-section">
          <span class="total-label">TOTAL</span>
          <span class="total-value">UGX 27,500</span>
        </div>
        <div class="qr-section">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=https://wa.me/256700000000?text=sample" alt="QR" width="110" height="110" />
          <p>Scan to open receipt on WhatsApp</p>
        </div>
        <div class="footer">
          <p>${receipt.footerNote}</p>
          <p class="powered">Powered by TennaHub Technologies Limited</p>
        </div>
      </body></html>`;
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Full System Excel Export */}
      <ExcelExportSection />

      {/* CSV Data Export */}
      <DataExportSection />

      {/* Smart Import Engine */}
      <SmartImportEngine />



      {/* Receipt Layout Settings */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-lg mb-4">Receipt Layout</h3>
        <div className="space-y-4">
          {/* Logo Section */}
          <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
            <label className="text-sm font-medium block">Business Logo</label>
            <div className="flex items-center gap-4">
              {receipt.logoUrl ? (
                <div className="relative">
                  <img src={receipt.logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded border border-border" />
                  <button onClick={() => updateField("logoUrl", "")} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded border border-dashed border-border flex items-center justify-center bg-background">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2 flex-1">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload Logo"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Logo Size</label>
                <select value={receipt.logoSize} onChange={(e) => updateField("logoSize", e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="40px">Small (40px)</option>
                  <option value="60px">Medium (60px)</option>
                  <option value="80px">Large (80px)</option>
                  <option value="100px">Extra Large (100px)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Logo Alignment</label>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => updateField("logoAlign", align)}
                      className={`flex-1 h-9 rounded-md border text-xs font-medium capitalize transition-colors ${receipt.logoAlign === align ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background hover:bg-accent"}`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={receipt.showLogo} onChange={(e) => updateField("showLogo", e.target.checked)} className="rounded" />
              Show logo on receipt
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Business Name</label>
              <Input value={receipt.businessName} onChange={(e) => updateField("businessName", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tagline</label>
              <Input value={receipt.tagline} onChange={(e) => updateField("tagline", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Input value={receipt.address} onChange={(e) => updateField("address", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={receipt.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input value={receipt.email} onChange={(e) => updateField("email", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Footer Note</label>
              <Input value={receipt.footerNote} onChange={(e) => updateField("footerNote", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Paper Width</label>
              <select value={receipt.paperWidth} onChange={(e) => updateField("paperWidth", e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="58mm">58mm (Small thermal)</option>
                <option value="80mm">80mm (Standard thermal)</option>
                <option value="210mm">A4 (210mm)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Font Size</label>
              <select value={receipt.fontSize} onChange={(e) => updateField("fontSize", e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="10px">Small (10px)</option>
                <option value="12px">Medium (12px)</option>
                <option value="14px">Large (14px)</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Save Settings
          </Button>
          <Button variant="outline" onClick={handlePreviewPrint} className="gap-2">
            <Eye className="h-4 w-4" /> Preview & Print
          </Button>
          <Button variant="outline" onClick={() => setFullScreenPreview(true)} className="gap-2">
            <Maximize2 className="h-4 w-4" /> Full Screen Preview
          </Button>
          <Button variant="ghost" onClick={handleReset} className="gap-2 text-muted-foreground">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-lg mb-4">Live Preview</h3>
        <div
          className="mx-auto bg-background border border-border rounded-lg p-5 shadow-sm"
          style={{ maxWidth: receipt.paperWidth === "210mm" ? "400px" : "300px", fontFamily: "'Inter', sans-serif", fontSize: receipt.fontSize }}
        >
          <div className="flex items-center gap-3 mb-2">
            {receipt.showLogo && receipt.logoUrl && (
              <img src={receipt.logoUrl} alt="Logo" style={{ height: receipt.logoSize, objectFit: "contain" }} className="rounded-full" />
            )}
            <div>
              <p className="font-black text-base tracking-tight">{receipt.businessName}</p>
              <p className="text-muted-foreground text-xs">{receipt.tagline}</p>
              <p className="text-xs text-muted-foreground">{receipt.address}</p>
              <p className="text-xs text-muted-foreground">{receipt.phone} | {receipt.email}</p>
            </div>
          </div>
          <div className="border-t border-dashed border-border my-3" />
          <p className="text-xs text-muted-foreground">Customer: John Doe</p>
          <p className="text-xs text-muted-foreground">Date: {new Date().toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Receipt #: REC-000123</p>
          <div className="border-t border-dashed border-border my-3" />
          <div className="flex justify-between text-xs font-bold">
            <span>Item</span><span>Qty</span><span>Amount</span>
          </div>
          <div className="border-t border-dashed border-border my-1" />
          <div className="flex justify-between text-xs"><span className="flex-1">Paracetamol 500mg</span><span className="w-8 text-center">2</span><span className="w-20 text-right">UGX 4,000</span></div>
          <div className="flex justify-between text-xs"><span className="flex-1">Amoxicillin 250mg</span><span className="w-8 text-center">1</span><span className="w-20 text-right">UGX 8,500</span></div>
          <div className="flex justify-between text-xs"><span className="flex-1">Vitamin C 1000mg</span><span className="w-8 text-center">3</span><span className="w-20 text-right">UGX 15,000</span></div>
          <div className="border-t border-dashed border-border my-3" />
          <div className="flex justify-between font-black text-sm"><span>TOTAL</span><span>UGX 27,500</span></div>
          <div className="border-t border-dashed border-border my-3" />
          <div className="text-center py-3 border-t-2 border-dashed border-border">
            <div className="inline-block w-20 h-20 bg-muted rounded border border-border mb-1" />
            <p className="text-[9px] text-muted-foreground">Scan to open receipt on WhatsApp</p>
          </div>
          <div className="border-t border-dashed border-border my-2" />
          <p className="text-center text-xs text-muted-foreground">{receipt.footerNote}</p>
          <p className="text-center text-[9px] text-muted-foreground mt-1">Powered by TennaHub Technologies Limited</p>
        </div>
      </div>

      {/* Full Screen Preview Modal */}
      {fullScreenPreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setFullScreenPreview(false)}>
          <div className="bg-background rounded-xl w-full max-w-md max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold">Full Receipt Preview</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handlePreviewPrint} className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Print
                </Button>
                <button onClick={() => setFullScreenPreview(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <iframe
              srcDoc={buildFullPreviewHtml()}
              className="w-full border-0"
              style={{ height: "70vh" }}
              title="Receipt Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, Calendar, DollarSign, TrendingUp, ShoppingBag,
  User, Clock, Filter, Printer, Receipt, RotateCcw, Trash2, Edit3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface SaleRecord {
  id: string;
  customer_name: string;
  phone: string;
  district: string;
  total: number;
  status: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
  order_items: { quantity: number; unit_price: number; product_id: string }[];
}

interface Product {
  id: string;
  name: string;
}

const SalesHistoryPage = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [filterPayment, setFilterPayment] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  const fetchSales = async () => {
    setLoading(true);
    const [{ data: orders }, { data: prods }] = await Promise.all([
      supabase.from("orders")
        .select("*, order_items(quantity, unit_price, product_id)")
        .in("status", ["processing", "dispatched", "delivered"])
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false }),
      supabase.from("products").select("id, name"),
    ]);
    setSales((orders as SaleRecord[]) || []);
    setProducts(prods || []);
    setLoading(false);
  };

  useEffect(() => { fetchSales(); }, [dateFrom, dateTo]);

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || "Unknown";

  const filtered = sales.filter(s => {
    const matchSearch = s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search);
    const matchPayment = !filterPayment || s.payment_method === filterPayment;
    return matchSearch && matchPayment;
  });

  const totalRevenue = filtered.reduce((s, o) => s + o.total, 0);
  const totalItems = filtered.reduce((s, o) => s + o.order_items.reduce((a, i) => a + i.quantity, 0), 0);
  const cashTotal = filtered.filter(s => s.payment_method === "cash").reduce((s, o) => s + o.total, 0);
  const momoTotal = filtered.filter(s => s.payment_method === "mobile_money").reduce((s, o) => s + o.total, 0);
  const creditTotal = filtered.filter(s => s.payment_method === "credit").reduce((s, o) => s + o.total, 0);

  // Group by date
  const groupedByDate: Record<string, SaleRecord[]> = {};
  filtered.forEach(s => {
    const d = new Date(s.created_at).toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    if (!groupedByDate[d]) groupedByDate[d] = [];
    groupedByDate[d].push(s);
  });

  const payLabel = (m: string) => m === "cash" ? "💵 Cash" : m === "mobile_money" ? "📱 MoMo" : m === "credit" ? "📝 Credit" : m;

  const printSalesReport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Sales History</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; padding: 24px; color: #111; font-size: 12px; }
        h1 { font-size: 20px; font-weight: 900; margin-bottom: 2px; }
        .period { font-size: 11px; color: #888; margin-bottom: 16px; }
        .stats { display: flex; gap: 16px; margin-bottom: 20px; }
        .stat { background: #f8f8f8; padding: 10px 14px; border-radius: 8px; flex: 1; }
        .stat-label { font-size: 10px; color: #888; text-transform: uppercase; font-weight: 700; }
        .stat-value { font-size: 16px; font-weight: 900; margin-top: 2px; }
        .date-group { margin-bottom: 16px; }
        .date-header { font-size: 11px; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0; border-bottom: 2px solid #e5e7eb; margin-bottom: 6px; }
        .sale-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
        .sale-customer { font-weight: 700; }
        .sale-total { font-weight: 800; }
        .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Marvid Pharmaceutical UG — Sales History</h1>
      <div class="period">${dateFrom} to ${dateTo} · ${filtered.length} transactions</div>
      <div class="stats">
        <div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value">UGX ${totalRevenue.toLocaleString()}</div></div>
        <div class="stat"><div class="stat-label">Cash</div><div class="stat-value">UGX ${cashTotal.toLocaleString()}</div></div>
        <div class="stat"><div class="stat-label">MoMo</div><div class="stat-value">UGX ${momoTotal.toLocaleString()}</div></div>
        <div class="stat"><div class="stat-label">Credit</div><div class="stat-value">UGX ${creditTotal.toLocaleString()}</div></div>
      </div>
      ${Object.entries(groupedByDate).map(([date, sales]) => `
        <div class="date-group">
          <div class="date-header">${date} — ${sales.length} sales · UGX ${sales.reduce((s, o) => s + o.total, 0).toLocaleString()}</div>
          ${sales.map(s => `<div class="sale-row">
            <span class="sale-customer">${s.customer_name}</span>
            <span>${s.order_items.reduce((a, i) => a + i.quantity, 0)} items · ${payLabel(s.payment_method)}</span>
            <span class="sale-total">UGX ${s.total.toLocaleString()}</span>
          </div>`).join("")}
        </div>
      `).join("")}
      <div class="footer">Generated ${new Date().toLocaleString()} — Marvid Pharmaceutical UG</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  const reprintReceipt = async (sale: SaleRecord) => {
    const settingsRaw = localStorage.getItem("marvid_receipt_settings");
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {
      businessName: "Marvid Pharmaceutical UG",
      tagline: "Your Health, Our Priority",
      address: "Kampala, Uganda",
      phone: "+256 700 000000",
      email: "info@marvid.com",
      paperWidth: "80mm",
      fontSize: "13px",
      footerNote: "Thank you for shopping with us!",
    };

    // Fetch saved prescriptions for this order
    const { data: orderRx } = await supabase
      .from("order_prescriptions")
      .select("*")
      .eq("order_id", sale.id);

    const saleDate = new Date(sale.created_at);
    const payLabel = sale.payment_method === "cash" ? "💵 Cash" : sale.payment_method === "mobile_money" ? "📱 Mobile Money" : "📝 Credit";

    const rxSection = orderRx && orderRx.length > 0 ? `
      <div style="background:#ecfdf5;border:2px solid #10b981;border-radius:8px;padding:10px 12px;margin:14px 0;">
        <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.8px;color:#065f46;margin-bottom:8px;">💊 Prescription / Dosage Instructions</div>
        ${(orderRx as any[]).map((r: any) => `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #a7f3d0;">
          <div style="font-size:12px;font-weight:800;color:#064e3b;">${getProductName(r.product_id)}</div>
          <div style="font-size:11px;color:#065f46;font-weight:600;margin-top:2px;">Condition: ${r.disease}${r.symptoms ? ` (${r.symptoms})` : ""}</div>
          <div style="font-size:11px;color:#065f46;font-weight:600;margin-top:2px;">Dosage: ${r.dosage}${r.age_range ? ` · Age: ${r.age_range}` : ""}</div>
          ${r.instructions ? `<div style="font-size:11px;color:#065f46;font-weight:600;margin-top:2px;">Instructions: ${r.instructions}</div>` : ""}
          ${r.timing_notes ? `<div style="font-size:10px;color:#047857;font-weight:700;font-style:italic;margin-top:2px;">⏰ ${r.timing_notes}</div>` : ""}
        </div>`).join("")}
      </div>
    ` : "";

    const customerPhone = sale.phone.replace(/[^0-9]/g, "");
    const whatsappMsg = encodeURIComponent(
      `Hi ${sale.customer_name}, here's your receipt from ${settings.businessName}:\n\nOrder: #${sale.id.slice(0, 8)}\nDate: ${saleDate.toLocaleString()}\n\nItems:\n${sale.order_items.map(item => `• ${getProductName(item.product_id)} ×${item.quantity} — UGX ${(item.unit_price * item.quantity).toLocaleString()}`).join("\n")}\n\nTotal: UGX ${sale.total.toLocaleString()}\nPayment: ${payLabel}\n\n${settings.footerNote}`
    );
    const whatsappUrl = `https://wa.me/${customerPhone}?text=${whatsappMsg}`;
    const qrData = encodeURIComponent(whatsappUrl);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;

    const receiptHtml = `<html><head><title>Receipt Reprint</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: ${settings.paperWidth} auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, sans-serif; font-size: ${settings.fontSize}; width: 100%; padding: 14px; color: #000; line-height: 1.6; font-weight: 700; -webkit-font-smoothing: antialiased; }
        .header { padding-bottom: 14px; border-bottom: 1px dashed #ccc; margin-bottom: 14px; }
        .header-row { display: flex; align-items: center; gap: 10px; }
        .header-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 50%; }
        .header-info { flex: 1; }
        .header h1 { font-size: 20px; font-weight: 900; color: #000; letter-spacing: 0.5px; margin: 0; }
        .header .tagline { font-size: 12px; color: #000; font-weight: 700; margin-top: 2px; }
        .header .address { font-size: 11px; color: #000; margin-top: 4px; }
        .header .contact { font-size: 11px; color: #000; margin-top: 2px; font-weight: 700; }
        .reprint-badge { text-align: center; background: #000; color: #fff; padding: 4px 8px; font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; border-radius: 4px; margin-bottom: 10px; }
        .meta { background: transparent; padding: 0; margin-bottom: 14px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
        .meta-row { display: flex; justify-content: flex-start; padding: 2px 0; }
        .meta-label { color: #000; font-weight: 700; margin-right: 4px; }
        .meta-value { font-weight: 900; color: #000; }
        .items-header { display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #000; padding: 8px 0; border-bottom: 1px dashed #000; }
        .item-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #333; font-size: 12px; }
        .item-name { flex: 1; font-weight: 800; color: #000; }
        .item-qty { width: 45px; text-align: center; color: #000; font-weight: 800; }
        .item-price { width: 90px; text-align: right; font-weight: 900; color: #000; }
        .total-section { border-top: 1px dashed #000; padding: 12px 0; margin: 14px 0; display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 14px; font-weight: 900; }
        .total-value { font-size: 18px; font-weight: 900; }
        .qr-section { text-align: center; padding: 14px 0; border-top: 2px dashed #ccc; }
        .qr-section img { margin: 0 auto; }
        .qr-section p { font-size: 9px; color: #888; margin-top: 6px; font-weight: 600; }
        .footer { text-align: center; padding-top: 14px; border-top: 1px dashed #000; }
        .footer p { font-size: 11px; color: #000; font-weight: 800; }
        .footer .powered { margin-top: 6px; font-size: 9px; color: #333; font-weight: 700; }
        .whatsapp-btn { display: inline-flex; align-items: center; gap: 6px; background: #25D366; color: white; border: none; border-radius: 24px; padding: 10px 20px; font-size: 12px; font-weight: 800; cursor: pointer; margin-top: 12px; text-decoration: none; }
        .pay-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #555; padding: 4px 0; }
        @media print { .no-print { display: none !important; } }
      </style></head><body>
        <div class="reprint-badge">⟳ RECEIPT REPRINT</div>
        <div class="header">
          <div class="header-row">
            ${settings.showLogo && settings.logoUrl ? `<img class="header-logo" src="${settings.logoUrl}" alt="Logo" />` : ''}
            <div class="header-info">
              <h1>${settings.businessName}</h1>
              <div class="tagline">${settings.tagline || ""}</div>
              <div class="address">${settings.address || ""}</div>
              <div class="contact">${settings.phone || ""}${settings.email ? " | " + settings.email : ""}</div>
            </div>
          </div>
        </div>
        <div class="meta">
          <div class="meta-row"><span class="meta-label">Receipt</span><span class="meta-value">#${sale.id.slice(0, 8).toUpperCase()}</span></div>
          <div class="meta-row"><span class="meta-label">Customer</span><span class="meta-value">${sale.customer_name}</span></div>
          <div class="meta-row"><span class="meta-label">Phone</span><span class="meta-value">${sale.phone}</span></div>
          <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${saleDate.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
          <div class="meta-row"><span class="meta-label">Payment</span><span class="meta-value">${payLabel}</span></div>
        </div>
        <div class="items-header"><span style="flex:1">Item</span><span style="width:45px;text-align:center">Qty</span><span style="width:90px;text-align:right">Amount</span></div>
        ${sale.order_items.map(item => {
          const price = item.unit_price;
          return `<div class="item-row"><span class="item-name">${getProductName(item.product_id)}</span><span class="item-qty">${item.quantity}</span><span class="item-price">UGX ${(price * item.quantity).toLocaleString()}</span></div>`;
        }).join("")}
        <div class="total-section">
          <span class="total-label">TOTAL</span>
          <span class="total-value">UGX ${sale.total.toLocaleString()}</span>
        </div>
        ${rxSection}
        ${sale.notes ? `<p style="font-size:11px;color:#000;font-weight:700;margin-bottom:10px;">📝 ${sale.notes}</p>` : ""}
        <div class="qr-section">
          <img src="${qrUrl}" alt="QR Code" width="110" height="110" />
          <p>Scan to open receipt on WhatsApp</p>
        </div>
        <div class="footer">
          <p>${settings.footerNote}</p>
          <p class="powered">Reprinted ${new Date().toLocaleString()} — Powered by TennaHub Technologies Limited</p>
          <a href="${whatsappUrl}" target="_blank" class="whatsapp-btn no-print">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send Receipt via WhatsApp
          </a>
        </div>
      </body></html>`;

    const win = window.open("", "_blank", "width=420,height=700");
    if (win) {
      win.document.write(receiptHtml);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };


  const deleteSale = async (sale: SaleRecord) => {
    if (!confirm(`Delete sale #${sale.id.slice(0, 8)} for ${sale.customer_name}? This will restore stock and remove all related records.`)) return;
    try {
      // Restore stock for each item
      for (const item of sale.order_items) {
        if (item.product_id) {
          const product = products.find(p => p.id === item.product_id);
          if (product) {
            await supabase.from("products").update({ stock: (product as any).stock + item.quantity } as any).eq("id", item.product_id);
          }
        }
      }
      // Delete related records
      await supabase.from("order_prescriptions").delete().eq("order_id", sale.id);
      await supabase.from("order_items").delete().eq("order_id", sale.id);
      await supabase.from("credit_transactions").delete().eq("order_id", sale.id);
      // Delete voucher and ledger entries
      const { data: voucher } = await supabase.from("vouchers").select("id").eq("reference_id", sale.id).maybeSingle();
      if (voucher) {
        await supabase.from("general_ledger").delete().eq("voucher_id", (voucher as any).id);
        await supabase.from("voucher_items").delete().eq("voucher_id", (voucher as any).id);
        await supabase.from("vouchers").delete().eq("id", (voucher as any).id);
      }
      await supabase.from("orders").delete().eq("id", sale.id);
      toast.success(`Sale #${sale.id.slice(0, 8)} deleted and stock restored`);
      fetchSales();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete sale");
    }
  };

  const editSaleInPOS = (sale: SaleRecord) => {
    // Store sale data in sessionStorage so POS can pick it up
    sessionStorage.setItem("pos_edit_sale", JSON.stringify(sale));
    navigate("/admin/pos");
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Sales", value: `UGX ${totalRevenue.toLocaleString()}`, icon: DollarSign, sub: `${filtered.length} transactions` },
          { label: "Items Sold", value: totalItems, icon: ShoppingBag, sub: "In period" },
          { label: "Cash", value: `UGX ${cashTotal.toLocaleString()}`, icon: DollarSign, sub: `${filtered.filter(s => s.payment_method === "cash").length} sales` },
          { label: "Mobile Money", value: `UGX ${momoTotal.toLocaleString()}`, icon: TrendingUp, sub: `${filtered.filter(s => s.payment_method === "mobile_money").length} sales` },
          { label: "Credit Sales", value: `UGX ${creditTotal.toLocaleString()}`, icon: Receipt, sub: `${filtered.filter(s => s.payment_method === "credit").length} sales` },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <s.icon className="h-3.5 w-3.5" /> {s.label}
            </div>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search sales..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">All Payments</option>
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <Button onClick={printSalesReport} variant="outline" className="gap-2 shrink-0">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* Sales grouped by date */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading sales...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No sales found for this period</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, daySales]) => {
            const dayTotal = daySales.reduce((s, o) => s + o.total, 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{date}</h3>
                    <Badge variant="secondary" className="text-[10px]">{daySales.length} sales</Badge>
                  </div>
                  <span className="text-sm font-bold text-primary">UGX {dayTotal.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {daySales.map(s => {
                    const saleTime = new Date(s.created_at).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div
                        key={s.id}
                        className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedSale(selectedSale?.id === s.id ? null : s)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-muted-foreground">#{s.id.slice(0, 8)} · {saleTime}</span>
                          <Badge variant="secondary" className="text-[10px]">{payLabel(s.payment_method)}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-accent-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{s.customer_name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.phone} · {s.district}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{s.order_items.reduce((a, i) => a + i.quantity, 0)} items</span>
                          <span className="text-sm font-bold text-primary">UGX {s.total.toLocaleString()}</span>
                        </div>

                        {/* Expanded detail */}
                        {selectedSale?.id === s.id && (
                          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                            {s.order_items.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{getProductName(item.product_id)} × {item.quantity}</span>
                                <span className="font-medium">
                                  UGX {(item.unit_price * item.quantity).toLocaleString()}
                                
                                </span>
                              </div>
                            ))}
                            {s.notes && <p className="text-[10px] text-muted-foreground italic mt-1">📝 {s.notes}</p>}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-3 gap-2 text-xs"
                              onClick={(e) => { e.stopPropagation(); reprintReceipt(s); }}
                            >
                              <Printer className="h-3.5 w-3.5" /> Reprint Receipt
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;

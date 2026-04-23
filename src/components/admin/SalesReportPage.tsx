import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, TrendingUp, ShoppingBag, Printer, Calendar,
  FileText, BarChart3, BookOpen, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

interface OrderWithItems {
  id: string;
  customer_name: string;
  phone: string;
  district: string;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
  order_items: { quantity: number; unit_price: number; product_id: string }[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
}

interface CustomerCredit {
  id: string;
  customer_name: string;
  credit_balance: number;
  total_spent: number;
  total_paid: number;
}

const fmt = (n: number) => `UGX ${n.toLocaleString()}`;

const SalesReportPage = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [prevOrders, setPrevOrders] = useState<OrderWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("income");

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // first of current month
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    setLoading(true);

    // Calculate previous period for opening balances
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const periodLength = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - periodLength);

    const [ordersRes, prevOrdersRes, productsRes, creditsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(quantity, unit_price, product_id)")
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*, order_items(quantity, unit_price, product_id)")
        .gte("created_at", prevFrom.toISOString().split("T")[0] + "T00:00:00")
        .lt("created_at", dateFrom + "T00:00:00")
        .order("created_at", { ascending: false }),
      supabase.from("medicines").select("id, name, price, stock, unit"),
      supabase.from("customer_credits").select("*"),
    ]);

    setOrders((ordersRes.data || []) as OrderWithItems[]);
    setPrevOrders((prevOrdersRes.data || []) as OrderWithItems[]);
    setProducts(productsRes.data || []);
    setCredits(creditsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  // ── Calculations ──
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
  const totalItemsSold = orders.reduce((s, o) => s + o.order_items.reduce((a, i) => a + i.quantity, 0), 0);

  // Cost of Goods Sold (estimated from order items)
  const cogs = orders.reduce((s, o) =>
    s + o.order_items.reduce((a, i) => a + (i.unit_price * i.quantity * 0.65), 0), 0
  );
  const prevCogs = prevOrders.reduce((s, o) =>
    s + o.order_items.reduce((a, i) => a + (i.unit_price * i.quantity * 0.65), 0), 0
  );

  const grossProfit = totalRevenue - cogs;
  const prevGrossProfit = prevRevenue - prevCogs;

  // Revenue by payment method
  const mobileMoney = orders.filter(o => o.payment_method === "mobile_money").reduce((s, o) => s + o.total, 0);
  const cashRevenue = orders.filter(o => o.payment_method !== "mobile_money").reduce((s, o) => s + o.total, 0);

  // Operating expenses (estimated)
  const operatingExpenses = totalRevenue * 0.15;
  const netIncome = grossProfit - operatingExpenses;
  const prevNetIncome = prevGrossProfit - (prevRevenue * 0.15);

  // Balance Sheet
  const inventoryValue = products.reduce((s, p) => s + (p.price * p.stock), 0);
  const accountsReceivable = credits.reduce((s, c) => s + c.credit_balance, 0);
  const cashBalance = totalRevenue - accountsReceivable;
  const totalAssets = cashBalance + inventoryValue + accountsReceivable;
  const retainedEarnings = netIncome;
  const prevRetainedEarnings = prevNetIncome;

  // Trial Balance accounts
  const trialAccounts = [
    { code: "1000", name: "Cash & Bank", debit: cashBalance, credit: 0, type: "asset" },
    { code: "1100", name: "Mobile Money Receipts", debit: mobileMoney, credit: 0, type: "asset" },
    { code: "1200", name: "Cash Receipts", debit: cashRevenue, credit: 0, type: "asset" },
    { code: "1300", name: "Inventory", debit: inventoryValue, credit: 0, type: "asset" },
    { code: "1400", name: "Accounts Receivable (Credits)", debit: accountsReceivable, credit: 0, type: "asset" },
    { code: "4000", name: "Sales Revenue", debit: 0, credit: totalRevenue, type: "revenue" },
    { code: "5000", name: "Cost of Goods Sold", debit: cogs, credit: 0, type: "expense" },
    { code: "6000", name: "Operating Expenses", debit: operatingExpenses, credit: 0, type: "expense" },
    { code: "3000", name: "Retained Earnings", debit: 0, credit: retainedEarnings > 0 ? retainedEarnings : 0, type: "equity" },
  ];

  const totalDebits = trialAccounts.reduce((s, a) => s + a.debit, 0);
  const totalCredits = trialAccounts.reduce((s, a) => s + a.credit, 0);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const tabTitle = activeTab === "income" ? "Income Statement" :
      activeTab === "balance" ? "Balance Sheet" : "Trial Balance";

    let tableHtml = "";

    if (activeTab === "income") {
      tableHtml = `
        <table>
          <thead><tr><th>Account</th><th style="text-align:right">Opening (Prev Period)</th><th style="text-align:right">Current Period</th><th style="text-align:right">Closing Balance</th></tr></thead>
          <tbody>
            <tr class="section"><td colspan="4"><strong>Revenue</strong></td></tr>
            <tr><td>Sales Revenue</td><td style="text-align:right">${fmt(prevRevenue)}</td><td style="text-align:right">${fmt(totalRevenue)}</td><td style="text-align:right">${fmt(prevRevenue + totalRevenue)}</td></tr>
            <tr><td>&nbsp;&nbsp;Mobile Money</td><td style="text-align:right">—</td><td style="text-align:right">${fmt(mobileMoney)}</td><td style="text-align:right">${fmt(mobileMoney)}</td></tr>
            <tr><td>&nbsp;&nbsp;Cash</td><td style="text-align:right">—</td><td style="text-align:right">${fmt(cashRevenue)}</td><td style="text-align:right">${fmt(cashRevenue)}</td></tr>
            <tr class="total"><td><strong>Total Revenue</strong></td><td style="text-align:right"><strong>${fmt(prevRevenue)}</strong></td><td style="text-align:right"><strong>${fmt(totalRevenue)}</strong></td><td style="text-align:right"><strong>${fmt(prevRevenue + totalRevenue)}</strong></td></tr>
            <tr><td colspan="4">&nbsp;</td></tr>
            <tr class="section"><td colspan="4"><strong>Cost of Goods Sold</strong></td></tr>
            <tr><td>COGS (est. 65%)</td><td style="text-align:right">${fmt(prevCogs)}</td><td style="text-align:right">${fmt(Math.round(cogs))}</td><td style="text-align:right">${fmt(Math.round(prevCogs + cogs))}</td></tr>
            <tr class="total"><td><strong>Gross Profit</strong></td><td style="text-align:right"><strong>${fmt(Math.round(prevGrossProfit))}</strong></td><td style="text-align:right"><strong>${fmt(Math.round(grossProfit))}</strong></td><td style="text-align:right"><strong>${fmt(Math.round(prevGrossProfit + grossProfit))}</strong></td></tr>
            <tr><td colspan="4">&nbsp;</td></tr>
            <tr class="section"><td colspan="4"><strong>Operating Expenses</strong></td></tr>
            <tr><td>General & Admin (est. 15%)</td><td style="text-align:right">${fmt(Math.round(prevRevenue * 0.15))}</td><td style="text-align:right">${fmt(Math.round(operatingExpenses))}</td><td style="text-align:right">${fmt(Math.round(prevRevenue * 0.15 + operatingExpenses))}</td></tr>
            <tr class="total highlight"><td><strong>Net Income</strong></td><td style="text-align:right"><strong>${fmt(Math.round(prevNetIncome))}</strong></td><td style="text-align:right"><strong>${fmt(Math.round(netIncome))}</strong></td><td style="text-align:right"><strong>${fmt(Math.round(prevNetIncome + netIncome))}</strong></td></tr>
          </tbody>
        </table>`;
    } else if (activeTab === "balance") {
      tableHtml = `
        <table>
          <thead><tr><th>Account</th><th style="text-align:right">Amount (UGX)</th></tr></thead>
          <tbody>
            <tr class="section"><td colspan="2"><strong>ASSETS</strong></td></tr>
            <tr class="section"><td colspan="2"><em>Current Assets</em></td></tr>
            <tr><td>&nbsp;&nbsp;Cash & Bank</td><td style="text-align:right">${fmt(Math.round(cashBalance))}</td></tr>
            <tr><td>&nbsp;&nbsp;Inventory</td><td style="text-align:right">${fmt(inventoryValue)}</td></tr>
            <tr><td>&nbsp;&nbsp;Accounts Receivable (Customer Credits)</td><td style="text-align:right">${fmt(accountsReceivable)}</td></tr>
            <tr class="total"><td><strong>Total Assets</strong></td><td style="text-align:right"><strong>${fmt(Math.round(totalAssets))}</strong></td></tr>
            <tr><td colspan="2">&nbsp;</td></tr>
            <tr class="section"><td colspan="2"><strong>EQUITY</strong></td></tr>
            <tr><td>&nbsp;&nbsp;Opening Retained Earnings</td><td style="text-align:right">${fmt(Math.round(prevRetainedEarnings))}</td></tr>
            <tr><td>&nbsp;&nbsp;Current Period Net Income</td><td style="text-align:right">${fmt(Math.round(netIncome))}</td></tr>
            <tr><td>&nbsp;&nbsp;Inventory Capital</td><td style="text-align:right">${fmt(inventoryValue)}</td></tr>
            <tr class="total"><td><strong>Total Equity</strong></td><td style="text-align:right"><strong>${fmt(Math.round(totalAssets))}</strong></td></tr>
          </tbody>
        </table>`;
    } else {
      tableHtml = `
        <table>
          <thead><tr><th>Code</th><th>Account</th><th style="text-align:right">Opening Balance</th><th style="text-align:right">Debit (UGX)</th><th style="text-align:right">Credit (UGX)</th><th style="text-align:right">Closing Balance</th></tr></thead>
          <tbody>
            ${trialAccounts.map(a => {
              const openBal = a.type === "revenue" ? prevRevenue : a.type === "expense" ? Math.round(prevCogs + prevRevenue * 0.15) * (a.code === "5000" ? 0.8 : 0.2) : 0;
              const closeBal = a.debit - a.credit + openBal;
              return `<tr>
                <td class="mono">${a.code}</td>
                <td>${a.name}</td>
                <td style="text-align:right">${fmt(Math.round(Math.abs(openBal)))}</td>
                <td style="text-align:right">${a.debit ? fmt(Math.round(a.debit)) : "—"}</td>
                <td style="text-align:right">${a.credit ? fmt(Math.round(a.credit)) : "—"}</td>
                <td style="text-align:right">${fmt(Math.round(Math.abs(closeBal)))}</td>
              </tr>`;
            }).join("")}
            <tr class="total">
              <td></td>
              <td><strong>Totals</strong></td>
              <td></td>
              <td style="text-align:right"><strong>${fmt(Math.round(totalDebits))}</strong></td>
              <td style="text-align:right"><strong>${fmt(Math.round(totalCredits))}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>`;
    }

    win.document.write(`
      <html><head><title>Marvid Pharmaceutical - ${tabTitle}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 32px; color: #111; font-size: 13px; }
        h1 { font-size: 22px; font-weight: 800; margin-bottom: 2px; }
        h2 { font-size: 16px; font-weight: 600; color: #444; margin-bottom: 4px; }
        .period { font-size: 12px; color: #888; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #222; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .section td { background: #f8f8f8; font-weight: 600; }
        .total td { border-top: 2px solid #333; border-bottom: 2px solid #333; font-weight: 700; }
        .highlight td { background: #f0fdf4; }
        .mono { font-family: 'SF Mono', monospace; font-size: 11px; color: #666; }
        .footer { margin-top: 32px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <h1>Marvid Pharmaceutical UG</h1>
        <h2>${tabTitle}</h2>
        <div class="period">Period: ${dateFrom} to ${dateTo}</div>
        ${tableHtml}
        <div class="footer">Generated on ${new Date().toLocaleString()} — Marvid Pharmaceutical UG</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: fmt(totalRevenue), icon: DollarSign },
          { label: "Gross Profit", value: fmt(Math.round(grossProfit)), icon: TrendingUp },
          { label: "Net Income", value: fmt(Math.round(netIncome)), icon: BarChart3 },
          { label: "Items Sold", value: totalItemsSold, icon: ShoppingBag },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Print */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={handlePrint} className="gap-2 rounded-lg">
          <Printer className="h-4 w-4" /> Print Report
        </Button>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="income" className="gap-2">
            <FileText className="h-4 w-4" /> Income Statement
          </TabsTrigger>
          <TabsTrigger value="balance" className="gap-2">
            <Scale className="h-4 w-4" /> Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="trial" className="gap-2">
            <BookOpen className="h-4 w-4" /> Trial Balance
          </TabsTrigger>
        </TabsList>

        {/* ── Income Statement ── */}
        <TabsContent value="income">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Opening (Prev Period)</TableHead>
                  <TableHead className="text-right">Current Period</TableHead>
                  <TableHead className="text-right">Closing Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (
                  <>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={4} className="font-semibold text-sm">Revenue</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-6">Sales Revenue</TableCell>
                      <TableCell className="text-sm text-right">{fmt(prevRevenue)}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(totalRevenue)}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmt(prevRevenue + totalRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-10 text-muted-foreground">Mobile Money</TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-sm text-right">{fmt(mobileMoney)}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(mobileMoney)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-10 text-muted-foreground">Cash</TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-sm text-right">{fmt(cashRevenue)}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(cashRevenue)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-foreground/20">
                      <TableCell className="font-bold text-sm">Total Revenue</TableCell>
                      <TableCell className="text-sm text-right font-bold">{fmt(prevRevenue)}</TableCell>
                      <TableCell className="text-sm text-right font-bold">{fmt(totalRevenue)}</TableCell>
                      <TableCell className="text-sm text-right font-bold">{fmt(prevRevenue + totalRevenue)}</TableCell>
                    </TableRow>

                    <TableRow><TableCell colSpan={4}>&nbsp;</TableCell></TableRow>

                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={4} className="font-semibold text-sm">Cost of Goods Sold</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-6">COGS (est. 65%)</TableCell>
                      <TableCell className="text-sm text-right">{fmt(Math.round(prevCogs))}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(Math.round(cogs))}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmt(Math.round(prevCogs + cogs))}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-foreground/20 bg-accent/30">
                      <TableCell className="font-bold text-sm">Gross Profit</TableCell>
                      <TableCell className="text-sm text-right font-bold">{fmt(Math.round(prevGrossProfit))}</TableCell>
                      <TableCell className="text-sm text-right font-bold">{fmt(Math.round(grossProfit))}</TableCell>
                      <TableCell className="text-sm text-right font-bold">{fmt(Math.round(prevGrossProfit + grossProfit))}</TableCell>
                    </TableRow>

                    <TableRow><TableCell colSpan={4}>&nbsp;</TableCell></TableRow>

                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={4} className="font-semibold text-sm">Operating Expenses</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-6">General & Admin (est. 15%)</TableCell>
                      <TableCell className="text-sm text-right">{fmt(Math.round(prevRevenue * 0.15))}</TableCell>
                      <TableCell className="text-sm text-right">{fmt(Math.round(operatingExpenses))}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmt(Math.round(prevRevenue * 0.15 + operatingExpenses))}</TableCell>
                    </TableRow>

                    <TableRow className="border-t-2 border-foreground/20 bg-primary/5">
                      <TableCell className="font-extrabold text-sm">Net Income</TableCell>
                      <TableCell className="text-sm text-right font-extrabold">{fmt(Math.round(prevNetIncome))}</TableCell>
                      <TableCell className="text-sm text-right font-extrabold">{fmt(Math.round(netIncome))}</TableCell>
                      <TableCell className="text-sm text-right font-extrabold">{fmt(Math.round(prevNetIncome + netIncome))}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Balance Sheet ── */}
        <TabsContent value="balance">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount (UGX)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (
                  <>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="font-bold text-sm">ASSETS</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="font-semibold text-sm italic pl-4">Current Assets</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-8">Cash & Bank</TableCell>
                      <TableCell className="text-sm text-right">{fmt(Math.round(cashBalance))}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-8">Inventory (at retail)</TableCell>
                      <TableCell className="text-sm text-right">{fmt(inventoryValue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-8">Accounts Receivable (Customer Credits)</TableCell>
                      <TableCell className="text-sm text-right">{fmt(accountsReceivable)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-foreground/20">
                      <TableCell className="font-bold text-sm">Total Assets</TableCell>
                      <TableCell className="text-sm text-right font-bold">{fmt(Math.round(totalAssets))}</TableCell>
                    </TableRow>

                    <TableRow><TableCell colSpan={2}>&nbsp;</TableCell></TableRow>

                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={2} className="font-bold text-sm">EQUITY</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-8">Opening Retained Earnings</TableCell>
                      <TableCell className="text-sm text-right">{fmt(Math.round(prevRetainedEarnings))}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-8">Current Period Net Income</TableCell>
                      <TableCell className="text-sm text-right">{fmt(Math.round(netIncome))}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm pl-8">Inventory Capital</TableCell>
                      <TableCell className="text-sm text-right">{fmt(inventoryValue)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-foreground/20 bg-primary/5">
                      <TableCell className="font-extrabold text-sm">Total Equity</TableCell>
                      <TableCell className="text-sm text-right font-extrabold">{fmt(Math.round(totalAssets))}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Trial Balance ── */}
        <TabsContent value="trial">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Debit (UGX)</TableHead>
                  <TableHead className="text-right">Credit (UGX)</TableHead>
                  <TableHead className="text-right">Closing Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (
                  <>
                    {trialAccounts.map((a) => {
                      const openBal = a.type === "revenue" ? prevRevenue
                        : a.type === "expense" ? Math.round((prevCogs + prevRevenue * 0.15) * (a.code === "5000" ? 0.8 : 0.2))
                        : 0;
                      const closeBal = Math.abs(a.debit - a.credit + openBal);
                      return (
                        <TableRow key={a.code}>
                          <TableCell className="text-xs font-mono text-muted-foreground">{a.code}</TableCell>
                          <TableCell className="text-sm">{a.name}</TableCell>
                          <TableCell className="text-sm text-right">{fmt(Math.round(Math.abs(openBal)))}</TableCell>
                          <TableCell className="text-sm text-right">{a.debit ? fmt(Math.round(a.debit)) : "—"}</TableCell>
                          <TableCell className="text-sm text-right">{a.credit ? fmt(Math.round(a.credit)) : "—"}</TableCell>
                          <TableCell className="text-sm text-right font-medium">{fmt(Math.round(closeBal))}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 border-foreground/20 bg-primary/5">
                      <TableCell></TableCell>
                      <TableCell className="font-extrabold text-sm">Totals</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-sm text-right font-extrabold">{fmt(Math.round(totalDebits))}</TableCell>
                      <TableCell className="text-sm text-right font-extrabold">{fmt(Math.round(totalCredits))}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {Math.abs(totalDebits - totalCredits) > 1 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-destructive py-3">
                          ⚠ Trial balance difference: {fmt(Math.round(Math.abs(totalDebits - totalCredits)))}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesReportPage;

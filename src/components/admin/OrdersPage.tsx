import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, CheckCircle, Truck, Clock, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  district: string;
  address: string;
  total: number;
  status: string;
  payment_method: string;
  payment_phone: string | null;
  notes: string | null;
  created_at: string;
  order_items: { quantity: number; unit_price: number; product_id: string; products?: { name: string } }[];
}

const STATUS_FLOW = ["pending", "processing", "dispatched", "delivered"];

const statusColor = (s: string) => {
  switch (s) {
    case "pending": return "bg-warning/10 text-warning";
    case "processing": return "bg-primary/10 text-primary";
    case "dispatched": return "bg-accent text-accent-foreground";
    case "delivered": return "bg-success/10 text-success";
    default: return "bg-muted text-muted-foreground";
  }
};

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(quantity, unit_price, product_id)")
      .order("created_at", { ascending: false });
    setOrders((data || []) as Order[]);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Order updated to ${newStatus}`);
    fetchOrders();
    if (selected?.id === id) setSelected({ ...selected, status: newStatus });
  };

  const nextStatus = (current: string) => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const filtered = orders.filter((o) => {
    const matchSearch = o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openDetail = (o: Order) => {
    setSelected(o);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATUS_FLOW.map((s) => (
          <div
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            className={`bg-card rounded-xl border border-border p-4 cursor-pointer transition-colors ${filterStatus === s ? "ring-2 ring-primary" : ""}`}
          >
            <p className="text-sm text-muted-foreground capitalize">{s}</p>
            <p className="text-2xl font-bold">{orders.filter(o => o.status === s).length}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {filterStatus && (
          <Button variant="ghost" size="sm" onClick={() => setFilterStatus("")}>Clear filter</Button>
        )}
      </div>

      {/* Order Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">No orders found</p>
        ) : filtered.map((o) => (
          <div key={o.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(o)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-muted-foreground">#{o.id.slice(0, 8)}</span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(o.status)}`}>{o.status}</span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="font-medium text-sm">{o.customer_name}</p>
                <p className="text-xs text-muted-foreground">{o.phone} · {o.district}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{o.order_items.reduce((a, i) => a + i.quantity, 0)} items · {o.payment_method === "mobile_money" ? "MoMo" : "COD"}</span>
                <span className="text-sm font-bold text-primary">UGX {o.total.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            {nextStatus(o.status) && (
              <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={(e) => { e.stopPropagation(); updateStatus(o.id, nextStatus(o.status)!); }}>
                {nextStatus(o.status) === "processing" && <CheckCircle className="h-3 w-3 mr-1" />}
                {nextStatus(o.status) === "dispatched" && <Truck className="h-3 w-3 mr-1" />}
                {nextStatus(o.status) === "delivered" && <Package className="h-3 w-3 mr-1" />}
                Move to {nextStatus(o.status)}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Customer</p><p className="font-medium">{selected.customer_name}</p></div>
                <div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{selected.phone}</p></div>
                <div><p className="text-muted-foreground text-xs">District</p><p className="font-medium">{selected.district}</p></div>
                <div><p className="text-muted-foreground text-xs">Payment</p><p className="font-medium">{selected.payment_method === "mobile_money" ? "Mobile Money" : "COD"}</p></div>
              </div>
              <div><p className="text-muted-foreground text-xs">Address</p><p>{selected.address}</p></div>
              {selected.notes && <div><p className="text-muted-foreground text-xs">Notes</p><p>{selected.notes}</p></div>}
              <div className="border-t border-border pt-3">
                <p className="font-medium mb-2">Items</p>
                {selected.order_items.map((item, i) => (
                  <div key={i} className="flex justify-between py-1">
                    <span>Product × {item.quantity}</span>
                    <span className="font-medium">UGX {(item.unit_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>UGX {selected.total.toLocaleString()}</span>
                </div>
              </div>
              {nextStatus(selected.status) && (
                <Button className="w-full gap-2" onClick={() => updateStatus(selected.id, nextStatus(selected.status)!)}>
                  Move to {nextStatus(selected.status)}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;

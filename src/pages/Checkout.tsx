import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, MapPin, CreditCard, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

const UGANDAN_DISTRICTS = [
  "Kampala", "Wakiso", "Mukono", "Jinja", "Mbale", "Gulu", "Lira", "Mbarara",
  "Kabale", "Fort Portal", "Masaka", "Entebbe", "Arua", "Soroti", "Tororo",
  "Iganga", "Mityana", "Lugazi", "Hoima", "Masindi", "Kasese", "Ntungamo",
  "Bushenyi", "Pallisa", "Busia", "Kabalore", "Mpigi", "Luwero", "Kayunga",
  "Nakasongola", "Kiboga", "Kibaale", "Bundibugyo", "Kabarole", "Rukungiri"
].sort();

const steps = [
  { label: "Details", icon: User },
  { label: "Delivery", icon: MapPin },
  { label: "Payment", icon: CreditCard },
];

const Checkout = () => {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    district: "",
    address: "",
    paymentMethod: "mobile_money" as "mobile_money" | "cash_on_delivery",
    paymentPhone: "",
    notes: "",
  });

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Your cart is empty</p>
            <Button onClick={() => navigate("/")} className="rounded-full">Continue Shopping</Button>
          </div>
        </div>
      </div>
    );
  }

  const canProceed = () => {
    if (step === 0) return form.customerName && form.phone;
    if (step === 1) return form.district && form.address;
    if (step === 2) return form.paymentMethod === "cash_on_delivery" || form.paymentPhone;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          customer_name: form.customerName,
          phone: form.phone,
          district: form.district,
          address: form.address,
          payment_method: form.paymentMethod,
          payment_phone: form.paymentPhone || null,
          notes: form.notes || null,
          total,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      // FEFO batch deduction
      for (const item of items) {
        let remaining = item.quantity;
        const { data: batches } = await supabase
          .from("product_batches")
          .select("*")
          .eq("product_id", item.id)
          .gt("quantity", 0)
          .order("expiry_date", { ascending: true });

        if (batches && batches.length > 0) {
          for (const batch of batches as any[]) {
            if (remaining <= 0) break;
            if (new Date(batch.expiry_date) < new Date()) continue; // Skip expired
            const deduct = Math.min(remaining, batch.quantity);
            await supabase.from("product_batches").update({ quantity: batch.quantity - deduct } as any).eq("id", batch.id);
            remaining -= deduct;
          }
        }
      }

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      clearCart();
      toast.success("Order placed successfully! We'll contact you shortly.");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Navbar />
      <div className="container max-w-2xl py-8">
        {/* Stepper */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${i < step ? "bg-success" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold mb-4">Your Details</h2>
                <div>
                  <label className="text-sm font-medium mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => updateForm("customerName", e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Jane Nakamya"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. +256 700 000 000"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Order Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateForm("notes", e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={3}
                    placeholder="Any special instructions..."
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold mb-4">Delivery Address</h2>
                <div>
                  <label className="text-sm font-medium mb-1 block">District</label>
                  <select
                    value={form.district}
                    onChange={(e) => updateForm("district", e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    <option value="">Select district...</option>
                    {UGANDAN_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Street Address / Landmark</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={3}
                    placeholder="e.g. Plot 12, Lumumba Avenue, near Clock Tower"
                    required
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold mb-4">Payment Method</h2>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                    form.paymentMethod === "mobile_money" ? "border-primary bg-accent" : "border-border"
                  }`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={form.paymentMethod === "mobile_money"}
                      onChange={() => updateForm("paymentMethod", "mobile_money")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="font-medium text-sm">Mobile Money</p>
                      <p className="text-xs text-muted-foreground">MTN MoMo / Airtel Money</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                    form.paymentMethod === "cash_on_delivery" ? "border-primary bg-accent" : "border-border"
                  }`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={form.paymentMethod === "cash_on_delivery"}
                      onChange={() => updateForm("paymentMethod", "cash_on_delivery")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="font-medium text-sm">Cash on Delivery</p>
                      <p className="text-xs text-muted-foreground">Pay when you receive your order</p>
                    </div>
                  </label>
                </div>
                {form.paymentMethod === "mobile_money" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Mobile Money Number</label>
                    <input
                      type="tel"
                      value={form.paymentPhone}
                      onChange={(e) => updateForm("paymentPhone", e.target.value)}
                      className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g. 0770 000 000"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">You'll receive a payment prompt on this number</p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => step > 0 ? setStep(step - 1) : navigate("/")}
                className="rounded-full gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Shop" : "Back"}
              </Button>
              {step < 2 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="rounded-full gap-2"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || submitting}
                  className="rounded-full gap-2"
                >
                  {submitting ? "Placing Order..." : "Place Order"} <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-card rounded-2xl border border-border p-5 h-fit">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                  <span className="font-medium">UGX {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span>UGX {total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Printer, X, User, ScanBarcode, Wallet, Edit3, CalendarIcon, Pill, Keyboard, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  price: number;
  wholesale_price: number;
  buying_price: number;
  stock: number;
  unit: string;
  pieces_per_unit: number;
  unit_description: string | null;
  requires_prescription: boolean;
  category_id: string | null;
  product_code: string | null;
  expiry_date: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  customPrice: number | null;
  sellingByPiece: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CustomerSuggestion {
  customer_name: string;
  customer_phone: string;
  credit_balance: number;
  customer_type: string;
}

const DISTRICTS = [
  "Kampala", "Wakiso", "Mukono", "Jinja", "Mbarara", "Gulu", "Lira",
  "Mbale", "Fort Portal", "Masaka", "Entebbe", "Arua", "Soroti", "Kabale",
];

const POSPage = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [tempQty, setTempQty] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [qtyBuffer, setQtyBuffer] = useState("");
  const qtyBufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAddedIdRef = useRef<string | null>(null);
  const [amountGiven, setAmountGiven] = useState("");
  const amountGivenRef = useRef<HTMLInputElement>(null);
  const lastReceiptRef = useRef<(() => void) | null>(null);
  const [pastReceiptsOpen, setPastReceiptsOpen] = useState(false);
  const [pastReceiptsSearch, setPastReceiptsSearch] = useState("");
  const [pastReceipts, setPastReceipts] = useState<any[]>([]);
  const [pastReceiptsLoading, setPastReceiptsLoading] = useState(false);
  const pastReceiptsSearchRef = useRef<HTMLInputElement>(null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCreditBalance, setSelectedCreditBalance] = useState<number | null>(null);
  const [applyCreditAmount, setApplyCreditAmount] = useState("");
  const [lastPaymentInfo, setLastPaymentInfo] = useState<{ amount: number; date: string } | null>(null);
  const [customerType, setCustomerType] = useState<"retail" | "wholesale">("retail");

  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saleTime, setSaleTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  const [customer, setCustomer] = useState({
    name: "", phone: "", address: "", district: "Kampala",
    payment_method: "cash", payment_phone: "", notes: "",
  });

  interface PrescriptionRule {
    id: string; product_id: string; disease: string; symptoms: string | null;
    dosage: string; instructions: string | null; timing_notes: string | null;
    age_min: number | null; age_max: number | null;
  }
  interface SelectedPrescription { rule: PrescriptionRule; customTiming: string; }
  const [availableRules, setAvailableRules] = useState<Record<string, PrescriptionRule[]>>({});
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<Record<string, SelectedPrescription>>({});
  const [doctorLicense, setDoctorLicense] = useState("");

  // Past receipts search
  useEffect(() => {
    if (!pastReceiptsOpen) return;
    const searchPast = async () => {
      setPastReceiptsLoading(true);
      let query = supabase.from("orders").select("id, customer_name, phone, total, created_at, status, payment_method").order("created_at", { ascending: false }).limit(20);
      if (pastReceiptsSearch.length >= 2) {
        query = query.or(`customer_name.ilike.%${pastReceiptsSearch}%,phone.ilike.%${pastReceiptsSearch}%,id.ilike.%${pastReceiptsSearch}%`);
      }
      const { data } = await query;
      setPastReceipts(data || []);
      setPastReceiptsLoading(false);
    };
    const timer = setTimeout(searchPast, 300);
    return () => clearTimeout(timer);
  }, [pastReceiptsOpen, pastReceiptsSearch]);

  useEffect(() => {
    const rxProductIds = cart.filter(i => i.product.requires_prescription).map(i => i.product.id);
    if (rxProductIds.length === 0) { setAvailableRules({}); return; }
    const fetchRules = async () => {
      const { data } = await supabase.from("prescription_rules").select("*").in("product_id", rxProductIds);
      const grouped: Record<string, PrescriptionRule[]> = {};
      (data || []).forEach((r: any) => {
        if (!grouped[r.product_id]) grouped[r.product_id] = [];
        grouped[r.product_id].push(r as PrescriptionRule);
      });
      setAvailableRules(grouped);
    };
    fetchRules();
  }, [cart]);

  const selectPrescriptionRule = (productId: string, rule: PrescriptionRule) => {
    setSelectedPrescriptions(prev => ({ ...prev, [productId]: { rule, customTiming: rule.timing_notes || "" } }));
  };
  const updatePrescriptionTiming = (productId: string, timing: string) => {
    setSelectedPrescriptions(prev => ({ ...prev, [productId]: { ...prev[productId], customTiming: timing } }));
  };
  const removePrescription = (productId: string) => {
    setSelectedPrescriptions(prev => { const next = { ...prev }; delete next[productId]; return next; });
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from("products").select("id, name, price, wholesale_price, buying_price, stock, unit, pieces_per_unit, unit_description, requires_prescription, category_id, product_code, expiry_date").eq("is_active", true).order("name"),
        supabase.from("categories").select("*").order("name"),
      ]);
      setProducts((prods as Product[]) || []);
      setCategories(cats || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Customer lookup
  useEffect(() => {
    const searchCustomers = async () => {
      if (customerSearch.length < 2) { setCustomerSuggestions([]); return; }
      const { data } = await supabase
        .from("customer_credits")
        .select("customer_name, customer_phone, credit_balance, customer_type")
        .or(`customer_name.ilike.%${customerSearch}%,customer_phone.ilike.%${customerSearch}%`)
        .limit(5);
      setCustomerSuggestions((data as CustomerSuggestion[]) || []);
      setShowSuggestions(true);
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const selectCustomer = async (c: CustomerSuggestion) => {
    setCustomer(prev => ({ ...prev, name: c.customer_name, phone: c.customer_phone }));
    setCustomerSearch("");
    setShowSuggestions(false);
    setSelectedCreditBalance(c.credit_balance);
    setCustomerType((c.customer_type as "retail" | "wholesale") || "retail");
    setApplyCreditAmount("");

    const { data: creditAccount } = await supabase
      .from("customer_credits")
      .select("id")
      .eq("customer_phone", c.customer_phone)
      .maybeSingle();

    if (creditAccount) {
      const { data: lastPayment } = await supabase
        .from("credit_transactions")
        .select("amount, created_at")
        .eq("customer_credit_id", (creditAccount as any).id)
        .eq("type", "payment")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastPayment) {
        setLastPaymentInfo({ amount: (lastPayment as any).amount, date: (lastPayment as any).created_at });
      } else {
        setLastPaymentInfo(null);
      }
    } else {
      setLastPaymentInfo(null);
    }
  };

  const getEffectivePrice = (product: Product, customPrice: number | null, sellingByPiece: boolean = false) => {
    if (customPrice !== null) return customPrice;
    const basePrice = customerType === "wholesale" && product.wholesale_price > 0 ? product.wholesale_price : product.price;
    if (sellingByPiece && product.pieces_per_unit > 1) return Math.round(basePrice / product.pieces_per_unit);
    return basePrice;
  };

  const filtered = useMemo(() => products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    return matchSearch && matchCat && p.stock > 0;
  }), [products, search, selectedCategory]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedProductIndex(-1);
  }, [filtered.length, search, selectedCategory]);

  const addToCart = useCallback((product: Product, qty: number = 1, byPiece: boolean = false) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && i.sellingByPiece === byPiece);
      const maxQty = byPiece ? product.stock * (product.pieces_per_unit || 1) : product.stock;
      // Also account for existing cart items of the OTHER selling mode
      const otherItem = prev.find((i) => i.product.id === product.id && i.sellingByPiece !== byPiece);
      const otherStockUsed = otherItem
        ? (otherItem.sellingByPiece ? otherItem.quantity / (product.pieces_per_unit || 1) : otherItem.quantity)
        : 0;
      const availableStock = product.stock - otherStockUsed;
      const availableQty = byPiece ? availableStock * (product.pieces_per_unit || 1) : availableStock;

      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > availableQty) {
          toast.error("Not enough stock");
          return prev;
        }
        return prev.map((i) => (i.product.id === product.id && i.sellingByPiece === byPiece) ? { ...i, quantity: newQty } : i);
      }
      if (qty > availableQty) {
        toast.error("Not enough stock");
        return prev;
      }
      return [...prev, { product, quantity: qty, customPrice: null, sellingByPiece: byPiece }];
    });
  }, []);

  const handleBarcodeScan = () => {
    const code = barcodeInput.trim();
    if (!code) return;
    const product = products.find((p) => p.product_code?.toLowerCase() === code.toLowerCase());
    if (product) {
      if (product.stock <= 0) {
        toast.error(`${product.name} is out of stock`);
      } else {
        addToCart(product);
        toast.success(`Added ${product.name}`);
      }
    } else {
      toast.error(`No product found with code "${code}"`);
    }
    setBarcodeInput("");
    barcodeRef.current?.focus();
  };

  const updateQty = (productId: string, delta: number, byPiece?: boolean) => {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== productId) return i;
      if (byPiece !== undefined && i.sellingByPiece !== byPiece) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      const maxQty = i.sellingByPiece ? i.product.stock * (i.product.pieces_per_unit || 1) : i.product.stock;
      if (newQty > maxQty) { toast.error("Not enough stock"); return i; }
      return { ...i, quantity: newQty };
    }));
  };

  const setExactQty = (productId: string, qty: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== productId) return i;
      if (qty <= 0) return i;
      const maxQty = i.sellingByPiece ? i.product.stock * (i.product.pieces_per_unit || 1) : i.product.stock;
      if (qty > maxQty) { toast.error("Not enough stock"); return i; }
      return { ...i, quantity: qty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const setCustomPrice = (productId: string, price: number | null) => {
    setCart((prev) => prev.map((i) =>
      i.product.id === productId ? { ...i, customPrice: price } : i
    ));
  };

  const total = cart.reduce((s, i) => s + getEffectivePrice(i.product, i.customPrice, i.sellingByPiece) * i.quantity, 0);
  const creditToApply = Math.min(
    Math.max(0, parseFloat(applyCreditAmount) || 0),
    selectedCreditBalance ?? 0,
    total
  );
  const amountDue = total - creditToApply;
  const isBackdated = saleDate !== new Date().toISOString().split("T")[0];

  // Helper: add to cart and track last added
  const addToCartTracked = useCallback((product: Product, qty: number = 1) => {
    addToCart(product, qty);
    lastAddedIdRef.current = product.id;
    setQtyBuffer("");
  }, [addToCart]);

  // ===== KEYBOARD SHORTCUTS =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      // F1 - Focus search
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      // F2 - Focus barcode
      if (e.key === "F2") {
        e.preventDefault();
        barcodeRef.current?.focus();
        return;
      }
      // F8 - Open checkout
      if (e.key === "F8" && cart.length > 0) {
        e.preventDefault();
        setCheckoutOpen(true);
        return;
      }
      // F9 - Complete sale (when checkout is open)
      if (e.key === "F9" && checkoutOpen) {
        e.preventDefault();
        if (!submitting && customer.name && customer.phone) {
          handleCheckout();
        }
        return;
      }
      // Escape - Close modals
      if (e.key === "Escape") {
        if (pastReceiptsOpen) { setPastReceiptsOpen(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (checkoutOpen) { setCheckoutOpen(false); return; }
        if (editingPriceId) { setEditingPriceId(null); return; }
        if (editingQtyId) { setEditingQtyId(null); return; }
        if (qtyBuffer) { setQtyBuffer(""); return; }
        return;
      }
      // F10 - Toggle shortcuts help
      if (e.key === "F10") {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }
      // F3 - Clear cart
      if (e.key === "F3" && cart.length > 0 && !checkoutOpen) {
        e.preventDefault();
        setCart([]);
        toast.success("Cart cleared");
        return;
      }
      // Alt+Space - Open past receipts search
      if (e.altKey && e.key === " ") {
        e.preventDefault();
        setPastReceiptsOpen(true);
        setPastReceiptsSearch("");
        setTimeout(() => pastReceiptsSearchRef.current?.focus(), 100);
      }
      // F5 - Reprint last receipt
      if (e.key === "F5") {
        e.preventDefault();
        if (lastReceiptRef.current) {
          lastReceiptRef.current();
          toast.success("Reprinting last receipt...");
        } else {
          toast.error("No recent receipt to reprint");
        }
        return;
      }
      // F4 - Toggle wholesale/retail
      if (e.key === "F4" && !checkoutOpen) {
        e.preventDefault();
        setCustomerType(prev => prev === "retail" ? "wholesale" : "retail");
        toast.success(`Switched to ${customerType === "retail" ? "Wholesale" : "Retail"}`);
        return;
      }

      // F12 - Open custom price for selected/last-added product
      if (e.key === "F12") {
        e.preventDefault();
        if (cart.length > 0) {
          const targetId = lastAddedIdRef.current || cart[cart.length - 1].product.id;
          const targetItem = cart.find(i => i.product.id === targetId);
          if (targetItem) {
            const cartKey = `${targetId}-${targetItem.sellingByPiece ? 'pc' : 'pk'}`;
            const effectivePrice = getEffectivePrice(targetItem.product, targetItem.customPrice, targetItem.sellingByPiece);
            setEditingPriceId(cartKey);
            setTempPrice(String(effectivePrice));
            toast.info(`Set custom price for ${targetItem.product.name}`);
          }
        }
        return;
      }

      // F1 in checkout - Focus amount given field
      if (e.key === "F1" && checkoutOpen) {
        e.preventDefault();
        amountGivenRef.current?.focus();
        return;
      }

      // === SPEED MODE: When not in any input field ===
      if (!isInput && !checkoutOpen) {
        // Space - Focus search
        if (e.key === " ") {
          e.preventDefault();
          searchRef.current?.focus();
          return;
        }

        // Tab - Navigate through products
        if (e.key === "Tab") {
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedProductIndex(prev => Math.max(prev - 1, 0));
          } else {
            setSelectedProductIndex(prev => {
              if (prev < 0) return 0;
              return Math.min(prev + 1, filtered.length - 1);
            });
          }
          return;
        }

        // Enter - Add selected product to cart OR open checkout if cart has items and no product selected
        if (e.key === "Enter") {
          e.preventDefault();
          if (selectedProductIndex >= 0 && selectedProductIndex < filtered.length) {
            addToCartTracked(filtered[selectedProductIndex]);
            toast.success(`Added ${filtered[selectedProductIndex].name}`);
            setSelectedProductIndex(-1);
          } else if (cart.length > 0) {
            setCheckoutOpen(true);
          }
          return;
        }

        // P - Add selected product by piece
        if (e.key === "p" || e.key === "P") {
          if (selectedProductIndex >= 0 && selectedProductIndex < filtered.length) {
            const p = filtered[selectedProductIndex];
            if (p.pieces_per_unit > 1) {
              e.preventDefault();
              addToCart(p, 1, true);
              lastAddedIdRef.current = p.id;
              toast.success(`Added 1 piece of ${p.name}`);
              setSelectedProductIndex(-1);
            }
          }
          return;
        }

        // Number keys (0-9) - Type quantity for last added cart item
        if (e.key >= "0" && e.key <= "9" && cart.length > 0) {
          e.preventDefault();
          const targetId = lastAddedIdRef.current || cart[cart.length - 1].product.id;
          const newBuffer = qtyBuffer + e.key;
          setQtyBuffer(newBuffer);
          const qty = parseInt(newBuffer);
          if (qty > 0) {
            setExactQty(targetId, qty);
          }
          // Auto-clear buffer after 1.5s of no typing
          if (qtyBufferTimeoutRef.current) clearTimeout(qtyBufferTimeoutRef.current);
          qtyBufferTimeoutRef.current = setTimeout(() => setQtyBuffer(""), 1500);
          return;
        }

        // Backspace - Remove last digit from qty buffer
        if (e.key === "Backspace" && qtyBuffer) {
          e.preventDefault();
          const newBuffer = qtyBuffer.slice(0, -1);
          setQtyBuffer(newBuffer);
          if (newBuffer) {
            const targetId = lastAddedIdRef.current || cart[cart.length - 1].product.id;
            setExactQty(targetId, parseInt(newBuffer));
          }
          return;
        }

        // Delete - Remove last cart item
        if (e.key === "Delete" && cart.length > 0) {
          e.preventDefault();
          const lastItem = cart[cart.length - 1];
          removeFromCart(lastItem.product.id);
          toast.success(`Removed ${lastItem.product.name}`);
          return;
        }

        // Alt+1 through Alt+9 - Quick add from filtered list
        if (e.altKey && e.key >= "1" && e.key <= "9") {
          e.preventDefault();
          const idx = parseInt(e.key) - 1;
          if (idx < filtered.length) {
            addToCartTracked(filtered[idx]);
            toast.success(`Added ${filtered[idx].name}`);
          }
          return;
        }
      }

      // When search is focused, arrow keys / Tab navigate products
      if (isInput && target === searchRef.current) {
        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          setSelectedProductIndex(prev => Math.min(prev + 1, filtered.length - 1));
          return;
        }
        if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
          e.preventDefault();
          setSelectedProductIndex(prev => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === "Enter" && selectedProductIndex >= 0 && selectedProductIndex < filtered.length) {
          e.preventDefault();
          addToCartTracked(filtered[selectedProductIndex]);
          toast.success(`Added ${filtered[selectedProductIndex].name}`);
          setSearch("");
          searchRef.current?.blur();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, checkoutOpen, submitting, customer, filtered, selectedProductIndex, showShortcuts, editingPriceId, editingQtyId, customerType, addToCartTracked, qtyBuffer, pastReceiptsOpen]);

  const loadPastReceipt = async (orderId: string) => {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity, unit_price")
      .eq("order_id", orderId);
    if (!orderItems || orderItems.length === 0) {
      toast.error("No items found in this receipt");
      return;
    }
    const productIds = orderItems.map((i: any) => i.product_id).filter(Boolean);
    const matchedProducts = products.filter(p => productIds.includes(p.id));
    if (matchedProducts.length === 0) {
      toast.error("Products from this receipt are no longer available");
      return;
    }
    setCart([]);
    for (const item of orderItems) {
      const prod = matchedProducts.find(p => p.id === item.product_id);
      if (prod) {
        const qty = Math.min(item.quantity, prod.stock);
        if (qty > 0) {
          setCart(prev => [...prev, { product: prod, quantity: qty, customPrice: null, sellingByPiece: false }]);
        }
      }
    }
    // Also load customer info from the order
    const { data: order } = await supabase.from("orders").select("customer_name, phone, address, district, payment_method").eq("id", orderId).single();
    if (order) {
      setCustomer(prev => ({ ...prev, name: order.customer_name, phone: order.phone, address: order.address || "", district: order.district || "Kampala", payment_method: order.payment_method || "cash" }));
      setCustomerSearch("");
    }
    // Increment reuse counter
    const { data: reuseOrder } = await supabase.from("orders").select("reuse_count").eq("id", orderId).single();
    const reuseCount = ((reuseOrder as any)?.reuse_count || 0) + 1;
    await supabase.from("orders").update({ reuse_count: reuseCount } as any).eq("id", orderId);
    setPastReceiptsOpen(false);
    toast.success(`Receipt loaded into cart (reused ${reuseCount}x) — review and checkout`);
  };

  const handleCheckout = async () => {
    if (!customer.name || !customer.phone) {
      toast.error("Customer name and phone are required");
      return;
    }
    if (cart.length === 0) return;

    const hasControlled = cart.some(i => i.product.requires_prescription);
    if (hasControlled && !doctorLicense.trim()) {
      toast.error("Doctor's License Number is required for prescription items");
      return;
    }

    setSubmitting(true);
    try {
      const saleDatetime = new Date(`${saleDate}T${saleTime}:00`).toISOString();

      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        user_id: user!.id,
        customer_name: customer.name,
        phone: customer.phone,
        address: customer.address || "Walk-in",
        district: customer.district,
        payment_method: customer.payment_method,
        payment_phone: customer.payment_phone || null,
        notes: customer.notes ? `${customer.notes}${creditToApply > 0 ? ` | Credit applied: UGX ${creditToApply.toLocaleString()}` : ""}${isBackdated ? ` | Backdated sale` : ""}` : (creditToApply > 0 ? `Credit applied: UGX ${creditToApply.toLocaleString()}` : (isBackdated ? "Backdated sale" : null)),
        total,
        status: "processing",
        created_at: saleDatetime,
      } as any).select().single();

      if (orderErr) throw orderErr;

      const items = cart.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.product.price,
        custom_unit_price: i.customPrice !== null ? i.customPrice : (customerType === "wholesale" && i.product.wholesale_price > 0 ? i.product.wholesale_price : null),
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(items as any);
      if (itemsErr) throw itemsErr;

      // FEFO batch deduction - aggregate stock usage per product
      const stockDeductions: Record<string, number> = {};
      for (const i of cart) {
        const stockUsed = i.sellingByPiece ? i.quantity / (i.product.pieces_per_unit || 1) : i.quantity;
        stockDeductions[i.product.id] = (stockDeductions[i.product.id] || 0) + stockUsed;
      }

      for (const [productId, totalDeduction] of Object.entries(stockDeductions)) {
        const cartItem = cart.find(i => i.product.id === productId)!;
        let remaining = totalDeduction;
        const { data: batches } = await supabase
          .from("product_batches")
          .select("*")
          .eq("product_id", productId)
          .gt("quantity", 0)
          .order("expiry_date", { ascending: true });

        if (batches && batches.length > 0) {
          for (const batch of batches) {
            if (remaining <= 0) break;
            const batchExpiry = new Date((batch as any).expiry_date);
            if (batchExpiry < new Date()) continue;
            const deduct = Math.min(remaining, (batch as any).quantity);
            await supabase.from("product_batches").update({
              quantity: (batch as any).quantity - deduct,
            } as any).eq("id", (batch as any).id);
            remaining -= deduct;
          }
        }
        await supabase.from("products").update({ stock: cartItem.product.stock - totalDeduction }).eq("id", productId);
      }

      // Upsert customer credit
      const { data: existingCredit } = await supabase
        .from("customer_credits")
        .select("*")
        .eq("customer_phone", customer.phone)
        .maybeSingle();

      if (existingCredit) {
        const isCreditPayment = customer.payment_method === "credit";
        const newSpent = (existingCredit as any).total_spent + total;
        const cashPaid = isCreditPayment ? 0 : amountDue;
        const newPaid = (existingCredit as any).total_paid + creditToApply + cashPaid;
        const newBalance = newSpent - newPaid;
        const prevPurchases = (existingCredit as any).total_purchases || 0;
        await supabase.from("customer_credits").update({
          total_spent: newSpent,
          total_paid: newPaid,
          credit_balance: newBalance,
          customer_name: customer.name,
          customer_type: customerType,
          total_purchases: prevPurchases + 1,
          last_purchase_date: saleDatetime,
        } as any).eq("id", (existingCredit as any).id);

        await supabase.from("credit_transactions").insert({
          customer_credit_id: (existingCredit as any).id,
          type: "purchase",
          amount: total,
          description: `POS Sale #${order.id.slice(0, 8)} - ${cart.length} items${customerType === "wholesale" ? " (Wholesale)" : ""}${isBackdated ? ` [Backdated: ${saleDate}]` : ""}`,
          order_id: order.id,
        } as any);

        if (creditToApply > 0) {
          await supabase.from("credit_transactions").insert({
            customer_credit_id: (existingCredit as any).id,
            type: "payment",
            amount: creditToApply,
            description: `Credit applied to order #${order.id.slice(0, 8)}`,
            order_id: order.id,
          } as any);
        }
      } else {
        const isCreditPayment = customer.payment_method === "credit";
        const paid = creditToApply + (isCreditPayment ? 0 : amountDue);
        const { data: newCredit } = await supabase.from("customer_credits").insert({
          customer_phone: customer.phone,
          customer_name: customer.name,
          total_spent: total,
          credit_balance: total - paid,
          total_paid: paid,
          customer_type: customerType,
          total_purchases: 1,
          last_purchase_date: saleDatetime,
        } as any).select().single();

        if (newCredit) {
          await supabase.from("credit_transactions").insert({
            customer_credit_id: (newCredit as any).id,
            type: "purchase",
            amount: total,
            description: `POS Sale #${order.id.slice(0, 8)} - ${cart.length} items`,
            order_id: order.id,
          } as any);
        }
      }

      const prescriptionInserts = Object.entries(selectedPrescriptions).map(([productId, sp]) => ({
        order_id: order.id,
        product_id: productId,
        disease: sp.rule.disease,
        symptoms: sp.rule.symptoms || null,
        dosage: sp.rule.dosage,
        instructions: sp.rule.instructions || null,
        timing_notes: sp.customTiming || sp.rule.timing_notes || null,
        age_range: (sp.rule.age_min || sp.rule.age_max) ? `${sp.rule.age_min || 0}–${sp.rule.age_max || '120+'}` : null,
      }));
      if (prescriptionInserts.length > 0) {
        await supabase.from("order_prescriptions").insert(prescriptionInserts as any);
      }

      const prescriptionRules: Record<string, any[]> = {};
      Object.entries(selectedPrescriptions).forEach(([productId, sp]) => {
        prescriptionRules[productId] = [{ ...sp.rule, timing_notes: sp.customTiming || sp.rule.timing_notes }];
      });

      try {
        const voucherNumber = `SV-${order.id.slice(0, 8).toUpperCase()}`;
        const { data: voucher } = await supabase.from("vouchers").insert({
          voucher_number: voucherNumber,
          voucher_type: "sales",
          party_name: customer.name,
          party_phone: customer.phone,
          narration: `POS Sale - ${cart.length} items`,
          total_amount: total,
          reference_id: order.id,
          created_by: user!.id,
          voucher_date: saleDatetime,
        } as any).select().single();

        if (voucher) {
          await supabase.from("general_ledger").insert([
            { voucher_id: (voucher as any).id, account_name: "Cash/Bank", account_type: "asset", debit: amountDue, credit: 0, narration: `Sale to ${customer.name}`, entry_date: saleDatetime },
            { voucher_id: (voucher as any).id, account_name: "Sales Revenue", account_type: "income", debit: 0, credit: total, narration: `Sale to ${customer.name}`, entry_date: saleDatetime },
            ...(creditToApply > 0 ? [{ voucher_id: (voucher as any).id, account_name: "Accounts Receivable", account_type: "asset", debit: 0, credit: creditToApply, narration: `Credit applied`, entry_date: saleDatetime }] : []),
            ...(customer.payment_method === "credit" ? [{ voucher_id: (voucher as any).id, account_name: "Accounts Receivable", account_type: "asset", debit: total, credit: 0, narration: `Credit sale to ${customer.name}`, entry_date: saleDatetime }] : []),
          ] as any);
        }
      } catch (ledgerErr) { console.error("Ledger auto-entry failed:", ledgerErr); }

      toast.success(`Order #${order.id.slice(0, 8)} created!${isBackdated ? " (Backdated)" : ""}`);
      const cartSnapshot = [...cart] as CartItem[];
      printReceipt(order.id, customer.name, cartSnapshot, total, customer.payment_method, creditToApply, amountDue, selectedCreditBalance, lastPaymentInfo, prescriptionRules);
      lastReceiptRef.current = () => printReceipt(order.id, customer.name, cartSnapshot, total, customer.payment_method, creditToApply, amountDue, selectedCreditBalance, lastPaymentInfo, prescriptionRules);

      setCart([]);
      setCheckoutOpen(false);
      setCustomer({ name: "", phone: "", address: "", district: "Kampala", payment_method: "cash", payment_phone: "", notes: "" });
      setSelectedCreditBalance(null);
      setLastPaymentInfo(null);
      setCustomerSearch("");
      setApplyCreditAmount("");
      setCustomerType("retail");
      setSelectedPrescriptions({});
      setDoctorLicense("");
      setSaleDate(new Date().toISOString().split("T")[0]);
      setSaleTime(`${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`);

      const { data: prods } = await supabase.from("products").select("id, name, price, wholesale_price, buying_price, stock, unit, pieces_per_unit, unit_description, requires_prescription, category_id, product_code").eq("is_active", true).order("name");
      setProducts((prods as Product[]) || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = (orderId: string, customerName: string, items: CartItem[], total: number, payMethod: string, creditApplied: number, finalDue: number, previousBalance: number | null, lastPmt: { amount: number; date: string } | null, prescriptionRules: Record<string, any[]> = {}) => {
    const isCreditSale = payMethod === "credit";
    const newBalance = isCreditSale ? (previousBalance ?? 0) + total - creditApplied : null;
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

    const customerPhone = customer.phone.replace(/[^0-9]/g, "");
    const creditLine = creditApplied > 0 ? `\nCredit Applied: UGX ${creditApplied.toLocaleString()}\nAmount Paid: UGX ${finalDue.toLocaleString()}` : "";
    const balanceLine = isCreditSale ? `\n📋 Previous Balance: UGX ${(previousBalance ?? 0).toLocaleString()}\n📋 New Balance: UGX ${(newBalance ?? 0).toLocaleString()}${lastPmt ? `\n💰 Last Payment: UGX ${lastPmt.amount.toLocaleString()} on ${new Date(lastPmt.date).toLocaleDateString()}` : ""}` : "";
    const payLabel = payMethod === "cash" ? "Cash" : payMethod === "credit" ? "Credit (On Account)" : "Mobile Money";
    const whatsappMsg = encodeURIComponent(
      `Hi ${customerName}, here's your receipt from ${settings.businessName}:\n\nOrder: #${orderId.slice(0, 8)}\nDate: ${new Date(`${saleDate}T${saleTime}:00`).toLocaleString()}\n${customerType === "wholesale" ? "Type: Wholesale\n" : ""}\nItems:\n${items.map(i => {
        const price = getEffectivePrice(i.product, i.customPrice, i.sellingByPiece);
        const qtyLabel = i.sellingByPiece ? `${i.quantity} pcs` : `×${i.quantity}`;
        return `• ${i.product.name} ${qtyLabel} — UGX ${(price * i.quantity).toLocaleString()}${i.customPrice !== null ? " (negotiated)" : ""}${i.sellingByPiece ? " (partial)" : ""}`;
      }).join("\n")}\n\nTotal: UGX ${total.toLocaleString()}${creditLine}${balanceLine}\nPayment: ${payLabel}\n\n${settings.footerNote}`
    );
    const whatsappUrl = `https://wa.me/${customerPhone}?text=${whatsappMsg}`;
    const qrData = encodeURIComponent(whatsappUrl);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;

    const creditSection = creditApplied > 0 ? `
      <div class="credit-section">
        <div class="credit-row"><span>Subtotal</span><span>UGX ${total.toLocaleString()}</span></div>
        <div class="credit-row credit-applied"><span>Credit Applied</span><span>- UGX ${creditApplied.toLocaleString()}</span></div>
        <div class="credit-row credit-due"><span>AMOUNT DUE</span><span>UGX ${finalDue.toLocaleString()}</span></div>
      </div>
    ` : "";

    const accountSection = isCreditSale ? `
      <div class="credit-section" style="background:#eff6ff;border-color:#3b82f6;margin-top:10px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#1e40af;margin-bottom:6px;">📋 Credit Account Summary</div>
        <div class="credit-row" style="color:#1e40af;"><span>Previous Balance</span><span>UGX ${(previousBalance ?? 0).toLocaleString()}</span></div>
        <div class="credit-row" style="color:#1e40af;"><span>This Purchase</span><span>+ UGX ${total.toLocaleString()}</span></div>
        ${creditApplied > 0 ? `<div class="credit-row" style="color:#16a34a;"><span>Payment Applied</span><span>- UGX ${creditApplied.toLocaleString()}</span></div>` : ""}
        <div class="credit-row credit-due" style="border-color:#3b82f6;color:#1e3a8a;"><span>NEW BALANCE</span><span>UGX ${(newBalance ?? 0).toLocaleString()}</span></div>
        ${lastPmt ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;font-weight:600;">Last payment: UGX ${lastPmt.amount.toLocaleString()} on ${new Date(lastPmt.date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</div>` : ""}
      </div>
    ` : "";

    const receiptDate = new Date(`${saleDate}T${saleTime}:00`);
    const receiptHtml = `
      <html><head><title>Receipt</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: ${settings.paperWidth} auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, sans-serif; font-size: ${settings.fontSize}; width: 100%; padding: 14px; color: #0a0a0a; line-height: 1.6; font-weight: 500; }
        .header { padding-bottom: 14px; border-bottom: 1px dashed #ccc; margin-bottom: 14px; }
        .header-row { display: flex; align-items: center; gap: 10px; }
        .header-logo { width: ${settings.logoSize || '40px'}; height: ${settings.logoSize || '40px'}; object-fit: contain; border-radius: 50%; }
        .header-info { flex: 1; }
        .header h1 { font-size: 20px; font-weight: 900; color: #1a1a1a; letter-spacing: 0.5px; margin: 0; }
        .header .tagline { font-size: 12px; color: #555; font-weight: 600; margin-top: 2px; }
        .header .address { font-size: 11px; color: #666; margin-top: 4px; }
        .header .contact { font-size: 11px; color: #1F617A; margin-top: 2px; font-weight: 600; }
        .meta { background: transparent; padding: 0; margin-bottom: 14px; font-size: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
        .meta-row { display: flex; justify-content: flex-start; padding: 2px 0; }
        .meta-label { color: #666; font-weight: 600; margin-right: 4px; }
        .meta-value { font-weight: 700; color: #1a1a1a; }
        .items-header { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #666; padding: 8px 0; border-bottom: 1px dashed #ccc; }
        .item-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
        .item-name { flex: 1; font-weight: 700; color: #1a1a1a; }
        .item-qty { width: 45px; text-align: center; color: #444; font-weight: 700; }
        .item-price { width: 90px; text-align: right; font-weight: 800; color: #1a1a1a; }
        .item-note { font-size: 9px; color: #888; font-style: italic; }
        .total-section { border-top: 1px dashed #ccc; padding: 12px 0; margin: 14px 0; display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 14px; font-weight: 900; color: #1a1a1a; }
        .total-value { font-size: 18px; font-weight: 900; color: #1a1a1a; }
        .credit-section { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
        .credit-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; padding: 2px 0; }
        .credit-applied { color: #d97706; }
        .credit-due { font-size: 14px; font-weight: 900; color: #1a1a1a; border-top: 2px solid #f59e0b; margin-top: 4px; padding-top: 6px; }
        .backdated { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 4px 8px; margin-bottom: 10px; text-align: center; font-size: 10px; font-weight: 700; color: #92400e; }
        .rx-section { background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 10px 12px; margin: 14px 0; }
        .rx-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #065f46; margin-bottom: 8px; }
        .rx-item { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #a7f3d0; }
        .rx-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
        .rx-drug { font-size: 12px; font-weight: 800; color: #064e3b; }
        .rx-detail { font-size: 11px; color: #065f46; font-weight: 600; margin-top: 2px; }
        .rx-timing { font-size: 10px; color: #047857; font-weight: 700; font-style: italic; margin-top: 2px; }
        .qr-section { text-align: center; padding: 14px 0; border-top: 2px dashed #ccc; }
        .qr-section img { margin: 0 auto; }
        .qr-section p { font-size: 9px; color: #888; margin-top: 6px; font-weight: 600; }
        .footer { text-align: center; padding-top: 14px; border-top: 1px dashed #ccc; }
        .footer p { font-size: 11px; color: #666; font-weight: 600; }
        .footer .powered { margin-top: 6px; font-size: 9px; color: #aaa; font-weight: 600; }
        .whatsapp-btn { display: inline-flex; align-items: center; gap: 6px; background: #25D366; color: white; border: none; border-radius: 24px; padding: 10px 20px; font-size: 12px; font-weight: 800; cursor: pointer; margin-top: 12px; text-decoration: none; }
        .pay-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #555; padding: 4px 0; }
        @media print { .no-print { display: none !important; } }
      </style></head><body>
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
        ${isBackdated ? `<div class="backdated">⚠️ BACKDATED SALE — Original Date: ${receiptDate.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</div>` : ""}
        <div class="meta">
          <div class="meta-row"><span class="meta-label">Receipt</span><span class="meta-value">#${orderId.slice(0, 8).toUpperCase()}</span></div>
          <div class="meta-row"><span class="meta-label">Customer</span><span class="meta-value">${customerName}${customerType === "wholesale" ? " (Wholesale)" : ""}</span></div>
          <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${receiptDate.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
          <div class="meta-row"><span class="meta-label">Payment</span><span class="meta-value">${payMethod === "cash" ? "💵 Cash" : payMethod === "credit" ? "📝 Credit (On Account)" : "📱 Mobile Money"}</span></div>
        </div>
        <div class="items-header"><span style="flex:1">Item</span><span style="width:45px;text-align:center">Qty</span><span style="width:90px;text-align:right">Amount</span></div>
        ${items.map(i => {
          const price = getEffectivePrice(i.product, i.customPrice, i.sellingByPiece);
          const hasCustom = i.customPrice !== null || (customerType === "wholesale" && i.product.wholesale_price > 0);
          const qtyLabel = i.sellingByPiece ? `${i.quantity} pcs` : String(i.quantity);
          const pieceNote = i.sellingByPiece ? `<br/><span class="item-note">Sold by piece @ UGX ${price.toLocaleString()}/pc</span>` : "";
          return `<div class="item-row"><span class="item-name">${i.product.name}${pieceNote}${hasCustom ? `<br/><span class="item-note">${i.customPrice !== null ? "Negotiated price" : "Wholesale price"}: UGX ${price.toLocaleString()}/${i.sellingByPiece ? "pc" : "unit"}</span>` : ""}</span><span class="item-qty">${qtyLabel}</span><span class="item-price">UGX ${(price * i.quantity).toLocaleString()}</span></div>`;
        }).join("")}
        ${(() => {
          const rxItems = items.filter(i => i.product.requires_prescription && prescriptionRules[i.product.id]?.length > 0);
          if (rxItems.length === 0) return "";
          return `<div class="rx-section">
            <div class="rx-title">💊 Prescription / Dosage Instructions</div>
            ${rxItems.map(i => {
              const rules = prescriptionRules[i.product.id];
              return rules.map((r: any) => `<div class="rx-item">
                <div class="rx-drug">${i.product.name}</div>
                <div class="rx-detail">Condition: ${r.disease}${r.symptoms ? ` (${r.symptoms})` : ""}</div>
                <div class="rx-detail">Dosage: ${r.dosage}${r.age_min || r.age_max ? ` · Age: ${r.age_min || 0}–${r.age_max || '120+'}` : ""}</div>
                ${r.instructions ? `<div class="rx-detail">Instructions: ${r.instructions}</div>` : ""}
                ${r.timing_notes ? `<div class="rx-timing">⏰ ${r.timing_notes}</div>` : ""}
              </div>`).join("");
            }).join("")}
          </div>`;
        })()}
        <div class="total-section">
          <span class="total-label">TOTAL</span>
          <span class="total-value">UGX ${total.toLocaleString()}</span>
        </div>
        ${creditSection}
        ${accountSection}
        <div class="qr-section">
          <img src="${qrUrl}" alt="QR Code" width="110" height="110" />
          <p>Scan to open receipt on WhatsApp</p>
        </div>
        <div class="footer">
          <p>${settings.footerNote}</p>
          <p class="powered">Powered by TennaHub Technologies Limited</p>
          <a href="${whatsappUrl}" target="_blank" class="whatsapp-btn no-print">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send Receipt via WhatsApp
          </a>
        </div>
      </body></html>
    `;
    const win = window.open("", "_blank", "width=420,height=700");
    if (win) {
      win.document.write(receiptHtml);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Product grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Shortcut hint bar */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono flex-wrap">
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Space</kbd> Search</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Tab</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Enter</kbd> Add/Checkout</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">0-9</kbd> Set Qty</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">F4</kbd> Wholesale</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">F5</kbd> Reprint</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Alt+Space</kbd> Past Receipts</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">F12</kbd> Custom Price</span>
          </div>
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Keyboard className="h-3 w-3" />
            <span>F10 All shortcuts</span>
          </button>
        </div>

        {/* Barcode scanner */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={barcodeRef}
              placeholder="Scan barcode or enter product code... (F2)"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBarcodeScan(); }}
              className="pl-9 font-mono"
            />
          </div>
          <Button variant="secondary" onClick={handleBarcodeScan} disabled={!barcodeInput.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search products... (F1) ↑↓ to navigate, Enter to add"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-12">Loading products...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No products found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p, idx) => (
                <div
                  key={p.id}
                  className={`bg-card border rounded-xl p-3 text-left hover:border-primary hover:shadow-sm transition-all group relative ${
                    idx === selectedProductIndex ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                >
                  {/* Alt+N indicator */}
                  {idx < 9 && (
                    <span className="absolute top-1 right-1 text-[9px] font-mono text-muted-foreground/50">
                      Alt+{idx + 1}
                    </span>
                  )}
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  {p.product_code && <p className="text-[10px] text-muted-foreground font-mono">{p.product_code}</p>}
                  {p.unit_description && <p className="text-[10px] text-accent-foreground/70 italic">{p.unit_description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{p.stock} {p.unit} left{p.pieces_per_unit > 1 && ` (${p.stock * p.pieces_per_unit} pcs)`}</p>
                  {p.expiry_date && (
                    <p className={`text-[10px] mt-0.5 ${(() => {
                      const days = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      if (days <= 0) return "text-destructive font-bold";
                      if (days <= 30) return "text-warning font-semibold";
                      return "text-muted-foreground";
                    })()}`}>
                      Exp: {new Date(p.expiry_date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      {(() => {
                        const sellingPrice = customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.price;
                        const profit = p.buying_price > 0 ? sellingPrice - p.buying_price : 0;
                        const profitPct = p.buying_price > 0 ? Math.round((profit / p.buying_price) * 100) : 0;
                        return (
                          <>
                            <span className="text-sm font-bold text-primary">UGX {sellingPrice.toLocaleString()}</span>
                            {customerType === "wholesale" && p.wholesale_price > 0 && (
                              <span className="text-[10px] text-muted-foreground line-through ml-1">UGX {p.price.toLocaleString()}</span>
                            )}
                            {p.buying_price > 0 && (
                              <span className="block text-[10px] text-muted-foreground">Cost: UGX {p.buying_price.toLocaleString()}</span>
                            )}
                            {p.buying_price > 0 && (
                              <span className={`block text-[10px] font-semibold ${profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                Profit: UGX {profit.toLocaleString()} ({profitPct}%)
                              </span>
                            )}
                          </>
                        );
                      })()}
                      {p.pieces_per_unit > 1 && (
                        <span className="block text-[10px] text-muted-foreground">Unit: UGX {Math.round((customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.price) / p.pieces_per_unit).toLocaleString()}/pc</span>
                      )}
                    </div>
                    {p.requires_prescription && <Badge variant="destructive" className="text-[10px]">Rx</Badge>}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => addToCart(p)}
                      className="flex-1 bg-primary text-primary-foreground text-xs text-center py-1.5 rounded-md hover:opacity-90 transition-opacity"
                    >
                      <Plus className="h-3 w-3 inline mr-0.5" /> {p.unit}
                    </button>
                    {p.pieces_per_unit > 1 && (
                      <button
                        onClick={() => addToCart(p, 1, true)}
                        className="flex-1 bg-accent text-accent-foreground text-xs text-center py-1.5 rounded-md hover:opacity-90 transition-opacity border border-border"
                      >
                        <Pill className="h-3 w-3 inline mr-0.5" /> 1 Piece
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart sidebar */}
      <div className="w-80 bg-card border border-border rounded-xl flex flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Cart
          </h3>
          <div className="flex items-center gap-2">
            {qtyBuffer && (
              <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full animate-pulse">
                Qty: {qtyBuffer}
              </span>
            )}
            <Badge variant={customerType === "wholesale" ? "default" : "secondary"} className="text-[10px] cursor-pointer" onClick={() => setCustomerType(customerType === "retail" ? "wholesale" : "retail")}>
              {customerType === "wholesale" ? "Wholesale" : "Retail"}
            </Badge>
            <Badge variant="secondary">{cart.length}</Badge>
            {cart.length > 0 && (
              <button onClick={() => { setCart([]); toast.success("Cart cleared"); }} className="text-muted-foreground hover:text-destructive" title="Clear cart (F3)">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cart is empty<br/><span className="text-[10px]">Search & click products to add</span></p>
          ) : cart.map((item) => {
            const effectivePrice = getEffectivePrice(item.product, item.customPrice, item.sellingByPiece);
            const maxQty = item.sellingByPiece ? item.product.stock * (item.product.pieces_per_unit || 1) : item.product.stock;
            const cartKey = `${item.product.id}-${item.sellingByPiece ? 'pc' : 'pk'}`;
            return (
              <div key={cartKey} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <p className="text-sm font-medium">{item.product.name}</p>
                    {item.sellingByPiece && (
                      <Badge variant="outline" className="text-[9px] mt-0.5 border-primary/50 text-primary">
                        <Pill className="h-2.5 w-2.5 mr-0.5" /> Selling by piece
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => {
                      setEditingPriceId(editingPriceId === cartKey ? null : cartKey);
                      setTempPrice(String(effectivePrice));
                    }} className="text-muted-foreground hover:text-primary" title="Negotiate price">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {item.sellingByPiece
                    ? `${item.product.stock * (item.product.pieces_per_unit || 1)} pcs available`
                    : `${item.product.stock} ${item.product.unit} in stock`}
                </p>
                {editingPriceId === cartKey && (
                  <div className="flex gap-1 mt-2">
                    <Input
                      type="number"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const p = parseFloat(tempPrice);
                          if (p > 0) { setCustomPrice(item.product.id, p); setEditingPriceId(null); toast.success("Price updated"); }
                        }
                      }}
                      className="h-7 text-xs"
                      placeholder={item.sellingByPiece ? "Price per piece" : "Custom price"}
                      autoFocus
                    />
                    <Button size="sm" className="h-7 text-xs px-2" onClick={() => {
                      const p = parseFloat(tempPrice);
                      if (p > 0) { setCustomPrice(item.product.id, p); setEditingPriceId(null); toast.success("Price updated"); }
                    }}>Set</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => {
                      setCustomPrice(item.product.id, null);
                      setEditingPriceId(null);
                    }}>Reset</Button>
                  </div>
                )}
                {item.customPrice !== null && editingPriceId !== cartKey && (
                  <p className="text-[10px] text-warning mt-1">Negotiated: UGX {item.customPrice.toLocaleString()}/{item.sellingByPiece ? "pc" : "unit"}</p>
                )}
                {(() => {
                  const costPrice = item.sellingByPiece && item.product.pieces_per_unit > 1
                    ? item.product.buying_price / item.product.pieces_per_unit
                    : item.product.buying_price;
                  const unitProfit = effectivePrice - costPrice;
                  const totalProfit = unitProfit * item.quantity;
                  return (
                    <>
                      {item.product.buying_price > 0 && (
                        <div className="flex items-center justify-between text-[10px] mt-1">
                          <span className="text-muted-foreground">Cost: UGX {Math.round(costPrice).toLocaleString()}/{item.sellingByPiece ? "pc" : "unit"}</span>
                          <span className={`font-semibold ${unitProfit > 0 ? 'text-emerald-600' : unitProfit < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            Profit: UGX {Math.round(unitProfit).toLocaleString()}/{item.sellingByPiece ? "pc" : "unit"}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.product.id, -1, item.sellingByPiece)} className="h-6 w-6 rounded bg-background border border-border flex items-center justify-center hover:bg-accent">
                            <Minus className="h-3 w-3" />
                          </button>
                          {editingQtyId === cartKey ? (
                            <input
                              type="number"
                              value={tempQty}
                              onChange={(e) => setTempQty(e.target.value)}
                              onBlur={() => {
                                const q = parseFloat(tempQty);
                                if (q > 0 && q <= maxQty) setExactQty(item.product.id, q);
                                setEditingQtyId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const q = parseFloat(tempQty);
                                  if (q > 0 && q <= maxQty) setExactQty(item.product.id, q);
                                  setEditingQtyId(null);
                                }
                                if (e.key === "Escape") setEditingQtyId(null);
                              }}
                              className="w-14 h-6 text-center text-sm font-medium border border-primary rounded bg-background outline-none"
                              autoFocus
                              min={1}
                              max={maxQty}
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingQtyId(cartKey);
                                setTempQty(String(item.quantity));
                              }}
                              className="text-sm font-medium w-14 text-center hover:bg-accent rounded py-0.5 border border-transparent hover:border-border transition-colors"
                              title="Click to type exact quantity"
                            >
                              {item.quantity} <span className="text-[9px] text-muted-foreground">{item.sellingByPiece ? "pcs" : item.product.unit}</span>
                            </button>
                          )}
                          <button onClick={() => updateQty(item.product.id, 1, item.sellingByPiece)} className="h-6 w-6 rounded bg-background border border-border flex items-center justify-center hover:bg-accent">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold block">UGX {(effectivePrice * item.quantity).toLocaleString()}</span>
                          {item.product.buying_price > 0 && (
                            <span className={`text-[10px] font-semibold ${totalProfit > 0 ? 'text-emerald-600' : totalProfit < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              +UGX {Math.round(totalProfit).toLocaleString()} profit
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-border space-y-3">
          {(() => {
            const totalProfit = cart.reduce((sum, item) => {
              const ep = getEffectivePrice(item.product, item.customPrice, item.sellingByPiece);
              const cp = item.sellingByPiece && item.product.pieces_per_unit > 1
                ? item.product.buying_price / item.product.pieces_per_unit
                : item.product.buying_price;
              return sum + (ep - cp) * item.quantity;
            }, 0);
            return (
              <>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">UGX {total.toLocaleString()}</span>
                </div>
                {cart.length > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Total Profit</span>
                    <span className={`font-bold ${totalProfit > 0 ? 'text-emerald-600' : totalProfit < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      UGX {Math.round(totalProfit).toLocaleString()}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
          <Button className="w-full gap-2" size="lg" disabled={cart.length === 0} onClick={() => { setCheckoutOpen(true); setAmountGiven(""); }}>
            <CreditCard className="h-4 w-4" /> Checkout <kbd className="ml-1 text-[10px] opacity-60 font-mono">F8</kbd>
          </Button>
        </div>
      </div>

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><User className="h-5 w-5" /> Complete Sale</h2>
              <button onClick={() => setCheckoutOpen(false)} title="Escape"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Backdated sale */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Sale Date & Time
                </label>
                <div className="flex gap-2">
                  <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="flex-1" />
                  <Input type="time" value={saleTime} onChange={(e) => setSaleTime(e.target.value)} className="w-28" />
                </div>
                {isBackdated && (
                  <p className="text-xs text-warning font-medium">⚠️ Backdated sale — will appear on {saleDate}</p>
                )}
              </div>

              {/* Customer type */}
              <div>
                <label className="text-sm font-medium mb-1 block">Customer Type</label>
                <div className="flex gap-2">
                  {[{ value: "retail", label: "🛒 Retail" }, { value: "wholesale", label: "📦 Wholesale" }].map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setCustomerType(t.value as "retail" | "wholesale")}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        customerType === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer lookup */}
              <div className="relative">
                <label className="text-sm font-medium mb-1 block">Find Existing Customer</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onFocus={() => customerSuggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Search by name or phone..."
                    className="pl-9"
                  />
                </div>
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    {customerSuggestions.map((c) => (
                      <button
                        key={c.customer_phone}
                        onMouseDown={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">{c.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{c.customer_phone} · {c.customer_type || "retail"}</p>
                          </div>
                          {c.credit_balance > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              Owes UGX {c.credit_balance.toLocaleString()}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedCreditBalance !== null && selectedCreditBalance > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      Outstanding balance: UGX {selectedCreditBalance.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-destructive/80 mb-1 block">Apply credit to this sale</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={applyCreditAmount}
                        onChange={(e) => setApplyCreditAmount(e.target.value)}
                        placeholder={`Max UGX ${Math.min(selectedCreditBalance, total).toLocaleString()}`}
                        className="text-sm"
                        max={Math.min(selectedCreditBalance, total)}
                        min={0}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setApplyCreditAmount(String(Math.min(selectedCreditBalance, total)))}
                        className="whitespace-nowrap text-xs"
                      >
                        Use Max
                      </Button>
                    </div>
                    {creditToApply > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Amount due after credit: <span className="font-bold text-foreground">UGX {amountDue.toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">Customer Name *</label>
                <Input value={customer.name} onChange={(e) => { setCustomer({ ...customer, name: e.target.value }); setSelectedCreditBalance(null); }} placeholder="Walk-in Customer" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone *</label>
                <Input value={customer.phone} onChange={(e) => { setCustomer({ ...customer, phone: e.target.value }); setSelectedCreditBalance(null); }} placeholder="+256 7XX XXX XXX" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">District</label>
                <select
                  value={customer.district}
                  onChange={(e) => setCustomer({ ...customer, district: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Address</label>
                <Input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Method</label>
                <div className="flex gap-2">
                  {[{ value: "cash", label: "💵 Cash", key: "1" }, { value: "mobile_money", label: "📱 MoMo", key: "2" }, { value: "credit", label: "📝 Credit", key: "3" }].map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setCustomer({ ...customer, payment_method: m.value })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        customer.payment_method === m.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {customer.payment_method === "mobile_money" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Mobile Money Number</label>
                  <Input value={customer.payment_phone} onChange={(e) => setCustomer({ ...customer, payment_phone: e.target.value })} placeholder="+256 7XX XXX XXX" />
                </div>
              )}
              {customer.payment_method === "credit" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">📝 Credit Sale — Amount added to account</p>
                  {selectedCreditBalance !== null && (
                    <p className="text-sm text-blue-700">
                      Current balance: <span className="font-bold">UGX {selectedCreditBalance.toLocaleString()}</span>
                    </p>
                  )}
                  {lastPaymentInfo && (
                    <p className="text-xs text-blue-600">
                      Last payment: UGX {lastPaymentInfo.amount.toLocaleString()} on {new Date(lastPaymentInfo.date).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {selectedCreditBalance !== null && (
                    <p className="text-sm font-bold text-blue-900">
                      New balance after sale: UGX {((selectedCreditBalance ?? 0) + total).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Notes</label>
                <Input value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} placeholder="Optional" />
              </div>

              {/* Doctor's License for Controlled Substances */}
              {cart.some(i => i.product.requires_prescription) && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-800 dark:text-red-300">
                    🛡️ Prescription Item — Doctor&apos;s License Required
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Items: {cart.filter(i => i.product.requires_prescription).map(i => i.product.name).join(", ")}
                  </p>
                  <Input
                    value={doctorLicense}
                    onChange={(e) => setDoctorLicense(e.target.value)}
                    placeholder="Enter Doctor's License Number *"
                    className="text-sm"
                  />
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-2">{cart.length} items · {customerType === "wholesale" ? "Wholesale" : "Retail"}</p>
                {cart.map((i) => {
                  const price = getEffectivePrice(i.product, i.customPrice);
                  return (
                    <div key={i.product.id} className="flex justify-between text-sm py-0.5">
                      <span>{i.product.name} × {i.quantity}{i.customPrice !== null ? " *" : ""}</span>
                      <span className="font-medium">UGX {(price * i.quantity).toLocaleString()}</span>
                    </div>
                  );
                })}
                <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>UGX {total.toLocaleString()}</span>
                </div>
              {creditToApply > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-destructive mt-1">
                      <span>Credit Applied</span>
                      <span>- UGX {creditToApply.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-primary mt-1">
                      <span>Amount Due</span>
                      <span>UGX {amountDue.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Amount Given & Balance */}
              <div className="bg-accent/50 border border-border rounded-lg p-3 space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  💰 Amount Given <kbd className="text-[10px] font-mono opacity-60 px-1 py-0.5 rounded bg-muted border border-border">F1</kbd>
                </label>
                <Input
                  ref={amountGivenRef}
                  type="number"
                  value={amountGiven}
                  onChange={(e) => setAmountGiven(e.target.value)}
                  placeholder={`Enter amount received (Due: UGX ${amountDue.toLocaleString()})`}
                  className="text-lg font-bold"
                />
                {amountGiven && parseFloat(amountGiven) > 0 && (
                  <div className={`text-sm font-bold p-2 rounded-md ${
                    parseFloat(amountGiven) >= amountDue
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  }`}>
                    {parseFloat(amountGiven) >= amountDue
                      ? `✅ Balance to return: UGX ${(parseFloat(amountGiven) - amountDue).toLocaleString()}`
                      : `⚠️ Short by: UGX ${(amountDue - parseFloat(amountGiven)).toLocaleString()}`}
                  </div>
                )}
              </div>

              {/* Prescription Rules Selector */}
              {cart.some(i => i.product.requires_prescription && availableRules[i.product.id]?.length > 0) && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    <Pill className="h-4 w-4" /> Prescription / Dosage Instructions
                  </div>
                  {cart.filter(i => i.product.requires_prescription && availableRules[i.product.id]?.length > 0).map(item => (
                    <div key={item.product.id} className="space-y-2">
                      <p className="text-xs font-semibold">{item.product.name}</p>
                      <div className="space-y-1">
                        {availableRules[item.product.id].map(rule => {
                          const isSelected = selectedPrescriptions[item.product.id]?.rule.id === rule.id;
                          return (
                            <button
                              key={rule.id}
                              type="button"
                              onClick={() => isSelected ? removePrescription(item.product.id) : selectPrescriptionRule(item.product.id, rule)}
                              className={`w-full text-left p-2 rounded-md border text-xs transition-colors ${
                                isSelected ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50" : "border-border hover:border-emerald-300"
                              }`}
                            >
                              <div className="font-semibold">{rule.disease}{rule.symptoms ? ` — ${rule.symptoms}` : ""}</div>
                              <div className="text-muted-foreground">Dosage: {rule.dosage} · Age: {rule.age_min || 0}–{rule.age_max || "120+"}</div>
                              {rule.instructions && <div className="text-muted-foreground">{rule.instructions}</div>}
                            </button>
                          );
                        })}
                      </div>
                      {selectedPrescriptions[item.product.id] && (
                        <div>
                          <label className="text-[10px] font-semibold block mb-1">⏰ Timing Notes (editable)</label>
                          <Input
                            value={selectedPrescriptions[item.product.id].customTiming}
                            onChange={(e) => updatePrescriptionTiming(item.product.id, e.target.value)}
                            placeholder="e.g. Take after meals, 3 times daily"
                            className="text-xs h-8"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCheckoutOpen(false)}>Cancel <kbd className="ml-1 text-[10px] opacity-60 font-mono">Esc</kbd></Button>
                <Button className="flex-1 gap-2" onClick={handleCheckout} disabled={submitting}>
                  <Printer className="h-4 w-4" /> {submitting ? "Processing..." : "Complete"} <kbd className="ml-1 text-[10px] opacity-60 font-mono">F9</kbd>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Past Receipts Search Modal */}
      {pastReceiptsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPastReceiptsOpen(false)}>
          <div className="bg-background rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><History className="h-5 w-5" /> Reuse Past Receipt</h2>
              <button onClick={() => setPastReceiptsOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={pastReceiptsSearchRef}
                  value={pastReceiptsSearch}
                  onChange={(e) => setPastReceiptsSearch(e.target.value)}
                  placeholder="Search by customer name, phone, or receipt ID..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Select a receipt to load its items into the current cart</p>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {pastReceiptsLoading ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Loading...</p>
              ) : pastReceipts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No receipts found</p>
              ) : (
                <div className="space-y-1">
                  {pastReceipts.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => loadPastReceipt(r.id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors border border-transparent hover:border-border"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold">{r.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{r.phone} · #{r.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">UGX {r.total.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          {(r as any).reuse_count > 0 && (
                            <span className="inline-block mt-0.5 text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">♻️ {(r as any).reuse_count}x reused</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-background rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Keyboard className="h-5 w-5" /> Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1 text-sm">
              {[
                ["Space", "Focus search (speed mode)"],
                ["Tab / Shift+Tab", "Navigate products"],
                ["Enter", "Add selected / Open checkout"],
                ["0-9", "Type quantity for last item"],
                ["Backspace", "Edit quantity digits"],
                ["F1", "Focus search / Amount Given (checkout)"],
                ["F2", "Focus barcode scanner"],
                ["F3", "Clear entire cart"],
                ["F5", "Reprint last receipt"],
                ["F4", "Toggle Retail / Wholesale"],
                ["F8", "Open checkout"],
                ["F9", "Complete sale & print"],
                ["F10", "Show / hide this help"],
                ["F12", "Set custom price on product"],
                ["Esc", "Close modal / cancel edit"],
                ["Alt+Space", "Search & reuse past receipts"],
                ["Alt+1–9", "Quick add product from grid"],
                ["Delete", "Remove last cart item"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <kbd className="px-2 py-0.5 rounded bg-muted border border-border text-xs font-mono font-semibold">{key}</kbd>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-lg">
              <p className="text-[11px] text-primary font-semibold mb-1">⚡ Speed Mode Flow:</p>
              <p className="text-[10px] text-muted-foreground">Space → type product name → Tab to navigate → Enter to add → type numbers for quantity → Enter to checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Checkout from "./pages/Checkout";
import AuthPage from "./pages/AuthPage";
import ProductDetail from "./pages/ProductDetail";
import ShopPage from "./pages/ShopPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/pos" element={<AdminDashboard />} />
              <Route path="/admin/inventory" element={<AdminDashboard />} />
              <Route path="/admin/stock-purchase" element={<AdminDashboard />} />
              <Route path="/admin/orders" element={<AdminDashboard />} />
              <Route path="/admin/reports" element={<AdminDashboard />} />
              <Route path="/admin/sales-history" element={<AdminDashboard />} />
              <Route path="/admin/credits" element={<AdminDashboard />} />
              <Route path="/admin/preview" element={<AdminDashboard />} />
              <Route path="/admin/analytics" element={<AdminDashboard />} />
              <Route path="/admin/prescriptions" element={<AdminDashboard />} />
              <Route path="/admin/accounting" element={<AdminDashboard />} />
              <Route path="/admin/expenses" element={<AdminDashboard />} />
              <Route path="/admin/batches" element={<AdminDashboard />} />
              <Route path="/admin/suppliers" element={<AdminDashboard />} />
              
              <Route path="/admin/day-book" element={<AdminDashboard />} />
              
              <Route path="/admin/settings" element={<AdminDashboard />} />
              <Route path="/admin/reports-hub" element={<AdminDashboard />} />
              <Route path="/admin/audit" element={<AdminDashboard />} />
              <Route path="/admin/grn" element={<AdminDashboard />} />

              {/* ERP routes */}
              <Route path="/admin/coa" element={<AdminDashboard />} />
              <Route path="/admin/journal" element={<AdminDashboard />} />
              <Route path="/admin/ledger" element={<AdminDashboard />} />
              <Route path="/admin/trial-balance" element={<AdminDashboard />} />
              <Route path="/admin/invoices" element={<AdminDashboard />} />
              <Route path="/admin/customers" element={<AdminDashboard />} />
              <Route path="/admin/receipts" element={<AdminDashboard />} />
              <Route path="/admin/bills" element={<AdminDashboard />} />
              <Route path="/admin/payments" element={<AdminDashboard />} />
              <Route path="/admin/items" element={<AdminDashboard />} />
              <Route path="/admin/stock-movement" element={<AdminDashboard />} />
              <Route path="/admin/employees" element={<AdminDashboard />} />
              <Route path="/admin/payruns" element={<AdminDashboard />} />
              <Route path="/admin/tax-rates" element={<AdminDashboard />} />
              <Route path="/admin/vat-returns" element={<AdminDashboard />} />
              <Route path="/admin/pnl" element={<AdminDashboard />} />
              <Route path="/admin/balance-sheet" element={<AdminDashboard />} />
              <Route path="/admin/cash-flow" element={<AdminDashboard />} />
              <Route path="/admin/aged-debtors" element={<AdminDashboard />} />
              <Route path="/admin/fiscal-year" element={<AdminDashboard />} />
              <Route path="/admin/company" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminDashboard />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

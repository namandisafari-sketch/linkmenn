import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ShoppingCart, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import logo from "@/assets/marvid-logo.png";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { itemCount } = useCart();

  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="Marvid Pharmacy Limited" className="h-[72px] w-auto p-0 m-0 object-contain" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Home</Link>
          <Link to="/shop" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Products</Link>
          <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About</a>
          <a href="#contact" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Contact</a>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/checkout">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-semibold">
                  {itemCount}
                </span>
              )}
            </Button>
          </Link>
          {user ? (
            <>
              <Link to="/admin">
                <Button variant="ghost" size="icon"><User className="h-5 w-5" /></Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button className="rounded-full bg-[hsl(140,60%,35%)] hover:bg-[hsl(140,60%,30%)] text-white font-semibold px-6 h-9">
                Partner With Us
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <div className="px-6 py-4 flex flex-col gap-3">
            <Link to="/" className="text-sm font-medium py-2" onClick={() => setMobileOpen(false)}>Home</Link>
            <Link to="/shop" className="text-sm font-medium py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Products</Link>
            <a href="#about" className="text-sm font-medium py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>About</a>
            <a href="#contact" className="text-sm font-medium py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Contact</a>
            {user ? (
              <>
                <Link to="/admin" className="text-sm font-medium py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Admin</Link>
                <button className="text-sm font-medium py-2 text-muted-foreground text-left" onClick={() => { signOut(); setMobileOpen(false); }}>Sign Out</button>
              </>
            ) : (
              <Link to="/auth" className="text-sm font-medium py-2 text-muted-foreground" onClick={() => setMobileOpen(false)}>Sign In</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

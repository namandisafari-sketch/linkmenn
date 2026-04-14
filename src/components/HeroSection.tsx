import { Search, Camera, Truck, Shield, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <section className="gradient-hero py-20 md:py-28 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-primary-foreground/20 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-primary-foreground/10 blur-3xl" />
      </div>

      <div className="container text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-full px-4 py-1.5 mb-6 animate-fade-in">
          <Shield className="h-3.5 w-3.5 text-primary-foreground" />
          <span className="text-xs font-medium text-primary-foreground">Licensed & Trusted Pharmacy</span>
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-4 animate-fade-in leading-tight">
          Your Health, Our Priority.<br />
          <span className="opacity-90">Delivered to Your Door</span>
        </h1>
        <p className="text-primary-foreground/80 text-lg md:text-xl mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Quality medicines, fast delivery across Uganda. Upload your prescription and let us handle the rest.
        </p>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search medicines, supplements, health products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-14 pr-5 rounded-full bg-background text-foreground shadow-xl text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow hover:shadow-2xl"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <Link to="/auth">
            <Button size="lg" className="rounded-full bg-background text-primary hover:bg-background/90 font-semibold gap-2 shadow-lg h-12 px-8">
              <Camera className="h-4 w-4" /> Upload Prescription
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="rounded-full border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 font-semibold gap-2 h-12 px-8">
            <Truck className="h-4 w-4" /> Track Order
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="flex items-center gap-2 text-primary-foreground/70">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Same-Day Delivery</span>
          </div>
          <div className="flex items-center gap-2 text-primary-foreground/70">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">100% Genuine</span>
          </div>
          <div className="flex items-center gap-2 text-primary-foreground/70">
            <Star className="h-4 w-4" />
            <span className="text-sm font-medium">500+ Products</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

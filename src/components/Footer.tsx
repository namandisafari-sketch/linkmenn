import { MapPin, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/marvid-logo.png";
import { useState } from "react";
import { toast } from "sonner";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const Footer = () => {
  const [email, setEmail] = useState("");
  const settings = useBusinessSettings();

  return (
    <footer className="bg-foreground text-background/80 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div>
            <img src={logo} alt="Marvid Pharmacy Limited" className="h-[72px] w-auto brightness-0 invert p-0 m-0" />
            <p className="text-sm leading-relaxed opacity-70 mt-2">Affordable quality, reliable access, healthier communities.</p>
          </div>

          <div>
            <h4 className="font-semibold text-[hsl(140,60%,35%)] mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#about" className="hover:text-background transition-colors">About</a></li>
              <li><a href="#about" className="hover:text-background transition-colors">Portfolio</a></li>
              <li><a href="#about" className="hover:text-background transition-colors">Research</a></li>
              <li><a href="#about" className="hover:text-background transition-colors">CSR</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-[hsl(140,60%,35%)] mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-[hsl(0,70%,50%)]" /> {settings.address}</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-[hsl(210,80%,45%)]" /> {settings.email}</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-[hsl(140,60%,35%)]" /> {settings.phone}</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-[hsl(140,60%,35%)] mb-4">Insights</h4>
            <p className="text-sm opacity-70 mb-3">Stay updated with our products and industry news.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg bg-background/10 border border-background/20 text-background text-sm placeholder:text-background/40 outline-none"
              />
              <Button
                size="sm"
                className="rounded-lg bg-[hsl(140,60%,35%)] hover:bg-[hsl(140,60%,30%)] text-white h-9 px-4"
                onClick={() => { toast.success("Subscribed!"); setEmail(""); }}
              >
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 pt-6 flex flex-col md:flex-row items-center justify-between text-xs opacity-60">
          <span>© 2026 {settings.businessName}. All rights reserved.</span>
          <div className="flex gap-4 mt-2 md:mt-0">
            <a href="#" className="hover:text-background">Privacy</a>
            <a href="#" className="hover:text-background">Terms</a>
            <a href="#" className="hover:text-background">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

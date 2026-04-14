import { Phone, Mail, MapPin } from "lucide-react";
import logo from "@/assets/marvid-logo.png";

const Footer = () => (
  <footer className="bg-foreground text-background/80 py-12">
    <div className="container">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div>
          <img src={logo} alt="Marvid Pharmaceutical UG" className="h-10 brightness-0 invert mb-4" />
          <p className="text-sm leading-relaxed">Your trusted pharmaceutical partner in Uganda. Quality medicines delivered with care.</p>
        </div>
        <div>
          <h4 className="font-semibold text-background mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/" className="hover:text-background transition-colors">Home</a></li>
            <li><a href="/shop" className="hover:text-background transition-colors">Shop</a></li>
            <li><a href="/prescription" className="hover:text-background transition-colors">Prescription Upload</a></li>
            <li><a href="/about" className="hover:text-background transition-colors">About Us</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-background mb-4">Contact Us</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +256 700 000 000</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> info@marvidpharma.ug</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Kampala, Uganda</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-background/10 pt-6 text-center text-xs">
        © 2026 Marvid Pharmaceutical UG. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;

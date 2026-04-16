import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CategoryGrid from "@/components/CategoryGrid";
import VisionValues from "@/components/VisionValues";
import BusinessPartners from "@/components/BusinessPartners";
import ResearchSection from "@/components/ResearchSection";
import CSRSection from "@/components/CSRSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
// ChatBubble removed from public pages - AI assistant is only on admin pages

const isPWA = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isPWA()) {
      navigate("/auth", { replace: true });
      return;
    }
    setChecked(true);
  }, [navigate]);

  if (!checked) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <CategoryGrid />
        <VisionValues />
        <BusinessPartners />
        <ResearchSection />
        <CSRSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

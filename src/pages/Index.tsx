import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CategoryGrid from "@/components/CategoryGrid";
import FeaturedProducts from "@/components/FeaturedProducts";
import PrescriptionUpload from "@/components/PrescriptionUpload";
import Footer from "@/components/Footer";
import ChatBubble from "@/components/ChatBubble";

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
        <FeaturedProducts />
        <PrescriptionUpload />
      </main>
      <Footer />
      <ChatBubble />
    </div>
  );
};

export default Index;

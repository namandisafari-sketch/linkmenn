import { useState, useEffect } from "react";

const DEFAULT_SETTINGS = {
  businessName: "Marvid Pharmacy Limited",
  tagline: "Your Health, Our Priority",
  address: "Wilson Rd, Old Kampala, Kampala, Uganda",
  phone: "+256 758 246905",
  email: "marvidpharmacyltd@gmail.com",
  footerNote: "Thank you for choosing Marvid Pharmacy Limited!",
  showLogo: true,
  logoUrl: "https://ogygtkyeepmaljsnoapg.supabase.co/storage/v1/object/public/product-images/receipt-logo/default-logo.png",
  logoSize: "60px",
  logoAlign: "center" as "left" | "center" | "right",
  paperWidth: "80mm",
  fontSize: "12px",
};

export type BusinessSettings = typeof DEFAULT_SETTINGS;

export const useBusinessSettings = () => {
  const [settings, setSettings] = useState<BusinessSettings>(() => {
    const saved = localStorage.getItem("marvid_receipt_settings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem("marvid_receipt_settings");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    };
    window.addEventListener("storage", handler);
    // Also poll for same-tab changes
    const interval = setInterval(() => {
      const saved = localStorage.getItem("marvid_receipt_settings");
      if (saved) {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        setSettings(prev => JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev);
      }
    }, 2000);
    return () => { window.removeEventListener("storage", handler); clearInterval(interval); };
  }, []);

  return settings;
};

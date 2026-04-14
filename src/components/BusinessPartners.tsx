import tennahubLogo from "@/assets/tennahub-logo.png";
import barofLogo from "@/assets/barof-logo.png";

const logoPartners = [
  { name: "TennaHub Technologies", logo: tennahubLogo },
  { name: "Barof Media Production", logo: barofLogo },
];

const BusinessPartners = () => (
  <section className="py-16 md:py-20 bg-background border-t border-b border-border">
    <div className="max-w-7xl mx-auto px-6">
      <h2 className="text-2xl md:text-3xl font-bold text-[hsl(140,60%,35%)] text-center mb-12">
        Our Business Partners
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
        {logoPartners.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-center h-20 px-4 opacity-80 hover:opacity-100 transition-opacity"
          >
            <img src={p.logo} alt={p.name} className="h-16 w-auto object-contain" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BusinessPartners;

import tennahubLogo from "@/assets/tennahub-logo.png";

const textPartners = [
  { name: "Aculife", color: "hsl(0, 70%, 45%)" },
  { name: "Fourrts", color: "hsl(210, 80%, 40%)" },
  { name: "Sakar Healthcare", color: "hsl(210, 70%, 35%)" },
  { name: "Sanjar", color: "hsl(25, 80%, 50%)" },
  { name: "Troikaa", color: "hsl(0, 65%, 45%)" },
  { name: "Orley", color: "hsl(210, 60%, 35%)" },
  { name: "Lisen Labs", color: "hsl(140, 50%, 35%)" },
  { name: "Mediven", color: "hsl(195, 60%, 40%)" },
];

const BusinessPartners = () => (
  <section className="py-16 md:py-20 bg-background border-t border-b border-border">
    <div className="max-w-7xl mx-auto px-6">
      <h2 className="text-2xl md:text-3xl font-bold text-[hsl(140,60%,35%)] text-center mb-12">
        Our Business Partners
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
        {/* TennaHub with logo */}
        <div className="flex items-center justify-center h-16 px-4 opacity-80 hover:opacity-100 transition-opacity">
          <img src={tennahubLogo} alt="TennaHub Technologies" className="h-14 w-auto object-contain" />
        </div>
        {textPartners.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-center h-16 px-4 opacity-70 hover:opacity-100 transition-opacity"
          >
            <span
              className="text-lg md:text-xl font-bold tracking-tight"
              style={{ color: p.color }}
            >
              {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BusinessPartners;

import pharmacyImg from "@/assets/pharmacy-interior.jpg";

const HeroSection = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div>
            <span className="inline-block text-xs font-semibold text-[hsl(140,60%,35%)] border border-[hsl(140,60%,35%)] rounded-full px-4 py-1.5 mb-6">
              Committed to Better Health
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
              Quality Pharmaceuticals<br />
              for <span className="text-[hsl(140,60%,35%)]">Uganda & Beyond</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-10 max-w-lg">
              At Marvin Pharma, we're dedicated to advancing public health by providing affordable, high-quality medicines, with a special focus on combating malaria. We partner with global health leaders to ensure reliable supply chains and effective healthcare solutions.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: "9+", label: "Years of Service" },
                { value: "2,000+", label: "Products" },
                { value: "10+", label: "Districts" },
                { value: "10+", label: "Partners" },
              ].map((s) => (
                <div key={s.label} className="text-center border border-border rounded-xl p-4">
                  <div className="text-xl md:text-2xl font-bold text-[hsl(210,80%,45%)]">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right image with overlay */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl">
            <img src={pharmacyImg} alt="Pharmacy interior" className="w-full h-[400px] md:h-[480px] object-cover" width={1280} height={864} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <h3 className="text-xl font-bold mb-2">Our Commitment to Malaria Control</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Through global partnerships and local outreach, we distribute WHO-prequalified anti-malarial drugs to combat malaria in Uganda and across Africa.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

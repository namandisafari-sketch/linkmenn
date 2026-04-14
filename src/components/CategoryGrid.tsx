import { Pill, FlaskConical, Heart, Cross } from "lucide-react";

const categories = [
  { icon: Pill, title: "Rx & OTC\nMedicines", desc: "Quality-assured therapeutics across key therapeutic areas." },
  { icon: FlaskConical, title: "Diagnostics", desc: "Reliable diagnostics and health screening essentials." },
  { icon: Heart, title: "Wellness\n& Nutrition", desc: "Supplements and wellness lines supporting healthier lives." },
  { icon: Cross, title: "Hospital\nSupplies", desc: "Trusted devices and consumables for clinical settings." },
];

const CategoryGrid = () => (
  <section id="about" className="py-16 md:py-24 bg-background">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        {/* Left: About text */}
        <div>
          <span className="inline-block text-xs font-semibold text-muted-foreground border border-border rounded-full px-4 py-1.5 mb-4">
            About Us
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-6">
            Excellence in Pharmaceutical Care. Local Commitment. Global Vision.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Founded in 2017, Marvin Pharma Ltd is dedicated to advancing health and well-being through the provision of high-quality pharmaceutical solutions. Guided by a vision to be Uganda's leading pharmaceutical company, we combine scientific innovation with ethical business practices to create lasting impact in healthcare.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Marvin Pharma Ltd was incorporated in 2017 under the leadership of our Managing Director, Mr Mohammed Yousuf Pasha, who has rich experience of 20 years in the pharmaceutical industry in Uganda.
          </p>

          <div className="space-y-3 mb-6">
            {[
              "WHO-GMP aligned quality systems",
              "Focused on malaria control and public health education",
              "Wide regional distribution and last-mile delivery",
              "Long-term partnerships with trusted global manufacturers",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-[hsl(210,80%,93%)] flex items-center justify-center shrink-0">
                  <svg className="h-3.5 w-3.5 text-[hsl(210,80%,45%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>

          <a href="#contact" className="text-sm font-semibold text-[hsl(140,60%,35%)] hover:underline inline-flex items-center gap-1">
            Speak to our team →
          </a>
        </div>

        {/* Right: Category cards */}
        <div className="grid grid-cols-2 gap-4">
          {categories.map((cat) => (
            <div key={cat.title} className="border border-border rounded-2xl p-6 hover:shadow-lg transition-shadow bg-card">
              <cat.icon className="h-8 w-8 text-[hsl(140,60%,35%)] mb-4" />
              <h3 className="font-bold text-sm mb-2 whitespace-pre-line">{cat.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{cat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default CategoryGrid;

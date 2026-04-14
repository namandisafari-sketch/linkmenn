import { HeartHandshake, Leaf, GraduationCap } from "lucide-react";

const initiatives = [
  {
    icon: HeartHandshake,
    title: "Community Health Outreach",
    desc: "Through mobile clinics and outreach programs, we focus on screening, vaccination, and health education to combat public health challenges, with a special emphasis on malaria awareness and prevention.",
  },
  {
    icon: Leaf,
    title: "Sustainability Initiatives",
    desc: "We prioritize eco-friendly practices through packaging optimization, waste reduction, and greener logistics, working to reduce our environmental footprint while advancing health solutions.",
  },
  {
    icon: GraduationCap,
    title: "Workforce Development",
    desc: "We are committed to empowering the next generation of health leaders through scholarships, training programs, and career development initiatives that foster talent and innovation in the pharmaceutical sector.",
  },
];

const CSRSection = () => (
  <section className="py-16 md:py-24 bg-muted/30">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-3 gap-6">
        {initiatives.map((item) => (
          <div key={item.title} className="bg-card border border-border rounded-2xl p-8">
            <item.icon className="h-8 w-8 text-[hsl(140,60%,35%)] mb-4" />
            <h3 className="font-bold text-foreground mb-3">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default CSRSection;

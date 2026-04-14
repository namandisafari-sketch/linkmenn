import researchImg from "@/assets/research-image.avif";
import { Users, ShieldCheck, Lightbulb } from "lucide-react";

const ResearchSection = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block text-xs font-semibold text-muted-foreground border border-border rounded-full px-4 py-1.5 mb-4">
            Research
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-6">
            Evidence-led Product Development & Public Health Impact
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-8">
            At Marvid Pharmacy Limited, we leverage clinical research and scientific innovation to develop high-quality pharmaceutical solutions, focusing on malaria treatment, disease prevention, and improving overall public health outcomes. Our research is guided by real-world evidence, ensuring that our products are both effective and safe for the communities we serve.
          </p>

          <div className="space-y-4">
            {[
              { icon: Users, text: "Collaborations with global clinical partners to advance malaria research" },
              { icon: ShieldCheck, text: "Comprehensive pharmacovigilance and post-market surveillance" },
              { icon: Lightbulb, text: "Innovation pipeline focused on tropical disease solutions" },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-[hsl(210,80%,93%)] flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="h-3.5 w-3.5 text-[hsl(210,80%,45%)]" />
                </div>
                <span className="text-sm text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-xl">
          <img src={researchImg} alt="Research laboratory" className="w-full h-[400px] object-cover" loading="lazy" width={1280} height={864} />
        </div>
      </div>
    </div>
  </section>
);

export default ResearchSection;

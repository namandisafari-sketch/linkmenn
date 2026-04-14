const VisionValues = () => (
  <section className="py-16 md:py-24 bg-muted/30">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="text-2xl md:text-3xl font-bold text-[hsl(140,60%,35%)] mb-4">Our Vision & Values</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          We aim to be established as the best pharmaceutical company in Uganda, recognized for expertise, innovation, and responsible entrepreneurship.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="bg-card border border-border rounded-2xl p-8">
          <h3 className="font-bold text-[hsl(140,60%,35%)] mb-4">Our Vision</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-foreground">•</span> Be highly ranked by healthcare professionals for quality & accountability.</li>
            <li className="flex items-start gap-2"><span className="text-foreground">•</span> Provide an ideal working environment and attract the best talent.</li>
            <li className="flex items-start gap-2"><span className="text-foreground">•</span> Be the partner of choice for leading international pharma companies.</li>
          </ul>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8">
          <h3 className="font-bold text-[hsl(140,60%,35%)] mb-4">Our Core Values</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li><span className="font-semibold text-foreground">Integrity:</span> Guided by ethics, fairness, honesty, and transparency.</li>
            <li><span className="font-semibold text-foreground">Innovation:</span> Thinking beyond the obvious to bring real value.</li>
            <li><span className="font-semibold text-foreground">Excellence:</span> Always striving to do things better.</li>
          </ul>
        </div>
      </div>

      {/* Goals */}
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <h3 className="font-bold text-[hsl(140,60%,35%)] mb-3">Our Goals</h3>
        <p className="text-sm text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          We are committed to advancing community health by focusing 65% of our resources on combating malaria with WHO-prequalified medicines while driving education, prevention, and awareness initiatives to foster a healthier, resilient society.
        </p>
      </div>
    </div>
  </section>
);

export default VisionValues;

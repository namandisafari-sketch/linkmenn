import { useState } from "react";
import { MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ContactSection = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <section id="contact" className="py-16 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Left */}
          <div>
            <span className="inline-block text-xs font-semibold text-[hsl(140,60%,35%)] border border-[hsl(140,60%,35%)] rounded-full px-4 py-1.5 mb-4">
              Get In Touch
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Let's work together</h2>
            <p className="text-muted-foreground mb-8">
              Send us a message, and our team will get back to you as soon as possible. We're eager to explore how we can collaborate.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-[hsl(140,60%,35%)]" />
                <span className="text-sm text-muted-foreground">Wilson Rd, Old Kampala, Uganda</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-[hsl(140,60%,35%)]" />
                <a href="tel:+256758246905" className="text-sm text-[hsl(210,80%,45%)] hover:underline">+256758246905</a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-[hsl(140,60%,35%)]" />
                <a href="mailto:marvinpharmaltd@gmail.com" className="text-sm text-[hsl(210,80%,45%)] hover:underline">marvinpharmaltd@gmail.com</a>
              </div>
            </div>

            <a
              href="https://maps.google.com/?q=Wilson+Rd+Old+Kampala+Uganda"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[hsl(140,60%,35%)] hover:bg-[hsl(140,60%,30%)] text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              View Our Location Map
            </a>
          </div>

          {/* Right: Form */}
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-5">
            <div>
              <label className="text-sm font-semibold text-[hsl(210,80%,45%)] mb-1.5 block">Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[hsl(210,80%,45%)] mb-1.5 block">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[hsl(210,80%,45%)] mb-1.5 block">Message</label>
              <textarea
                placeholder="How can we help?"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-lg bg-[hsl(140,60%,35%)] hover:bg-[hsl(140,60%,30%)] text-white font-semibold">
              Send Message
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;

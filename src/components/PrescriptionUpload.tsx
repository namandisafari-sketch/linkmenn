import { Camera, Upload, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrescriptionUpload = () => (
  <section className="py-12 md:py-16">
    <div className="container">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-accent mb-6">
          <Camera className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Snap & Send Your Prescription</h2>
        <p className="text-muted-foreground mb-8">Upload a photo of your prescription and our pharmacists will review and prepare your order.</p>

        <div className="border-2 border-dashed border-border rounded-2xl p-10 bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer group">
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4 group-hover:text-primary transition-colors" />
          <p className="font-medium mb-1">Drop your prescription here</p>
          <p className="text-sm text-muted-foreground mb-4">or click to browse (JPG, PNG, PDF)</p>
          <Button className="rounded-full">Choose File</Button>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" /> Reviewed by licensed pharmacists</div>
          <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" /> Secure & encrypted</div>
          <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" /> Quick turnaround</div>
        </div>
      </div>
    </div>
  </section>
);

export default PrescriptionUpload;

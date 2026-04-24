import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

const StubPage = ({ title, description }: { title: string; description?: string }) => (
  <Card>
    <CardContent className="pt-12 pb-12 text-center">
      <Construction className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description || "Coming soon."}</p>
    </CardContent>
  </Card>
);

export default StubPage;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logo from "@/assets/marvid-logo.png";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { signIn, isAdmin, loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
    } else {
      toast.success("Welcome back, Admin!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Preparing secure login...</p>
      </div>
    );
  }

  if (user && isAdmin) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-lg p-8 animate-fade-in">
        <div className="text-center mb-8">
          <img src={logo} alt="Marvid" className="h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold flex items-center justify-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Staff Portal
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to manage the pharmacy</p>
          <p className="text-xs text-muted-foreground mt-1">Sessions expire after 15 min of inactivity</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              required
              autoComplete="email"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full rounded-lg" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

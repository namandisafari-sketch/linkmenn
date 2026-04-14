import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/marvid-logo.png";
import { toast } from "sonner";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect when user becomes authenticated
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
        setLoading(false);
      } else {
        toast.success("Welcome back!");
        // Navigation handled by useEffect above
      }
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast.error(error.message);
        setLoading(false);
      } else {
        toast.success("Account created! Please check your email to verify.");
        setLoading(false);
      }
    }
  };

  if (!authLoading && user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4 relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Store
      </Button>

      <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-lg p-8 animate-fade-in">
        <div className="text-center mb-8">
          <img src={logo} alt="Marvid" className="h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold">{mode === "login" ? "Welcome Back" : "Create Account"}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Sign up to start ordering"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            required
            minLength={6}
          />
          <Button type="submit" className="w-full rounded-lg" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button className="text-primary font-medium hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
        <div className="mt-3 text-center">
          <button
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
            onClick={() => navigate("/admin/login")}
          >
            Admin Access →
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

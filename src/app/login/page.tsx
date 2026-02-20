"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            <span className="text-primary">GATE</span>
            <span className="text-foreground">KEEPER</span>
          </h1>
          <p className="text-sm text-muted-foreground tracking-widest uppercase">
            AI Trading Discipline System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="bg-secondary border-border"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-destructive text-sm font-medium">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90"
            >
              {loading ? "Authenticating..." : "Enter"}
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6 italic">
          &quot;Discipline IS the edge.&quot;
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface SettingsData {
  accountBalance: number;
  riskPercentage: number;
  maxTradesPerDay: number;
  maxDailyLosses: number;
  pairs: string[];
  aiProvider: "openai" | "claude";
  openaiApiKey: string;
  claudeApiKey: string;
  accountType: string;
  accountSize: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    accountBalance: 2500,
    riskPercentage: 1,
    maxTradesPerDay: 3,
    maxDailyLosses: 2,
    pairs: ["EURUSD", "GBPUSD", "USDJPY"],
    aiProvider: "openai",
    openaiApiKey: "",
    claudeApiKey: "",
    accountType: "the5ers",
    accountSize: 2500,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/check");
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black tracking-tight mb-8">Settings</h1>

        <div className="space-y-8">
          {/* Account Settings */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-5">
              Account
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Account Type
                </Label>
                <Input
                  value={settings.accountType}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, accountType: e.target.value }))
                  }
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Initial Account Size ($)
                </Label>
                <Input
                  type="number"
                  value={settings.accountSize}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      accountSize: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Current Balance ($)
                </Label>
                <Input
                  type="number"
                  value={settings.accountBalance}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      accountBalance: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Risk Per Trade (%)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.riskPercentage}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      riskPercentage: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="bg-secondary border-border"
                />
              </div>
            </div>
          </div>

          {/* Trading Rules */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-5">
              Trading Rules
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Max Trades Per Day
                </Label>
                <Input
                  type="number"
                  value={settings.maxTradesPerDay}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maxTradesPerDay: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Max Daily Losses (stop trading after)
                </Label>
                <Input
                  type="number"
                  value={settings.maxDailyLosses}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maxDailyLosses: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="bg-secondary border-border"
                />
              </div>
            </div>
          </div>

          {/* AI Provider */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-5">
              AI Provider
            </h2>

            <div className="flex items-center gap-4 mb-6 p-4 bg-secondary/50 rounded-lg">
              <span
                className={`text-sm font-bold ${
                  settings.aiProvider === "openai"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                OpenAI
              </span>
              <Switch
                checked={settings.aiProvider === "claude"}
                onCheckedChange={(checked) =>
                  setSettings((s) => ({
                    ...s,
                    aiProvider: checked ? "claude" : "openai",
                  }))
                }
              />
              <span
                className={`text-sm font-bold ${
                  settings.aiProvider === "claude"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Claude
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  OpenAI API Key
                </Label>
                <Input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, openaiApiKey: e.target.value }))
                  }
                  placeholder="sk-..."
                  className="bg-secondary border-border font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Claude API Key
                </Label>
                <Input
                  type="password"
                  value={settings.claudeApiKey}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, claudeApiKey: e.target.value }))
                  }
                  placeholder="sk-ant-..."
                  className="bg-secondary border-border font-mono text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Currently using:{" "}
              <span className="font-bold text-primary">
                {settings.aiProvider === "openai"
                  ? "OpenAI GPT-5.2"
                  : "Claude Sonnet 4.6"}
              </span>
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground font-bold text-base py-6 hover:bg-primary/90"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

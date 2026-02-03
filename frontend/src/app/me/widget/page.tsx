"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, CheckCircle, AlertTriangle, RefreshCw, Volume2, Monitor } from "lucide-react";
import Link from "next/link";
import { TipWidget } from "@/components/TipWidget";

interface WidgetSettings {
    tts_enabled: boolean;
    background_color: string;
    user_color: string;
    amount_color: string;
    message_color: string;
}

function WidgetSettingsContent() {
    const [settings, setSettings] = useState<WidgetSettings>({
        tts_enabled: false,
        background_color: "#000000",
        user_color: "#ffffff",
        amount_color: "#22c55e",
        message_color: "#ffffff"
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    // Mock User for Preview
    const previewTip = {
        sender: "TopFan123",
        amount: "0.05 ETH",
        message: "Great stream! Keep it up!",
    };

    useEffect(() => {
        const token = localStorage.getItem("user_token");
        if (!token) {
            router.push("/login");
            return;
        }

        // Fetch current settings (via /api/me)
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me?token=` + token)
            .then(res => {
                if (res.status === 401) throw new Error("Unauthorized");
                if (!res.ok) throw new Error("Failed to load profile");
                return res.json();
            })
            .then(data => {
                setSettings({
                    tts_enabled: data.widget_tts || false,
                    background_color: data.widget_bg_color || "#000000",
                    user_color: data.widget_user_color || "#ffffff",
                    amount_color: data.widget_amount_color || "#22c55e",
                    message_color: data.widget_message_color || "#ffffff"
                });
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (err.message === "Unauthorized") {
                    localStorage.removeItem("user_token");
                    router.push("/");
                    return;
                }
                setError("Failed to load settings");
                setLoading(false);
            });
    }, [router]);

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        setError("");

        const token = localStorage.getItem("user_token");
        if (!token) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me/widget`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });

            if (res.status === 401) {
                localStorage.removeItem("user_token");
                router.push("/");
                return;
            }

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save settings");
            }

            setMessage("Widget settings saved successfully!");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const ColorPicker = ({ label, value, onChange, presets = [] }: { label: string, value: string, onChange: (val: string) => void, presets?: string[] }) => (
        <div className="space-y-3">
            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{label}</label>
            {presets.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mb-3">
                    {presets.map((c, i) => (
                        <button
                            key={i}
                            onClick={() => onChange(c)}
                            className={`w-full aspect-square rounded-lg border-2 transition-all relative overflow-hidden ${value === c ? "border-purple-500 scale-110 shadow-lg shadow-purple-900/20" : "border-zinc-800 hover:border-zinc-600"}`}
                            style={{ backgroundColor: c === "#00000000" ? "transparent" : c }}
                            title={c === "#00000000" ? "Transparent" : c}
                        >
                            {c === "#00000000" && (
                                <div className="absolute inset-0 bg-checkerboard opacity-50" style={{ backgroundImage: "conic-gradient(#333 90deg, transparent 90deg)", backgroundSize: "8px 8px" }} />
                            )}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-3 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <div className="relative w-10 h-10 shrink-0">
                    <input
                        type="color"
                        value={value.length === 9 ? "#000000" : value}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                        className="w-full h-full rounded-lg border border-zinc-700 shadow-sm"
                        style={{ backgroundColor: value }}
                    />
                </div>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-mono text-zinc-300 outline-none uppercase placeholder:text-zinc-700"
                    placeholder="#000000"
                />
            </div>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/me" className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-bold">Widget Settings</h1>
                </div>

                {message && (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle size={20} />
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle size={20} />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Settings Form */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-8 h-fit">
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                                <Monitor className="text-blue-400" /> Configuration
                            </h2>

                            <div className="space-y-6">
                                {/* TTS Toggle */}
                                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${settings.tts_enabled ? "bg-purple-500/20 text-purple-400" : "bg-zinc-900 text-zinc-600"}`}>
                                            <Volume2 size={20} />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">Text-to-Speech</div>
                                            <div className="text-xs text-zinc-500">Read donation messages aloud</div>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings.tts_enabled}
                                            onChange={(e) => setSettings({ ...settings, tts_enabled: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>

                                {/* Helper for Color Sections */}
                                <div className="space-y-6">
                                    <ColorPicker
                                        label="Background"
                                        value={settings.background_color}
                                        onChange={(v) => setSettings({ ...settings, background_color: v })}
                                        presets={["#000000", "#18181b", "#0f172a", "#1e1b4b", "#00000000"]}
                                    />

                                    <div className="pt-2 border-t border-zinc-800/50">
                                        <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-wider">Text Colors</h3>
                                        <div className="space-y-6">
                                            <ColorPicker
                                                label="Username Color"
                                                value={settings.user_color}
                                                onChange={(v) => setSettings({ ...settings, user_color: v })}
                                            />
                                            <ColorPicker
                                                label="Amount Color"
                                                value={settings.amount_color}
                                                onChange={(v) => setSettings({ ...settings, amount_color: v })}
                                            />
                                            <ColorPicker
                                                label="Message Color"
                                                value={settings.message_color}
                                                onChange={(v) => setSettings({ ...settings, message_color: v })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-800">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save Settings
                            </button>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            Preview
                        </h2>

                        <div className="bg-checkerboard p-8 rounded-2xl border border-zinc-800 min-h-[400px] flex items-center justify-center overflow-hidden relative">
                            <div className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{
                                    backgroundImage: "conic-gradient(#333 90deg, transparent 90deg)",
                                    backgroundSize: "20px 20px"
                                }}
                            />

                            {/* Simulated Widget */}
                            <div className="relative z-10 animate-in fade-in zoom-in-95 duration-500">
                                <TipWidget
                                    tip={previewTip}
                                    config={settings}
                                    isPreview={true}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-zinc-500 text-center">
                            This is how the widget will appear on your stream. The grey checkerboard background represents transparency (if you set background to transparent).
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function WidgetSettingsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <WidgetSettingsContent />
        </Suspense>
    );
}

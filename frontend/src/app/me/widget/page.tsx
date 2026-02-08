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
    widget_token?: string;
}

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

function WidgetSettingsContent() {
    const [settings, setSettings] = useState<WidgetSettings>({
        tts_enabled: false,
        background_color: "#000000",
        user_color: "#ffffff",
        amount_color: "#22c55e",
        message_color: "#ffffff",
        widget_token: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
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
        // ... (keep useEffect) ...
        const token = localStorage.getItem("user_token");
        if (!token) {
            router.push("/auth");
            return;
        }

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://earth-charleston-firms-horn.trycloudflare.com'}/api/me?token=` + token)
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
                    message_color: data.widget_message_color || "#ffffff",
                    widget_token: data.widget_token
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

    const handleRegenerateClick = () => {
        setShowConfirmModal(true);
    };

    const confirmRegenerate = async () => {
        setShowConfirmModal(false);
        setGenerating(true);
        setMessage("");
        setError("");

        const token = localStorage.getItem("user_token");
        if (!token) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://earth-charleston-firms-horn.trycloudflare.com'}/api/widget/regenerate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                localStorage.removeItem("user_token");
                router.push("/");
                return;
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to regenerate token");

            setSettings(prev => ({ ...prev, widget_token: data.widget_token }));
            setMessage("Widget URL regenerated successfully!");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        // ... (keep existing logic, assuming it's unchanged) ...
        setSaving(true);
        setMessage("");
        setError("");

        const token = localStorage.getItem("user_token");
        if (!token) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://earth-charleston-firms-horn.trycloudflare.com'}/api/widget`, {
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



    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 relative">
            {/* Global Gradient Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/10 pointer-events-none" />

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 mb-4 mx-auto border border-red-500/20">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-center mb-2">Regenerate URL?</h3>
                        <p className="text-zinc-400 text-center text-sm mb-6">
                            This will immediately invalidate your current Widget URL. You will need to update your streaming software with the new URL.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors border border-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRegenerate}
                                className="flex-1 p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-900/20 transition-all"
                            >
                                Regenerate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-8 relative z-10">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/me" className="p-2 rounded-full bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Widget Settings</h1>
                </div>

                {message && (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm">
                        <CheckCircle size={20} />
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm">
                        <AlertTriangle size={20} />
                        {error}
                    </div>
                )}

                {/* Widget URL Section - Moved to Top */}
                <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Widget URL (Private)</h3>
                        <div className="flex items-center gap-2 bg-black/50 p-3 rounded-xl border border-white/5 font-mono text-sm text-zinc-300 break-all shadow-inner">
                            {window.location.origin}/widget/{settings.widget_token || '...'}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                            Add this URL as a Browser Source in your streaming software (OBS, Streamlabs). Keep it private.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-white/5 shadow-sm">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/widget/${settings.widget_token || settings.widget_token}`);
                                setMessage("URL Copied!");
                                setTimeout(() => setMessage(""), 2000);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all font-semibold text-sm whitespace-nowrap border border-zinc-700 hover:border-zinc-600"
                        >
                            Copy URL
                        </button>
                        <button
                            onClick={handleRegenerateClick}
                            disabled={generating}
                            title="Regenerate URL"
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/40 transition-all"
                        >
                            <RefreshCw size={18} className={generating ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                    {/* Left Column: Configuration */}
                    <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 space-y-8 shadow-2xl">
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                                <Monitor className="text-blue-400" /> Configuration
                            </h2>

                            <div className="space-y-6">
                                {/* TTS Toggle */}
                                <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${settings.tts_enabled ? "bg-purple-500/20 text-purple-400" : "bg-zinc-900/50 text-zinc-600"}`}>
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
                                        <div className="w-11 h-6 bg-zinc-800/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-blue-600"></div>
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

                                    <div className="pt-2 border-t border-white/5">
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

                        <div className="pt-4 border-t border-white/5">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold uppercase tracking-wide transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <span className="w-5 h-5 border-2 border-zinc-300 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save Settings
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Preview */}
                    <div className="space-y-6 lg:sticky lg:top-8 h-fit">
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                                Preview
                            </h2>

                            <div className="bg-checkerboard p-8 rounded-xl border border-white/5 min-h-[400px] flex items-center justify-center overflow-hidden relative shadow-inner bg-black/20">
                                <div className="absolute inset-0 opacity-20 pointer-events-none"
                                    style={{
                                        backgroundImage: "conic-gradient(#333 90deg, transparent 90deg)",
                                        backgroundSize: "20px 20px"
                                    }}
                                />

                                {/* Simulated Widget */}
                                <div className="relative z-10 animate-in fade-in zoom-in-95 duration-500 w-full flex justify-center">
                                    <TipWidget
                                        tip={previewTip}
                                        config={settings}
                                        isPreview={true}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-zinc-500 text-center mt-4">
                                This is how the widget will appear on your stream. The checkerboard represents transparency.
                            </p>
                        </div>
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

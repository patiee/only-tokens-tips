"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useEnsName, useEnsAvatar as useEnsAvatarHook, useEnsText } from "wagmi";
import { User, Image as ImageIcon, FileText, Check, Save, Loader2, Twitch, Monitor, Chrome, AlertTriangle, ArrowLeft, Upload, Settings } from "lucide-react";

function FieldSettings({ label, hasDNS, useDNS, onToggle }: { label: string, hasDNS: boolean, useDNS: boolean, onToggle: (useDNS: boolean) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!hasDNS) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-300"
            >
                <Settings size={14} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 space-y-1">
                        <button
                            type="button"
                            onClick={() => { onToggle(true); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${useDNS ? "bg-purple-500/10 text-purple-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
                        >
                            <span>Use ENS {label}</span>
                            {useDNS && <Check size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => { onToggle(false); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!useDNS ? "bg-purple-500/10 text-purple-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
                        >
                            <span>Edit Manually</span>
                            {!useDNS && <Check size={14} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [formData, setFormData] = useState({
        username: "",
        description: "",
        avatar_url: "",
        background_url: ""
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // ENS Hooks
    const { address: evmAddress, isConnected: isEVMConnected } = useAccount();
    const { data: ensName } = useEnsName({ address: evmAddress });
    const { data: ensAvatar } = useEnsAvatarHook({ name: ensName! });
    const { data: ensDescription } = useEnsText({ name: ensName!, key: 'description' });
    const { data: ensHeader } = useEnsText({ name: ensName!, key: 'header' });

    // ENS Toggles State
    const [useEnsUsername, setUseEnsUsername] = useState(false);
    const [useEnsAvatar, setUseEnsAvatar] = useState(false);
    const [useEnsBackground, setUseEnsBackground] = useState(false);
    const [useEnsDescription, setUseEnsDescription] = useState(false);

    // Effect to enforce ENS values when toggles are on
    useEffect(() => {
        if (useEnsUsername && ensName) setFormData(prev => ({ ...prev, username: ensName }));
        if (useEnsAvatar && ensAvatar) setFormData(prev => ({ ...prev, avatar_url: ensAvatar }));
        if (useEnsBackground && ensHeader) setFormData(prev => ({ ...prev, background_url: ensHeader }));
        if (useEnsDescription && ensDescription) setFormData(prev => ({ ...prev, description: ensDescription }));
    }, [useEnsUsername, useEnsAvatar, useEnsBackground, useEnsDescription, ensName, ensAvatar, ensHeader, ensDescription]);

    useEffect(() => {
        const token = localStorage.getItem("user_token");
        if (!token) {
            router.push("/");
            return;
        }

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me?token=${token}`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("Failed to fetch profile");
            })
            .then(data => {
                setProfile(data);
                setFormData({
                    username: data.username || "",
                    description: data.description || "",
                    avatar_url: data.avatar_url || "",
                    background_url: data.background_url || ""
                });

                // Initialize toggles
                setUseEnsUsername(data.use_ens_username || false);
                setUseEnsAvatar(data.use_ens_avatar || false);
                setUseEnsBackground(data.use_ens_background || false);
                setUseEnsDescription(data.use_ens_description || false);

                // Initialize toggles based on if current data matches ENS data
                // Or just default to false unless user explicitly turns it on? 
                // For existing users, maybe manual is better.
                // But if they have ENS, we can show the option.
            })
            .catch(() => {
                localStorage.removeItem("user_token");
                router.push("/auth");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.target.name === 'username' && useEnsUsername) return;
        if (e.target.name === 'description' && useEnsDescription) return;
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setSaving(true);

        const token = localStorage.getItem("user_token");
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    use_ens_username: useEnsUsername,
                    use_ens_avatar: useEnsAvatar,
                    use_ens_background: useEnsBackground,
                    use_ens_description: useEnsDescription
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: "Profile updated successfully" });
            } else {
                setMessage({ type: 'error', text: data.error || "Failed to update profile" });
            }
        } catch (error) {
            setMessage({ type: 'error', text: "An error occurred" });
        } finally {
            setSaving(false);
        }
    };

    const handleSocialConnect = async (provider: string) => {
        const token = localStorage.getItem("user_token");
        if (!token) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/${provider}/login?link=true`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert("Failed to initiate linking: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            alert("Error connecting to server");
        }
    };

    const isConnected = (p: string) => profile?.connected_providers?.includes(p);

    const handleFileUpload = async (file: File, type: 'avatar' | 'background') => {
        if (type === 'avatar' && useEnsAvatar) return;
        if (type === 'background' && useEnsBackground) return;

        const token = localStorage.getItem("user_token");
        if (!token) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            if (type === 'avatar') {
                setFormData(prev => ({ ...prev, avatar_url: data.url }));
            } else {
                setFormData(prev => ({ ...prev, background_url: data.url }));
            }
            setMessage({ type: 'success', text: "Image uploaded successfully" });
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: "Failed to upload image" });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="animate-spin text-zinc-500" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 relative mb-20">
            {/* Global Gradient Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/10 pointer-events-none" />

            <div className="max-w-4xl mx-auto space-y-8 p-6 md:p-12 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <header className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Link href="/me" className="p-2 rounded-full bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                            Account Settings
                        </h1>
                    </div>
                    <p className="text-zinc-400 pl-[52px]">Manage your profile details and social connections.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Left Col: Edit Profile Form */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <User className="text-blue-400" size={20} /> Edit Profile
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">

                                {/* Profile Images Section */}
                                <div className="space-y-4 mb-8">
                                    <div className="relative group">
                                        {/* Background Image */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Cover Image</label>
                                                <FieldSettings
                                                    label="Cover"
                                                    hasDNS={!!ensHeader}
                                                    useDNS={useEnsBackground}
                                                    onToggle={setUseEnsBackground}
                                                />
                                            </div>
                                            <div
                                                className={`w-full h-48 rounded-2xl bg-black/50 border overflow-hidden relative transition-all ${useEnsBackground ? "border-purple-500/50 cursor-default" : "border-white/5 cursor-pointer hover:border-white/10"}`}
                                                onClick={() => !useEnsBackground && document.getElementById('bg-upload')?.click()}
                                            >
                                                {formData.background_url ? (
                                                    <img src={formData.background_url} alt="Background" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                                                        <FileText size={32} />
                                                        <span className="text-xs font-bold uppercase tracking-wider">Upload Cover</span>
                                                    </div>
                                                )}

                                                {!useEnsBackground && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="bg-black/50 backdrop-blur-sm p-3 rounded-full border border-white/10">
                                                            <Upload className="text-white" size={24} />
                                                        </div>
                                                    </div>
                                                )}
                                                <input
                                                    id="bg-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    disabled={useEnsBackground}
                                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'background')}
                                                />
                                            </div>
                                        </div>

                                        {/* Avatar Image (Overlapping) */}
                                        <div className="absolute -bottom-10 left-6">
                                            <div className="relative">
                                                <div
                                                    className={`w-24 h-24 rounded-full border-4 border-black bg-zinc-900 overflow-hidden relative shadow-xl z-20 ${useEnsAvatar ? "cursor-default" : "cursor-pointer group/avatar"}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!useEnsAvatar) document.getElementById('avatar-upload')?.click();
                                                    }}
                                                >
                                                    {formData.avatar_url ? (
                                                        <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                                            <User size={32} />
                                                        </div>
                                                    )}
                                                    {!useEnsAvatar && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                                                            <Upload className="text-white" size={20} />
                                                        </div>
                                                    )}
                                                    <input
                                                        id="avatar-upload"
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        disabled={useEnsAvatar}
                                                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'avatar')}
                                                    />
                                                </div>
                                                {/* Settings Button for Avatar */}
                                                <div className="absolute -right-8 top-0 bg-black/50 rounded-lg backdrop-blur-md border border-white/10">
                                                    <FieldSettings
                                                        label="Avatar"
                                                        hasDNS={!!ensAvatar}
                                                        useDNS={useEnsAvatar}
                                                        onToggle={setUseEnsAvatar}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Spacer for overlapping avatar */}
                                    <div className="h-6"></div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Username</label>
                                            <FieldSettings
                                                label="Name"
                                                hasDNS={!!ensName}
                                                useDNS={useEnsUsername}
                                                onToggle={(val) => {
                                                    setUseEnsUsername(val);
                                                    if (val && ensName) setFormData(prev => ({ ...prev, username: ensName }));
                                                }}
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            disabled={useEnsUsername}
                                            className={`w-full bg-black/50 border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-zinc-700 ${useEnsUsername
                                                ? "border-purple-500/50 text-purple-200 cursor-not-allowed bg-purple-900/10"
                                                : "border-white/5 focus:border-purple-500/50"
                                                }`}
                                            placeholder="Username"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Description</label>
                                            <FieldSettings
                                                label="Bio"
                                                hasDNS={!!ensDescription}
                                                useDNS={useEnsDescription}
                                                onToggle={(val) => {
                                                    setUseEnsDescription(val);
                                                    if (val && ensDescription) setFormData(prev => ({ ...prev, description: ensDescription }));
                                                }}
                                            />
                                        </div>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            disabled={useEnsDescription}
                                            rows={3}
                                            className={`w-full bg-black/50 border rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-zinc-700 resize-none ${useEnsDescription
                                                ? "border-purple-500/50 text-purple-200 cursor-not-allowed bg-purple-900/10"
                                                : "border-white/5 focus:border-purple-500/50"
                                                }`}
                                            placeholder="Tell us about yourself..."
                                        />
                                    </div>
                                </div>

                                {message && (
                                    <div className={`p-4 rounded-xl text-sm font-medium border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                                        }`}>
                                        {message.text}
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-black uppercase tracking-wide font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Right Col: Social Connections */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Monitor className="text-purple-400" size={20} /> Connected Accounts
                            </h2>

                            <div className="space-y-4">
                                {isConnected('google') ? (
                                    <button disabled className="w-full flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-zinc-500 text-sm font-bold cursor-default">
                                        <div className="flex items-center gap-3">
                                            <Chrome size={18} /> Google
                                        </div>
                                        <Check size={16} className="text-green-500" />
                                    </button>
                                ) : (
                                    <button onClick={() => handleSocialConnect("google")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-800 transition-all text-sm font-medium text-zinc-300 hover:text-white">
                                        <Chrome className="text-white" size={18} /> Connect Google
                                    </button>
                                )}

                                {isConnected('twitch') ? (
                                    <button disabled className="w-full flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-zinc-500 text-sm font-bold cursor-default">
                                        <div className="flex items-center gap-3">
                                            <Twitch size={18} /> Twitch
                                        </div>
                                        <Check size={16} className="text-green-500" />
                                    </button>
                                ) : (
                                    <button onClick={() => handleSocialConnect("twitch")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:bg-[#9146FF]/10 hover:border-[#9146FF]/30 hover:text-[#9146FF] transition-all text-sm font-medium text-zinc-300">
                                        <Twitch className="text-[#9146FF]" size={18} /> Connect Twitch
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

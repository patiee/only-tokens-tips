"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// ... (Previous imports)
import { User, Image as ImageIcon, FileText, Check, Save, Loader2, Twitch, Monitor, Chrome, AlertTriangle, ArrowLeft, Upload } from "lucide-react";

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
            })
            .catch(() => {
                localStorage.removeItem("user_token");
                router.push("/auth");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
                body: JSON.stringify(formData)
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

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="animate-spin text-zinc-500" size={32} />
            </div>
        );
    }

    const isConnected = (p: string) => profile?.connected_providers?.includes(p);

    const handleFileUpload = async (file: File, type: 'avatar' | 'background') => {
        const token = localStorage.getItem("user_token");
        if (!token) return;

        // Optimistic UI could show uploading state but let's keep it simple
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

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12 mb-20">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <header>
                    <button
                        onClick={() => router.push("/me")}
                        className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                        Account Settings
                    </h1>
                    <p className="text-zinc-400 mt-2">Manage your profile details and social connections.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Left Col: Edit Profile Form */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <User className="text-blue-400" size={20} /> Edit Profile
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">

                                {/* Profile Images Section */}
                                <div className="space-y-4 mb-8">
                                    <div className="relative group">
                                        {/* Background Image */}
                                        <div
                                            className="w-full h-48 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden cursor-pointer relative"
                                            onClick={() => document.getElementById('bg-upload')?.click()}
                                        >
                                            {formData.background_url ? (
                                                <img src={formData.background_url} alt="Background" className="w-full h-full object-cover transition-opacity group-hover:opacity-75" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                                                    <FileText size={32} />
                                                    <span className="text-xs font-bold uppercase tracking-wider">Upload Cover</span>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-black/50 backdrop-blur-sm p-3 rounded-full">
                                                    <Upload className="text-white" size={24} />
                                                </div>
                                            </div>
                                            <input
                                                id="bg-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'background')}
                                            />
                                        </div>

                                        {/* Avatar Image (Overlapping) */}
                                        <div
                                            className="absolute -bottom-10 left-6 w-24 h-24 rounded-full border-4 border-zinc-900 bg-zinc-800 overflow-hidden cursor-pointer group/avatar"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                document.getElementById('avatar-upload')?.click();
                                            }}
                                        >
                                            {formData.avatar_url ? (
                                                <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover transition-opacity group-hover/avatar:opacity-75" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                                    <User size={32} />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/30">
                                                <Upload className="text-white" size={20} />
                                            </div>
                                            <input
                                                id="avatar-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'avatar')}
                                            />
                                        </div>
                                    </div>

                                    {/* Spacer for overlapping avatar */}
                                    <div className="h-6"></div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Username</label>
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-700"
                                            placeholder="Username"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Description</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            rows={3}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-700 resize-none"
                                            placeholder="Tell us about yourself..."
                                        />
                                    </div>
                                </div>

                                {message && (
                                    <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {message.text}
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
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
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Monitor className="text-purple-400" size={20} /> Connected Accounts
                            </h2>

                            <div className="space-y-4">
                                {isConnected('google') ? (
                                    <button disabled className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500 text-sm font-bold cursor-default">
                                        <div className="flex items-center gap-3">
                                            <Chrome size={18} /> Google Connected
                                        </div>
                                        <Check size={16} className="text-green-500" />
                                    </button>
                                ) : (
                                    <button onClick={() => handleSocialConnect("google")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-sm font-medium text-zinc-300">
                                        <Chrome className="text-white" size={18} /> Connect Google
                                    </button>
                                )}

                                {isConnected('twitch') ? (
                                    <button disabled className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500 text-sm font-bold cursor-default">
                                        <div className="flex items-center gap-3">
                                            <Twitch size={18} /> Twitch Connected
                                        </div>
                                        <Check size={16} className="text-green-500" />
                                    </button>
                                ) : (
                                    <button onClick={() => handleSocialConnect("twitch")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-[#9146FF]/10 hover:border-[#9146FF]/30 hover:text-[#9146FF] transition-all text-sm font-medium text-zinc-300">
                                        <Twitch className="text-[#9146FF]" size={18} /> Connect Twitch
                                    </button>
                                )}

                                {isConnected('kick') ? (
                                    <button disabled className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500 text-sm font-bold cursor-default">
                                        <div className="flex items-center gap-3">
                                            <Monitor size={18} /> Kick Connected
                                        </div>
                                        <Check size={16} className="text-green-500" />
                                    </button>
                                ) : (
                                    <button onClick={() => handleSocialConnect("kick")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-[#53FC18]/10 hover:border-[#53FC18]/30 hover:text-[#53FC18] transition-all text-sm font-medium text-zinc-300">
                                        <Monitor className="text-[#53FC18]" size={18} /> Connect Kick
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

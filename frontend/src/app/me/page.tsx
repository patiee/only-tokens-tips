"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet, User as UserIcon, Copy, Check, DollarSign, TrendingUp, ExternalLink, ChevronRight } from "lucide-react";
import Link from "next/link";

export type UserProfile = {
    username: string;
    wallet_address: string;

    name?: string;
    avatar_url?: string;
    widget_token?: string;
};

function DashboardContent() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [copied, setCopied] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [error, setError] = useState("");
    const [tips, setTips] = useState<any[]>([]);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        console.log("Dashboard mounted");
        const urlToken = searchParams.get("token");

        // If token is in URL (from Login redirect), save it and clean URL
        if (urlToken) {
            console.log("New token detected, saving and refreshing...");
            localStorage.setItem("user_token", urlToken);
            router.replace("/me"); // This will trigger useEffect again with clean URL
            return;
        }

        const token = localStorage.getItem("user_token");

        if (!token) {
            // Keep redirect for missing token, but maybe add delay?
            router.push("/auth");
            return;
        }

        setError("");
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me?token=` + token)
            .then(res => {
                if (!res.ok) {
                    if (res.status === 401) throw new Error("Unauthorized (Invalid Token)");
                    throw new Error(`Failed to fetch profile (${res.status})`);
                }
                return res.json();
            })
            .then(data => setProfile(data))
            .catch(err => {
                console.error("Failed to fetch profile", err);
                if (err.message.includes("Unauthorized")) {
                    localStorage.removeItem("user_token"); // Clear invalid token
                    router.push("/");
                    return;
                }
                setError(err.message || "Connection failed");
            });

        // Fetch Recent Tips
        // Use default limit=10, no cursor for initial load
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me/tips?limit=10`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
            .then(res => {
                if (res.status === 401) {
                    // trigger catch block
                    throw new Error("Unauthorized");
                }
                return res.json();
            })
            .then(data => {
                // Handle new response format { tips: [], next_cursor: "..." }
                if (data.tips && Array.isArray(data.tips)) {
                    setTips(data.tips);
                } else if (Array.isArray(data)) {
                    // Fallback for old API if needed (though we changed it)
                    setTips(data);
                }
            })
            .catch(err => {
                if (err.message === "Unauthorized") {
                    localStorage.removeItem("user_token");
                    router.push("/");
                }
                console.error(err);
            });
    }, [router, searchParams]);

    const copyToClipboard = () => {
        if (!profile) return;
        const url = `${window.location.origin}/widget/${profile.widget_token || profile.username}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyLinkToClipboard = () => {
        if (!profile) return;
        const url = `${window.location.origin}/${profile.username}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
            <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl max-w-md w-full text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="text-red-500" size={32} />
                </div>
                <h2 className="text-xl font-bold mb-2 text-white">Dashboard Access Failed</h2>
                <p className="text-zinc-400 mb-6 font-mono text-sm bg-black/50 p-2 rounded border border-zinc-800 break-all">
                    {error}
                </p>

                <p className="text-zinc-500 text-xs mb-6">
                    If "Connection failed", ensure backend is running or accept the self-signed certificate.
                </p>

                <div className="flex gap-3 justify-center">
                    <a href={`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me`} target="_blank" className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-sm">
                        Test Connection
                    </a>
                    <button
                        onClick={() => { localStorage.removeItem("user_token"); router.push("/auth"); }}
                        className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 text-sm font-bold"
                    >
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-zinc-500 text-sm animate-pulse">Loading dashboard...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 relative">
            {/* Global Gradient Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/10 pointer-events-none" />

            <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 relative z-10">

                {/* Header */}
                <header className="flex flex-col sm:flex-row items-center gap-8 py-8 border-b border-white/5">
                    <div className="relative group">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                        <div className="relative w-28 h-28 bg-zinc-900/80 backdrop-blur-sm rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden border-4 border-black/50 shadow-2xl">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                profile.username[0]?.toUpperCase()
                            )}
                        </div>
                    </div>

                    <div className="text-center sm:text-left flex-1 space-y-2">
                        <h1 className="text-5xl sm:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-zinc-500 tracking-tight">
                            Hello, {profile.name || profile.username}
                        </h1>
                        <p className="text-zinc-400 font-medium text-lg">
                            Welcome back to your creator dashboard.
                        </p>
                    </div>
                </header>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Col: Setup & Wallet */}
                    <div className="space-y-6">

                        {/* Public Page Card */}
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-all duration-500" />
                            <div className="flex justify-between items-start mb-6 relative">
                                <h3 className="text-xl font-bold flex items-center gap-3 text-white">
                                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                                        <ExternalLink size={20} />
                                    </div>
                                    Public Page
                                </h3>
                                <Link
                                    href={`/${profile.username}`}
                                    target="_blank"
                                    className="text-xs font-bold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-full transition-all border border-blue-500/10 hover:border-blue-500/30"
                                >
                                    View Live
                                </Link>
                            </div>
                            <p className="text-zinc-400 text-sm mb-6 font-medium leading-relaxed max-w-[90%]">
                                Share this unique link with your viewers to start receiving tips directly.
                            </p>

                            <div className="flex gap-2 relative">
                                <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-xs text-zinc-400 font-mono truncate flex-1 shadow-inner">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/${profile.username}` : `.../${profile.username}`}
                                </div>
                                <button
                                    onClick={copyLinkToClipboard}
                                    className={`p-3.5 rounded-xl border transition-all duration-300 shadow-lg ${copiedLink ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/5 border-white/5 hover:bg-white/10 text-white"}`}
                                >
                                    {copiedLink ? <Check size={18} strokeWidth={3} /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Widget Card */}
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all duration-500" />
                            <div className="flex justify-between items-start mb-6 relative">
                                <h3 className="text-xl font-bold flex items-center gap-3 text-white">
                                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                                        <TrendingUp size={20} />
                                    </div>
                                    Overlay Widget
                                </h3>
                                <Link
                                    href="/me/widget"
                                    className="text-xs font-bold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-full transition-all border border-purple-500/10 hover:border-purple-500/30"
                                >
                                    Configure
                                </Link>
                            </div>
                            <p className="text-zinc-400 text-sm mb-6 font-medium leading-relaxed max-w-[90%]">
                                Add this URL as a Browser Source in OBS to display real-time tip alerts.
                            </p>

                            <div className="flex gap-2 relative">
                                <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-xs text-zinc-400 font-mono truncate flex-1 shadow-inner">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/widget/${profile.widget_token || profile.username}` : `.../widget/${profile.widget_token || profile.username}`}
                                </div>
                                <button
                                    onClick={copyToClipboard}
                                    className={`p-3.5 rounded-xl border transition-all duration-300 shadow-lg ${copied ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/5 border-white/5 hover:bg-white/10 text-white"}`}
                                >
                                    {copied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Wallet Card */}
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-3 text-white">
                                    <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400">
                                        <Wallet size={20} />
                                    </div>
                                    Wallet
                                </h3>
                                <Link
                                    href="/me/wallet"
                                    className="text-xs font-bold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full transition-all border border-white/5"
                                >
                                    Manage
                                </Link>
                            </div>
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex items-center justify-between group transition-colors shadow-inner">
                                <div className="font-mono text-sm text-zinc-300 truncate tracking-tight">
                                    {profile.wallet_address}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Recent Activity */}
                    <div className="lg:col-span-2">
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 h-full min-h-[500px] flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[100px] rounded-full pointer-events-none" />

                            <div className="flex justify-between items-center mb-8 relative">
                                <h3 className="text-2xl font-bold flex items-center gap-3 text-white">
                                    <div className="p-2 rounded-xl bg-green-500/10 text-green-400">
                                        <DollarSign size={24} />
                                    </div>
                                    Recent Tips
                                    {tips.length > 0 && <span className="ml-2 text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20">{tips.length}</span>}
                                </h3>
                                <Link
                                    href="/me/tips"
                                    className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/5"
                                >
                                    View All <ChevronRight size={14} strokeWidth={3} />
                                </Link>
                            </div>

                            {tips.length === 0 ? (
                                <div className="flex flex-col items-center justify-center flex-1 w-full text-zinc-500 gap-6 border-2 border-dashed border-white/5 rounded-2xl bg-black/20 h-full min-h-[300px]">
                                    <div className="w-20 h-20 rounded-full bg-zinc-900/50 flex items-center justify-center shadow-2xl border border-white/5">
                                        <DollarSign size={32} className="text-zinc-600" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-zinc-300 font-medium text-lg">No tips received yet</p>
                                        <p className="text-zinc-500 text-sm">Share your public link to start earning!</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto -mx-4 sm:mx-0">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                                <th className="py-4 px-4 font-black">Date</th>
                                                <th className="py-4 px-4 font-black">Sender</th>
                                                <th className="py-4 px-4 font-black">Amount</th>
                                                <th className="py-4 px-4 font-black">Message</th>
                                                <th className="py-4 px-4 font-black">Tx Hash</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-white/5">
                                            {tips.map((tip, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                    <td className="py-4 px-4 text-zinc-500 font-medium whitespace-nowrap">
                                                        {new Date(tip.created_at).toLocaleDateString()} <span className="text-zinc-600 mx-1">•</span> {new Date(tip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-white group-hover:text-purple-300 transition-colors">{tip.sender}</td>
                                                    <td className="py-4 px-4 text-green-400 font-black font-mono tracking-tight bg-green-500/5 rounded-lg">
                                                        {tip.amount} <span className="text-green-500/70 text-xs ml-0.5">{tip.asset || "ETH"}</span>
                                                    </td>
                                                    <td className="py-4 px-4 text-zinc-300 break-words whitespace-normal min-w-[200px] italic">
                                                        "{tip.message}"
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        {tip.tx_hash ? (
                                                            <a
                                                                href={`https://basescan.org/tx/${tip.tx_hash}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-purple-400 hover:text-purple-300 text-[10px] font-bold bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all inline-flex items-center gap-1 uppercase tracking-wider"
                                                            >
                                                                Verify <ExternalLink size={10} />
                                                            </a>
                                                        ) : <span className="text-zinc-700">-</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}

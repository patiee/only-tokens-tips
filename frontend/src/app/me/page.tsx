"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet, User as UserIcon, Copy, Check, DollarSign, TrendingUp, ExternalLink } from "lucide-react";
import Link from "next/link";

export type UserProfile = {
    username: string;
    eth_address: string;
    main_wallet: boolean;
    name?: string;
    avatar_url?: string;
};

function DashboardContent() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [copied, setCopied] = useState(false);
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
            router.push("/signup");
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
        const url = `${window.location.origin}/widget/${profile.username}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
                        onClick={() => { localStorage.removeItem("user_token"); router.push("/login"); }}
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
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex flex-col sm:flex-row items-center gap-6 border-b border-zinc-800 pb-8">
                    <div className="relative">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 blur opacity-75"></div>
                        <div className="relative w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden border-4 border-black">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                profile.username[0]?.toUpperCase()
                            )}
                        </div>
                    </div>

                    <div className="text-center sm:text-left flex-1">
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-500">
                            Hello, {profile.name || profile.username}
                        </h1>
                        <p className="text-zinc-400 mt-1 flex items-center justify-center sm:justify-start gap-2">
                            <UserIcon size={16} /> @{profile.username}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href={`/${profile.username}`}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-zinc-700"
                        >
                            <ExternalLink size={16} /> Public Page
                        </Link>
                        <button
                            onClick={() => {
                                localStorage.removeItem("user_token");
                                router.push("/");
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg font-medium transition-colors border border-red-500/20"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Col: Setup & Wallet */}
                    <div className="space-y-8">
                        {/* Widget Card */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all" />
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <TrendingUp className="text-purple-400" /> Overlay Widget
                                </h3>
                                <Link
                                    href="/me/widget"
                                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 bg-purple-900/20 hover:bg-purple-900/30 px-3 py-1.5 rounded-full transition-colors"
                                >
                                    Edit
                                </Link>
                            </div>
                            <p className="text-zinc-400 text-sm mb-4">
                                Add this URL as a Browser Source in OBS to show tips on stream.
                            </p>

                            <div className="flex gap-2">
                                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-500 font-mono truncate flex-1">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/widget/${profile.username}` : `.../widget/${profile.username}`}
                                </div>
                                <button
                                    onClick={copyToClipboard}
                                    className={`p-3 rounded-lg border transition-all ${copied ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"}`}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Wallet className="text-blue-400" /> Wallet
                                </h3>
                                <Link
                                    href="/me/wallets"
                                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/30 px-3 py-1.5 rounded-full transition-colors"
                                >
                                    Edit
                                </Link>
                            </div>
                            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 flex items-center justify-between group cursor-pointer hover:border-zinc-700 transition-colors">
                                <div className="font-mono text-sm text-zinc-300 truncate pr-4">
                                    {profile.eth_address}
                                </div>
                                {profile.main_wallet && (
                                    <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-[10px] rounded border border-blue-800 uppercase font-bold tracking-wider">
                                        Main
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Recent Activity (Placeholder) */}
                    <div className="lg:col-span-2">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-full min-h-[400px]">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <DollarSign className="text-green-400" /> Recent Tips
                                {tips.length > 0 && <span className="text-xs font-normal text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">{tips.length}</span>}
                            </h3>

                            {tips.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-4 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/50">
                                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <DollarSign size={24} className="text-zinc-600" />
                                    </div>
                                    <p>No tips yet. Share your link to get started!</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                                <th className="py-3 px-4">Date</th>
                                                <th className="py-3 px-4">Sender</th>
                                                <th className="py-3 px-4">Amount</th>
                                                <th className="py-3 px-4">Message</th>
                                                <th className="py-3 px-4">Tx Hash</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-zinc-800/50">
                                            {tips.map((tip, i) => (
                                                <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                                                    <td className="py-3 px-4 text-zinc-400">
                                                        {new Date(tip.created_at).toLocaleDateString()} {new Date(tip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="py-3 px-4 font-medium text-white">{tip.sender}</td>
                                                    <td className="py-3 px-4 text-green-400 font-mono">
                                                        {tip.amount} {tip.asset || "ETH"}
                                                    </td>
                                                    <td className="py-3 px-4 text-zinc-300 break-words whitespace-normal min-w-[200px]">
                                                        {tip.message}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {tip.tx_hash ? (
                                                            <a
                                                                href={`https://basescan.org/tx/${tip.tx_hash}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-purple-400 hover:text-purple-300 text-xs bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20"
                                                            >
                                                                View
                                                            </a>
                                                        ) : <span className="text-zinc-600">-</span>}
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

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
    avatar?: string;
};

function DashboardContent() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        let token = searchParams.get("token");

        if (token) {
            localStorage.setItem("user_token", token);
            // Clear token from URL to be clean (optional, but nice)
            window.history.replaceState({}, "", "/me");
        } else {
            token = localStorage.getItem("user_token");
        }

        if (!token) {
            router.push("/signup");
            return;
        }

        fetch("https://localhost:8080/api/me?token=" + token)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch");
                return res.json();
            })
            .then(data => setProfile(data))
            .catch(err => {
                console.log("Failed to fetch profile", err);
                // If token is invalid (401), maybe redirect to signup?
                if (token) localStorage.removeItem("user_token");
                router.push("/signup");
            });

    }, [router, searchParams]);

    const copyToClipboard = () => {
        if (!profile) return;
        const url = `${window.location.origin}/widget/${profile.username}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                            {profile.avatar ? (
                                <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
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
                    </div>
                </header>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Col: Setup & Wallet */}
                    <div className="space-y-8">
                        {/* Widget Card */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all" />
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <TrendingUp className="text-purple-400" /> Overlay Widget
                            </h3>
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

                        {/* Wallet Card */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Wallet className="text-blue-400" /> Wallet
                            </h3>
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
                            </h3>

                            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-4 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/50">
                                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                                    <DollarSign size={24} className="text-zinc-600" />
                                </div>
                                <p>No tips yet. Share your link to get started!</p>
                            </div>
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

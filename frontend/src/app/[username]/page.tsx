"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { LifiTip } from "@/components/LifiTip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowLeft, ExternalLink, Globe, Twitter } from "lucide-react";
import Link from "next/link";

// Define interface matching backend/db/model/model.go
interface PublicUserProfile {
    id: number;
    username: string;
    wallet_address: string;
    avatar_url: string;
    preferred_chain_id?: number;
    preferred_asset_address?: string;
    description?: string;
    background_url?: string;
    provider?: string;
    connected_providers?: string[];
    widget_tts?: boolean;
    widget_bg_color?: string;
    widget_user_color?: string;
    widget_amount_color?: string;
    widget_message_color?: string;
}

export default function TipPage() {
    const params = useParams();
    const username = params.username as string;

    const [user, setUser] = useState<PublicUserProfile | null>(null);
    const [status, setStatus] = useState("");

    // Fetch streamer details
    useEffect(() => {
        const safeUsername = decodeURIComponent(username);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/user/${safeUsername}`)
            .then(res => {
                if (!res.ok) throw new Error("User not found");
                return res.json();
            })
            .then(data => setUser(data))
            .catch(console.error);
    }, [username]);

    const notifyBackend = useCallback((data: {
        txHash: string;
        amount: string;
        message: string;
        sender: string;
        asset: string;
        sourceChain: string;
        destChain: string;
        sourceAddress: string;
        destAddress: string;
        token: string;
    }) => {
        if (!data.txHash) return;
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/tip`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${data.token}`
            },
            body: JSON.stringify({
                streamerId: username,
                sender: data.sender || "Anonymous",
                message: data.message,
                amount: data.amount,
                txHash: data.txHash,
                asset: data.asset,
                chainId: data.sourceChain, // Use source chain as main ChainID for record
                sourceChain: data.sourceChain,
                destChain: data.destChain,
                sourceAddress: data.sourceAddress,
                destAddress: data.destAddress,
            }),
        }).catch(console.error);
    }, [username]);

    const handleSuccess = useCallback((data: any) => {
        // Map LifiTip data to backend params (rename senderName -> sender, include token)
        notifyBackend({ ...data, sender: data.senderName, token: data.token });
        setStatus("Tip submitted! Waiting for confirmation...");
    }, [notifyBackend]);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 text-sm animate-pulse">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
            {/* Header / Nav */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
                <div className="max-w-5xl mx-auto px-4 h-24 flex items-center justify-between">
                    <Link href="/" className="font-black text-6xl md:text-7xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-tr from-white to-zinc-400 hover:opacity-80 transition-opacity flex items-center gap-2">
                        Stream Tips
                    </Link>
                    <div className="font-bold text-sm tracking-wider uppercase text-zinc-500">
                        {status ? <span className="text-purple-400 animate-pulse">{status}</span> : ""}
                    </div>
                    <div className="w-8" />
                </div>
            </div>

            {/* Global Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                {user.background_url ? (
                    <>
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 opacity-40 blur-3xl scale-110"
                            style={{ backgroundImage: `url(${user.background_url})` }}
                        />
                        <div className="absolute inset-0 bg-black/60" />
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black/80 to-blue-900/10" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/10" />
                )}
            </div>

            {/* Hero / Banner */}
            <div className="relative h-96 md:h-[500px] w-full overflow-hidden z-0 mt-24">
                {user.background_url ? (
                    <div
                        className="w-full h-full bg-cover bg-center opacity-80"
                        style={{
                            backgroundImage: `url(${user.background_url})`,
                            maskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
                            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)'
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-b from-purple-900/20 via-black to-black relative">
                        <div className="absolute inset-0 opacity-30" style={{
                            backgroundImage: "radial-gradient(circle at center, #6366f1 1px, transparent 1px)",
                            backgroundSize: "24px 24px"
                        }} />
                    </div>
                )}
                {/* Subtle top shadow for header contrast, transparent bottom */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent pointer-events-none" />
            </div>

            <div className="max-w-4xl mx-auto px-4 relative z-10 -mt-80 pb-20">
                <div className="flex flex-col md:flex-row items-start gap-8">
                    {/* Simplified Content - Left Column (Profile) */}
                    <div className="flex-1 w-full relative group">

                        {/* Main Card (Matches Dashboard Style) */}
                        <div className="relative w-full bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 hover:border-white/10 transition-all">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

                            <div className="flex flex-col items-center md:items-start gap-6 mb-8 text-center md:text-left relative z-10">
                                <div className="relative group">
                                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                                    <div className="relative w-32 h-32 bg-zinc-900/80 backdrop-blur-sm rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden border-4 border-black/50 shadow-2xl">
                                        <div className="w-full h-full rounded-full overflow-hidden">
                                            <img
                                                src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                                alt={user.username}
                                                className="w-full h-full object-cover bg-zinc-800"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 tracking-tight">{user.username}</h1>

                                    {user.description && (
                                        <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-md font-medium">
                                            {user.description}
                                        </p>
                                    )}

                                    {/* Social Links / Connected Providers */}
                                    {user.connected_providers && user.connected_providers.length > 0 && (
                                        <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                                            {user.connected_providers.includes('twitch') && (
                                                <div className="px-3 py-1 bg-[#9146FF]/10 text-[#a970ff] border border-[#9146FF]/20 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_-3px_#9146FF]">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#9146FF]"></span>
                                                    Twitch Verified
                                                </div>
                                            )}
                                            {user.connected_providers.includes('kick') && (
                                                <div className="px-3 py-1 bg-[#53FC18]/5 text-[#53FC18] border border-[#53FC18]/20 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_-3px_#53FC18]">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#53FC18]"></span>
                                                    Kick Verified
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

                            <div className="space-y-2 mb-10 text-center md:text-left">
                                <h2 className="text-xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
                                    <span className="bg-purple-500/20 p-1.5 rounded-lg text-purple-400">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                    </span>
                                    Send a Tip
                                </h2>
                                <p className="text-sm text-zinc-500 font-medium">
                                    Crypto tip will be sent directly to <span className="text-zinc-300 font-bold">{user.username}</span> wallet and your message will appear on the live stream!
                                </p>
                            </div>

                            <ErrorBoundary>
                                <LifiTip
                                    recipientAddress={user.wallet_address}
                                    onSuccess={handleSuccess}
                                    onStatus={setStatus}
                                    preferredChainId={user.preferred_chain_id}
                                    preferredAssetAddress={user.preferred_asset_address}
                                    widgetConfig={{
                                        tts_enabled: user.widget_tts ?? false,
                                        background_color: user.widget_bg_color || "rgba(24, 24, 27, 0.8)",
                                        user_color: user.widget_user_color || "#ffffff",
                                        amount_color: user.widget_amount_color || "#a855f7",
                                        message_color: user.widget_message_color || "#ffffff",
                                    }}
                                />
                            </ErrorBoundary>
                        </div>
                    </div>

                    {/* Right Column (Future features: Leaderboard, recent tips, etc.) */}
                    {/* For now, just a small "How it works" or similar could go here or we keep it single column centered */}
                </div>
            </div>
        </div>
    );
}

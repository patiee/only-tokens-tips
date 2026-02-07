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
    eth_address: string;
    avatar_url: string;
    preferred_chain_id?: number;
    preferred_asset_address?: string;
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
        setStatus("Success! Tip sent.");
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
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-tr from-white to-zinc-400 hover:opacity-80 transition-opacity">
                        Stream Tips
                    </Link>
                    <div className="font-bold text-sm tracking-wider uppercase text-zinc-500">
                        {status ? <span className="text-purple-400 animate-pulse">{status}</span> : ""}
                    </div>
                    <div className="w-8" />
                </div>
            </div>

            <div className="pt-24 pb-12 max-w-md mx-auto">
                {/* Profile Header */}
                <div className="text-center space-y-4 px-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="relative inline-block">
                        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 p-[2px] shadow-2xl shadow-purple-500/20">
                            <div className="w-full h-full rounded-full overflow-hidden bg-black">
                                <img
                                    src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                    alt={user.username}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{user.username}</h1>
                    </div>


                </div>

                {/* Simplified Content - LiFi Only */}
                <div className="p-6">
                    <ErrorBoundary>
                        <LifiTip
                            recipientAddress={user.eth_address}
                            onSuccess={handleSuccess}
                            onStatus={setStatus}
                            preferredChainId={user.preferred_chain_id}
                            preferredAssetAddress={user.preferred_asset_address}
                        />
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );
}

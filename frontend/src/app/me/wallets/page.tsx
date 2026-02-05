"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ArrowLeft, Save, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export type UserProfile = {
    username: string;
    eth_address: string;
    main_wallet: boolean;
    name?: string;
    avatar?: string;
};

function WalletsContent() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const router = useRouter();

    const { address, isConnected } = useAccount();

    useEffect(() => {
        const token = localStorage.getItem("user_token");
        if (!token) {
            router.push("/auth");
            return;
        }

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me?token=` + token)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch profile");
                return res.json();
            })
            .then(data => {
                setProfile(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Failed to load profile. Please try again.");
                setLoading(false);
            });
    }, [router]);

    const handleSaveWallet = async () => {
        if (!address) return;
        setSaving(true);
        setError("");
        setMessage("");

        const token = localStorage.getItem("user_token");
        if (!token) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me/wallet`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ eth_address: address })
            });

            const text = await res.text();
            console.log("Raw response:", text);

            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error("JSON Parse Error:", jsonErr);
                throw new Error(`Invalid server response: ${text.substring(0, 100)}...`);
            }

            if (!res.ok) {
                throw new Error(data.error || "Failed to update wallet");
            }

            // Success
            setProfile(prev => prev ? { ...prev, eth_address: address } : null);
            setMessage("Main wallet updated successfully!");
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>
    );

    if (error && !profile) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
            <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl max-w-md w-full text-center">
                <h2 className="text-xl font-bold mb-2 text-white">Access Failed</h2>
                <p className="text-zinc-400 mb-6">{error}</p>
                <Link href="/me" className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-sm">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );

    const isDifferent = profile && address && profile.eth_address.toLowerCase() !== address.toLowerCase();

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-8">

                <div className="flex items-center gap-4">
                    <Link href="/me" className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-bold">Manage Wallets</h1>
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

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                            <Wallet className="text-blue-400" /> Connected Wallet
                        </h2>
                        <p className="text-zinc-400 text-sm">
                            This wallet will receive all direct tips and cross-chain transactions.
                        </p>
                    </div>

                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col gap-2">
                        <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Current Main Wallet</span>
                        <code className="font-mono text-zinc-300 break-all">{profile?.eth_address || "Not set"}</code>
                    </div>

                    <div className="border-t border-zinc-800 pt-6">
                        <h3 className="text-sm font-bold text-zinc-300 mb-4">Connect New Wallet</h3>
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <ConnectButton showBalance={false} chainStatus="none" />

                            {isConnected && isDifferent && (
                                <button
                                    onClick={handleSaveWallet}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    Set as Main Wallet
                                </button>
                            )}
                        </div>
                        {isConnected && !isDifferent && (
                            <p className="text-xs text-zinc-500 mt-4 text-center sm:text-left">
                                Connected wallet matches your current main wallet.
                            </p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function WalletsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <WalletsContent />
        </Suspense>
    );
}

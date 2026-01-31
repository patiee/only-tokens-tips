"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { UserProfile } from "../me/page";
import { LifiTip } from "@/components/LifiTip";
import { ArrowLeft, ExternalLink, Globe, Twitter, Wallet } from "lucide-react";

const PRESET_AMOUNTS = ["0.001", "0.01", "0.05", "0.1"];

export default function TipPage() {
    const params = useParams();
    const username = params.username as string;
    const { isConnected } = useAccount();

    const [user, setUser] = useState<UserProfile | null>(null);
    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("");
    const [senderName, setSenderName] = useState("");
    const [activeTab, setActiveTab] = useState<"direct" | "lifi">("direct");
    const [status, setStatus] = useState("");

    // Wagmi Hooks for Direct ETH
    const { sendTransaction, data: hash, isPending: isSendPending } = useSendTransaction();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    // Fetch streamer details
    useEffect(() => {
        // Handle URL decoding in case username has special chars
        const safeUsername = decodeURIComponent(username);
        fetch(`http://localhost:8080/api/user/${safeUsername}`)
            .then(res => {
                if (!res.ok) throw new Error("User not found");
                return res.json();
            })
            .then(data => setUser(data))
            .catch(console.error);
    }, [username]);

    // Notify backend on success
    useEffect(() => {
        if (isConfirmed && hash) {
            setStatus("Success! Tip sent directly.");
            notifyBackend(hash, amount, message, senderName);
            setAmount("");
            setMessage("");
        }
    }, [isConfirmed, hash, amount, message, senderName]);

    const notifyBackend = (txHash: string | undefined, amt: string, msg: string, sender: string) => {
        if (!txHash) return;
        fetch("http://localhost:8080/api/tip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                streamerId: username,
                sender: sender || "Anonymous",
                message: msg,
                amount: amt,
                txHash: txHash,
            }),
        }).catch(console.error);
    };

    const handleDirectTip = async () => {
        if (!isConnected || !amount || !user?.eth_address) return;
        try {
            sendTransaction({
                to: user.eth_address as `0x${string}`,
                value: parseEther(amount),
            });
        } catch (e: any) {
            console.error(e);
            setStatus(`Error: ${e.message}`);
        }
    };

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
        <div className="min-h-screen flex items-center justify-center bg-black/95 text-white p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-8 border border-zinc-800 shadow-2xl relative z-10 transition-all hover:border-zinc-700">
                {/* Header */}
                <div className="flex flex-col items-center mb-8 relative">
                    <div className="w-24 h-24 rounded-full border-4 border-zinc-800 overflow-hidden mb-4 shadow-xl ring-2 ring-purple-500/20">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.name || user.username} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-3xl font-bold bg-gradient-to-br from-purple-500 to-blue-500">
                                {user.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                        {user.name || user.username}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="px-3 py-1 bg-zinc-800/50 rounded-full text-xs font-mono text-zinc-400 border border-zinc-700/50 flex items-center gap-1">
                            <Wallet size={12} />
                            {user.eth_address.slice(0, 6)}...{user.eth_address.slice(-4)}
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-zinc-950/50 p-1 rounded-xl mb-6 border border-zinc-800/50">
                    <button
                        onClick={() => setActiveTab("direct")}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${activeTab === "direct" ? "bg-zinc-800 text-white shadow-lg ring-1 ring-zinc-700" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        Direct Tip
                    </button>
                    <button
                        onClick={() => setActiveTab("lifi")}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${activeTab === "lifi" ? "bg-zinc-800 text-white shadow-lg ring-1 ring-zinc-700" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        Cross-Chain
                    </button>
                </div>

                {/* Content */}
                {activeTab === "direct" ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Amount</label>
                                <div className="text-xs text-zinc-500 font-mono">
                                    {isConnected ? <span className="text-green-500">● Connected</span> : <span className="text-zinc-600">○ Not Connected</span>}
                                </div>
                            </div>

                            <div className="relative group">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-6 text-3xl font-bold text-center text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-800 group-hover:border-zinc-700"
                                />
                                <div className="absolute top-1/2 right-4 -translate-y-1/2 text-zinc-500 font-bold pointer-events-none">ETH</div>
                            </div>

                            {/* Presets */}
                            <div className="grid grid-cols-4 gap-2 mt-2">
                                {PRESET_AMOUNTS.map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => setAmount(val)}
                                        className={`py-2 text-xs font-medium rounded-lg border transition-all ${amount === val ? "bg-purple-600/20 border-purple-500/50 text-purple-200" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700"}`}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Message</label>
                            <textarea
                                placeholder="Say something nice..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-700 resize-none h-24 text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">From</label>
                            <input
                                type="text"
                                placeholder="Anonymous"
                                value={senderName}
                                onChange={(e) => setSenderName(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-700 text-sm"
                            />
                        </div>

                        {status && (
                            <div className={`p-3 rounded-xl text-xs text-center animate-in fade-in slide-in-from-top-2 border ${status.includes("Success") ? "bg-green-500/10 border-green-500/20 text-green-200" : "bg-red-500/10 border-red-500/20 text-red-200"}`}>
                                {status}
                            </div>
                        )}

                        {!isConnected ? (
                            <div className="flex justify-center pt-2">
                                <ConnectButton />
                            </div>
                        ) : (
                            <button
                                onClick={handleDirectTip}
                                disabled={isSendPending || isConfirming || !amount || parseFloat(amount) <= 0}
                                className="w-full p-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSendPending || isConfirming ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        {isSendPending ? "Confirm in Wallet..." : "Processing..."}
                                    </>
                                ) : (
                                    "Send Tip"
                                )}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <LifiTip
                            recipientAddress={user.eth_address}
                            onSuccess={(txHash, amt, msg) => {
                                notifyBackend(txHash, amt, msg, senderName);
                                setStatus("Success! Cross-chain tip sent.");
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

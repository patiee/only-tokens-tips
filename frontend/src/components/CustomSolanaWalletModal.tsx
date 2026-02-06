"use client";

import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { X, Wallet as WalletIcon } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

interface CustomSolanaWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CustomSolanaWalletModal({ isOpen, onClose }: CustomSolanaWalletModalProps) {
    const { wallets, select } = useWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Dedup wallets by name to avoid "Duplicate key" error
    const uniqueWallets = useMemo(() => {
        const seen = new Set();
        return wallets.filter((wallet) => {
            const name = wallet.adapter.name;
            if (seen.has(name)) {
                return false;
            }
            seen.add(name);
            return true;
        });
    }, [wallets]);

    const handleSelect = (walletName: string) => {
        select(walletName as any); // Type assertion needed as adapter names are specific strings
        onClose();
    };

    if (!mounted) return null;

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                            <WalletIcon size={16} className="text-white" />
                        </span>
                        Connect Solana Wallet
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-2 overflow-y-auto max-h-[60vh]">
                    {uniqueWallets.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {uniqueWallets.map((wallet) => (
                                <button
                                    key={wallet.adapter.name}
                                    onClick={() => handleSelect(wallet.adapter.name)}
                                    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-zinc-900 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-zinc-900 p-2 flex items-center justify-center border border-zinc-800 group-hover:border-zinc-700 group-hover:bg-zinc-800 transition-colors">
                                        <img
                                            src={wallet.adapter.icon}
                                            alt={wallet.adapter.name}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <span className="font-bold text-zinc-200 group-hover:text-white transition-colors">
                                        {wallet.adapter.name}
                                    </span>
                                    {wallet.readyState === "Installed" && (
                                        <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
                                            Detected
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-zinc-500">
                            <p className="mb-2">No wallets detected.</p>
                            <p className="text-sm">Please install Phantom, Solflare, or another Solana wallet.</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-950/50">
                    <p className="text-xs text-center text-zinc-500">
                        New to Solana? <a href="https://solana.com/ecosystem/explore?categories=wallet" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Learn more about wallets</a>
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
}

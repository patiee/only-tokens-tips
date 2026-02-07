"use client";

import { X, Wallet } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface WalletSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectEVM: () => void;
    onSelectSolana: () => void;
    onSelectBitcoin: () => void;
    onSelectSui: () => void;
}

export function WalletSelectionModal({
    isOpen,
    onClose,
    onSelectEVM,
    onSelectSolana,
    onSelectBitcoin,
    onSelectSui
}: WalletSelectionModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden relative">

                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                        Connect Wallet
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="px-6 text-zinc-400 text-sm mb-6">
                    Select your network to continue.
                </p>

                <div className="p-6 pt-0 flex flex-col gap-3">

                    {/* EVM */}
                    <button
                        onClick={() => { onSelectEVM(); onClose(); }}
                        className="group flex items-center gap-4 w-full p-4 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-blue-500/30 transition-all duration-300 text-left relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-transparent transition-all duration-500" />
                        <div className="relative pl-2">
                            <div className="font-bold text-zinc-200 group-hover:text-white transition-colors text-lg">Ethereum / EVM</div>
                            <div className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">Metamask, Coinbase</div>
                        </div>
                    </button>

                    {/* Solana */}
                    <button
                        onClick={() => { onSelectSolana(); onClose(); }}
                        className="group flex items-center gap-4 w-full p-4 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-purple-500/30 transition-all duration-300 text-left relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-transparent transition-all duration-500" />
                        <div className="relative pl-2">
                            <div className="font-bold text-zinc-200 group-hover:text-white transition-colors text-lg">Solana</div>
                            <div className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">Phantom, Solflare, Backpack</div>
                        </div>
                    </button>

                    {/* Bitcoin */}
                    <button
                        onClick={() => { onSelectBitcoin(); onClose(); }}
                        className="group flex items-center gap-4 w-full p-4 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-orange-500/30 transition-all duration-300 text-left relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-transparent transition-all duration-500" />
                        <div className="relative pl-2">
                            <div className="font-bold text-zinc-200 group-hover:text-white transition-colors text-lg">Bitcoin</div>
                            <div className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">Unisat, Xverse, Leather</div>
                        </div>
                    </button>

                    {/* Sui */}
                    <button
                        onClick={() => { onSelectSui(); onClose(); }}
                        className="group flex items-center gap-4 w-full p-4 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-cyan-500/30 transition-all duration-300 text-left relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/5 group-hover:to-transparent transition-all duration-500" />
                        <div className="relative pl-2">
                            <div className="font-bold text-zinc-200 group-hover:text-white transition-colors text-lg">Sui</div>
                            <div className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">Sui Wallet</div>
                        </div>
                    </button>

                </div>
            </div>
        </div>,
        document.body
    );
}

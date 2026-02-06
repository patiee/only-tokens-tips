"use client";

import { X, Wallet as WalletIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useConnectWallet, useWallets } from "@mysten/dapp-kit";

interface CustomSuiWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CustomSuiWalletModal({ isOpen, onClose }: CustomSuiWalletModalProps) {
    const wallets = useWallets();
    const { mutate: connect } = useConnectWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleConnect = (wallet: any) => {
        connect(
            { wallet },
            {
                onSuccess: () => onClose(),
            }
        );
    };

    if (!mounted) return null;
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center">
                            <WalletIcon size={16} className="text-white" />
                        </span>
                        Connect Sui Wallet
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-2 overflow-y-auto max-h-[60vh]">
                    {wallets.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {wallets.map((wallet) => (
                                <button
                                    key={wallet.name}
                                    onClick={() => handleConnect(wallet)}
                                    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-zinc-900 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-zinc-900 p-2 flex items-center justify-center border border-zinc-800 group-hover:border-zinc-700 group-hover:bg-zinc-800 transition-colors">
                                        <img src={wallet.icon} alt={wallet.name} className="w-full h-full object-contain" />
                                    </div>
                                    <span className="font-bold text-zinc-200 group-hover:text-white transition-colors">
                                        {wallet.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-zinc-500">
                            <p className="mb-2">No wallets detected.</p>
                            <p className="text-sm">Please install Sui Wallet or another compatible wallet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

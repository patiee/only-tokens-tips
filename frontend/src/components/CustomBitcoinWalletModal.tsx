"use client";

import { X, Wallet as WalletIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";

interface CustomBitcoinWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CustomBitcoinWalletModal({ isOpen, onClose }: CustomBitcoinWalletModalProps) {
    const { connect, isConnected } = useBitcoinWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleConnect = (type: "unisat" | "xverse" | "leather" | "phantom" | "metamask") => {
        connect(type);
        onClose();
    };

    if (!mounted) return null;
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center">
                            <WalletIcon size={16} className="text-white" />
                        </span>
                        Connect Bitcoin Wallet
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-2 overflow-y-auto">
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={() => handleConnect("unisat")}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                                    <span className="font-bold text-orange-500">U</span>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-medium text-white">Unisat Wallet</span>
                                    <span className="text-xs text-zinc-500">Connect using Unisat</span>
                                </div>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-orange-500 transition-colors" />
                        </button>

                        <button
                            onClick={() => handleConnect("xverse")}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    <span className="font-bold text-purple-500">X</span>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-medium text-white">Xverse / Leather</span>
                                    <span className="text-xs text-zinc-500">Connect using Xverse or Leather</span>
                                </div>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-purple-500 transition-colors" />
                        </button>

                        <button
                            onClick={() => handleConnect("phantom")}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    {/* Phantom Icon Placeholder */}
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M5.4 3.9C4.5 4.8 4 6 4 7.3V16.7C4 18 4.5 19.2 5.4 20.1C6.3 21 7.5 21.5 8.7 21.5H15.3C16.6 21.5 17.7 21 18.6 20.1C19.5 19.2 20 18 20 16.7V7.3C20 6 19.5 4.8 18.6 3.9C17.7 3 16.6 2.5 15.3 2.5H8.7C7.5 2.5 6.3 3 5.4 3.9Z" fill="#AB9FF2" />
                                        <path d="M10 13C10.6 13 11 12.6 11 12C11 11.4 10.6 11 10 11C9.4 11 9 11.4 9 12C9 12.6 9.4 13 10 13Z" fill="white" />
                                        <path d="M14 13C14.6 13 15 12.6 15 12C15 11.4 14.6 11 14 11C13.4 11 13 11.4 13 12C13 12.6 13.4 13 14 13Z" fill="white" />
                                    </svg>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-medium text-white">Phantom</span>
                                    <span className="text-xs text-zinc-500">Connect using Phantom</span>
                                </div>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-white transition-colors" />
                        </button>


                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

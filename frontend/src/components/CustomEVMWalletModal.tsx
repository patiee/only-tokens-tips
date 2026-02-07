"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";
import { X, Wallet as WalletIcon, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

interface CustomEVMWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CustomEVMWalletModal({ isOpen, onClose }: CustomEVMWalletModalProps) {
    const { connectors, connect, error: connectError } = useConnect();
    const { isConnected } = useAccount();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleConnect = (connector: any) => {
        connect({ connector });
        onClose();
    };

    // Filter connectors to avoid duplicates or unwanted ones if necessary
    const uniqueConnectors = useMemo(() => {
        const seen = new Set();
        return connectors.filter((connector) => {
            const name = connector.name;
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
    }, [connectors]);

    if (!mounted) return null;
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center">
                            <WalletIcon size={16} className="text-white" />
                        </span>
                        Connect EVM Wallet
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-2 overflow-y-auto max-h-[60vh]">
                    <div className="flex flex-col gap-1">
                        {uniqueConnectors.map((connector) => (
                            <button
                                key={connector.uid}
                                onClick={() => handleConnect(connector)}
                                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-zinc-900 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-zinc-900 p-2 flex items-center justify-center border border-zinc-800 group-hover:border-zinc-700 group-hover:bg-zinc-800 transition-colors">
                                    {/* We can try to get icon from connector, but wagmi connectors don't always expose icon URLs easily in v2 without metadata. 
                                         For basic wagmi, we might need a map or check connector.icon if available. */}
                                    {connector.icon ? (
                                        <img src={connector.icon} alt={connector.name} className="w-full h-full object-contain" />
                                    ) : (
                                        <WalletIcon size={20} className="text-zinc-500 group-hover:text-white" />
                                    )}
                                </div>
                                <span className="font-bold text-zinc-200 group-hover:text-white transition-colors">
                                    {connector.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {connectError && (
                    <div className="p-4 bg-red-900/20 border-t border-red-900/50 text-red-400 text-xs text-center">
                        {connectError.message}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

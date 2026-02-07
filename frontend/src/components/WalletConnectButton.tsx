"use client";

import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ChainFamily } from "@/config/chains";
import { Wallet, ChevronDown, CheckCircle } from "lucide-react";
// Import our custom modals - We need to pass state/handlers for these or handle them here?
// The Modals are usually rendered at the page level to avoid z-index issues, 
// so this button should probably validly Accept "onOpen" props.

interface WalletConnectButtonProps {
    chainFamily: ChainFamily;
    onOpenSolana: () => void;
    onOpenBitcoin: () => void;
    onOpenSui: () => void;
    onOpenEVM: () => void;
    showFullAddress?: boolean;
    showIcon?: boolean;
}

export function WalletConnectButton({
    chainFamily,
    onOpenSolana,
    onOpenBitcoin,
    onOpenSui,
    onOpenEVM,
    showFullAddress = false,
    showIcon = true
}: WalletConnectButtonProps) {

    // EVM State
    const { isConnected: isEVMConnected, address: evmAddress } = useAccount();

    // Solana State
    const { connected: isSolanaConnected, publicKey: solanaPublicKey, wallet: solanaWallet } = useWallet();

    // Bitcoin State
    const { isConnected: isBtcConnected, address: btcAddress } = useBitcoinWallet();

    // Sui State
    const suiAccount = useCurrentAccount();
    const isSuiConnected = !!suiAccount;

    const renderAddress = (address: string) => {
        if (showFullAddress) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // Render based on family
    if (chainFamily === ChainFamily.SOLANA) {
        if (!isSolanaConnected) {
            return (
                <button
                    onClick={onOpenSolana}
                    type="button"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                    <Wallet size={18} />
                    Connect Solana Wallet
                </button>
            );
        }
        return (
            <button
                onClick={onOpenSolana}
                type="button"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-between gap-3 transition-all hover:bg-zinc-900"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {showIcon && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-[10px] shrink-0">
                            {solanaWallet?.adapter.icon ? <img src={solanaWallet.adapter.icon} className="w-full h-full rounded-full" alt="Wallet" /> : "S"}
                        </div>
                    )}
                    <span className={`font-medium break-all truncate ${showFullAddress ? "text-sm" : "text-xs"}`}>{solanaPublicKey ? renderAddress(solanaPublicKey.toBase58()) : ""}</span>
                </div>
                <ChevronDown size={16} className="text-zinc-500 shrink-0" />
            </button>
        );
    }

    if (chainFamily === ChainFamily.BITCOIN) {
        if (!isBtcConnected) {
            return (
                <button
                    onClick={onOpenBitcoin}
                    type="button"
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
                >
                    <Wallet size={18} />
                    Connect Bitcoin Wallet
                </button>
            );
        }
        return (
            <button
                onClick={onOpenBitcoin}
                type="button"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-between gap-3 transition-all hover:bg-zinc-900"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {showIcon && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center text-[10px] text-white shrink-0">
                            B
                        </div>
                    )}
                    <span className={`font-medium break-all truncate ${showFullAddress ? "text-sm" : "text-xs"}`}>{btcAddress ? renderAddress(btcAddress) : ""}</span>
                </div>
                <ChevronDown size={16} className="text-zinc-500 shrink-0" />
            </button>
        );
    }

    if (chainFamily === ChainFamily.SUI) {
        if (!isSuiConnected) {
            return (
                <button
                    onClick={onOpenSui}
                    type="button"
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                    <Wallet size={18} />
                    Connect Sui Wallet
                </button>
            );
        }
        return (
            <button
                onClick={onOpenSui}
                type="button"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-between gap-3 transition-all hover:bg-zinc-900"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {showIcon && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-[10px] text-white shrink-0">
                            S
                        </div>
                    )}
                    <span className={`font-medium break-all truncate ${showFullAddress ? "text-sm" : "text-xs"}`}>{suiAccount ? renderAddress(suiAccount.address) : ""}</span>
                </div>
                <ChevronDown size={16} className="text-zinc-500 shrink-0" />
            </button>
        );
    }

    // Default: EVM
    // We can use our own custom modal trigger
    if (!isEVMConnected) {
        return (
            <button
                onClick={onOpenEVM}
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
            >
                <Wallet size={18} />
                Connect Wallet
            </button>
        );
    }

    return (
        <button
            onClick={onOpenEVM}
            type="button"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-between gap-3 transition-all hover:bg-zinc-900"
        >
            <div className="flex items-center gap-3 overflow-hidden">
                {showIcon && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                        E
                    </div>
                )}
                <span className={`font-medium break-all truncate ${showFullAddress ? "text-sm" : "text-xs"}`}>{evmAddress ? renderAddress(evmAddress) : ""}</span>
            </div>
            <ChevronDown size={16} className="text-zinc-500 shrink-0" />
        </button>
    );
}

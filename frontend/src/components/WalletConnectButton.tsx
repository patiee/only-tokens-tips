"use client";

import { useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ChainFamily } from "@/config/chains";
import { Wallet, ChevronDown, CheckCircle } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
// Import our custom modals - We need to pass state/handlers for these or handle them here?
// The Modals are usually rendered at the page level to avoid z-index issues, 
// so this button should probably validly Accept "onOpen" props.

interface WalletConnectButtonProps {
    chainFamily: ChainFamily;
    onOpenSolana: () => void;
    onOpenBitcoin: () => void;
    onOpenSui: () => void;
    onOpenEVM: () => void;
}

export function WalletConnectButton({
    chainFamily,
    onOpenSolana,
    onOpenBitcoin,
    onOpenSui,
    onOpenEVM
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-center gap-3 transition-all hover:bg-zinc-900"
            >
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-[10px]">
                    {solanaWallet?.adapter.icon ? <img src={solanaWallet.adapter.icon} className="w-full h-full rounded-full" alt="Wallet" /> : "S"}
                </div>
                <span className="font-medium text-xs break-all">{solanaPublicKey?.toBase58().slice(0, 6)}...{solanaPublicKey?.toBase58().slice(-4)}</span>
                <ChevronDown size={16} className="text-zinc-500" />
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-center gap-3 transition-all hover:bg-zinc-900"
            >
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center text-[10px] text-white">
                    B
                </div>
                <span className="font-medium text-xs break-all">{btcAddress?.slice(0, 6)}...{btcAddress?.slice(-4)}</span>
                <ChevronDown size={16} className="text-zinc-500" />
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-center gap-3 transition-all hover:bg-zinc-900"
            >
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center justify-center text-[10px] text-white">
                    S
                </div>
                <span className="font-medium text-xs break-all">{suiAccount?.address.slice(0, 6)}...{suiAccount?.address.slice(-4)}</span>
                <ChevronDown size={16} className="text-zinc-500" />
            </button>
        );
    }

    // Default: EVM
    // We can use RainbowKit's custom button or our own custom modal trigger
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
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-center gap-3 transition-all hover:bg-zinc-900"
        >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center text-[10px] text-white font-bold">
                E
            </div>
            <span className="font-medium text-xs break-all">{evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}</span>
            <ChevronDown size={16} className="text-zinc-500" />
        </button>
    );
}

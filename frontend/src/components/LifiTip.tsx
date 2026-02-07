"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useSendTransaction, useBalance, useSwitchChain, useReadContracts, useWriteContract, useConfig, useDisconnect } from "wagmi";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseEther, formatEther, erc20Abi } from "viem";
import { mainnet, base } from "wagmi/chains";
import { Check, ChevronDown, Wallet, Coins, AlertTriangle } from "lucide-react";
import { allChains, ChainFamily } from "@/config/chains";
import { WalletNetworkSelector } from "./WalletNetworkSelector";
import { WalletConnectButton } from "./WalletConnectButton";
import { WalletConnectionModals } from "./WalletConnectionModals";
import { Token } from "@/hooks/useTokenList";
import { useWallet } from "@solana/wallet-adapter-react";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { TipWidget } from "./TipWidget";

// Constants
const PRESET_AMOUNTS = ["0.001", "0.01", "0.05", "0.1"];

interface LifiTipProps {
    recipientAddress: string;
    onSuccess: (data: {
        txHash: string;
        amount: string;
        message: string;
        senderName: string;
        asset: string;
        sourceChain: string;
        destChain: string;
        sourceAddress: string;
        destAddress: string;
        token: string;
    }) => void;
    onStatus: (status: string) => void;
    preferredChainId?: number;
    preferredAssetAddress?: string;
    widgetConfig?: {
        tts_enabled: boolean;
        background_color: string;
        user_color: string;
        amount_color: string;
        message_color: string;
    };
}

export function LifiTip({ recipientAddress, onSuccess, onStatus, preferredChainId, preferredAssetAddress, widgetConfig }: LifiTipProps) {
    // EVM Hooks
    const { address: evmAddress, chain: evmChain, isConnected: isEvmConnected } = useAccount();
    const { switchChainAsync } = useSwitchChain();
    const { disconnect: disconnectEVM } = useDisconnect();
    const { sendTransactionAsync } = useSendTransaction();
    const { writeContractAsync } = useWriteContract();
    const config = useConfig();

    // Auth Hook
    const { authenticate } = useWalletAuth();

    // Multi-Chain Hooks
    const { publicKey: solanaPublicKey, connected: isSolanaConnected, disconnect: disconnectSolana } = useWallet();
    const { address: btcAddress, isConnected: isBtcConnected, disconnect: disconnectBtc } = useBitcoinWallet();
    const suiAccount = useCurrentAccount();
    const isSuiConnected = !!suiAccount;
    // useDisconnectWallet for Sui? We might need to import it if we want a disconnect button.

    // State
    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("");
    const [senderName, setSenderName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Selection State
    // Default to Ethereum (1)
    const [selectedChainId, setSelectedChainId] = useState<number>(1);
    const [selectedAsset, setSelectedAsset] = useState<Token | null>(null);

    // Modal State
    const [isSolanaModalOpen, setIsSolanaModalOpen] = useState(false);
    const [isEVMModalOpen, setIsEVMModalOpen] = useState(false);
    const [isBitcoinModalOpen, setIsBitcoinModalOpen] = useState(false);
    const [isSuiModalOpen, setIsSuiModalOpen] = useState(false);

    const selectedChain = allChains.find(c => c.id === selectedChainId);

    // Determine active address
    const currentAddress = useMemo(() => {
        if (selectedChain?.family === ChainFamily.SOLANA) return solanaPublicKey?.toBase58();
        if (selectedChain?.family === ChainFamily.BITCOIN) return btcAddress;
        if (selectedChain?.family === ChainFamily.SUI) return suiAccount?.address;
        return evmAddress;
    }, [selectedChain, solanaPublicKey, btcAddress, suiAccount, evmAddress]);

    const isConnected = useMemo(() => {
        if (selectedChain?.family === ChainFamily.SOLANA) return isSolanaConnected;
        if (selectedChain?.family === ChainFamily.BITCOIN) return isBtcConnected;
        if (selectedChain?.family === ChainFamily.SUI) return isSuiConnected;
        return isEvmConnected;
    }, [selectedChain, isSolanaConnected, isBtcConnected, isSuiConnected, isEvmConnected]);

    // Disconnect Handler
    const handleDisconnect = () => {
        if (selectedChain?.family === ChainFamily.SOLANA) disconnectSolana();
        else if (selectedChain?.family === ChainFamily.BITCOIN) disconnectBtc();
        // else if (selectedChain?.family === ChainFamily.SUI) disconnectSui(); // Need import
        else disconnectEVM();
    };

    // Auto-authenticate (Optional for Tip View? Maybe we skip auto-auth to avoid popup spam)
    // Only verify ownership when they try to TIP.

    // Balance Fetching (Only EVM implemented in hook for now, but UI shows simplified balance)
    // We can use the existing `useBalance` for EVM.
    const { data: evmBalance } = useBalance({
        address: evmAddress,
        chainId: selectedChainId,
        token: (selectedAsset?.address === "0x0000000000000000000000000000000000000000" || !selectedAsset) ? undefined : selectedAsset.address as `0x${string}`,
        query: {
            enabled: !!evmAddress && isEvmConnected && selectedChain?.family === ChainFamily.EVM,
        }
    });

    const displayBalance = useMemo(() => {
        if (selectedChain?.family === ChainFamily.EVM && evmBalance) {
            return `${parseFloat(formatEther(evmBalance.value)).toFixed(4)} ${evmBalance.symbol}`;
        }
        return "..."; // TODO: Implement other chain balances
    }, [evmBalance, selectedChain]);


    // Sync EVM Chain
    const handleChainSelect = async (chainId: number) => {
        setSelectedChainId(chainId);
        const newChain = allChains.find(c => c.id === chainId);
        if (newChain?.family === ChainFamily.EVM && isEvmConnected && evmChain?.id !== chainId && switchChainAsync) {
            try {
                await switchChainAsync({ chainId });
            } catch (e) {
                console.error("Failed to switch chain", e);
            }
        }
    };

    const handleTip = async () => {
        if (!currentAddress || !recipientAddress || !amount || !selectedAsset) return;
        setLoading(true);
        setError("");

        try {
            // 1. Authenticate (Guest Mode - No Redirect)
            onStatus("Verifying Wallet...");
            let token = "";
            try {
                // IMPORTANT: preventRedirect=true
                const authResult = await authenticate({ preventRedirect: true });
                token = authResult || "";
            } catch (authErr) {
                console.error("Auth warning", authErr);
                // Proceed even if auth fails? Or require signature?
                // If backend requires token for /api/tip, we might fail there.
                // But let's try to proceed.
            }

            // 2. Logic based on Chain Family
            if (selectedChain?.family === ChainFamily.EVM) {
                await handleEVMTip(token);
            } else {
                throw new Error(`${selectedChain?.family} tipping not yet fully implemented in this demo.`);
            }

        } catch (e: any) {
            console.error(e);
            onStatus("");
            setError(e.message || "Transaction failed");
        } finally {
            setLoading(false);
        }
    };

    const handleEVMTip = async (authToken: string) => {
        // ... Existing LiFi Logic ...
        // Ensure chain
        if (evmChain?.id !== selectedChainId) {
            onStatus(`Switching to ${selectedChain?.name}...`);
            await switchChainAsync({ chainId: selectedChainId });
        }

        onStatus("Fetching quote...");

        // Setup Params
        const fromToken = selectedAsset!.address;
        const toToken = "0x0000000000000000000000000000000000000000"; // Target is Native (ETH)
        // Hardcoded target chain: Base (8453)
        const targetChainId = 8453;

        const params = new URLSearchParams({
            fromChain: selectedChainId.toString(),
            toChain: targetChainId.toString(),
            fromToken: fromToken,
            toToken: toToken,
            toAddress: recipientAddress,
            fromAmount: parseEther(amount).toString(),
            fromAddress: currentAddress!,
            integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "stream-tips",
            fee: "0.01",
        });

        const apiKey = process.env.NEXT_PUBLIC_LIFI_API_KEY;
        const headers: HeadersInit = { 'accept': 'application/json' };
        if (apiKey) headers['x-lifi-api-key'] = apiKey;

        const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, { headers });
        if (!response.ok) throw new Error("Failed to fetch quote");
        const quote = await response.json();

        // Approval Logic
        if (quote.transactionRequest.to && selectedAsset!.address !== "0x0000000000000000000000000000000000000000") {
            // ... duplicate approval logic from before or assume helper ...
            // Simplified for brevity in this rewrite, but essentially:
            const count = await readContract(config, {
                address: selectedAsset!.address as `0x${string}`,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [currentAddress as `0x${string}`, quote.transactionRequest.to as `0x${string}`],
                chainId: selectedChainId
            });

            if ((count as bigint) < BigInt(quote.estimate.fromAmount)) {
                onStatus("Approving Token...");
                const tx = await writeContractAsync({
                    address: selectedAsset!.address as `0x${string}`,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [quote.transactionRequest.to as `0x${string}`, BigInt(quote.estimate.fromAmount)],
                    chainId: selectedChainId
                });
                await waitForTransactionReceipt(config, { hash: tx });
            }
        }

        onStatus("Sending Transaction...");
        const txHash = await sendTransactionAsync({
            to: quote.transactionRequest.to,
            data: quote.transactionRequest.data,
            value: BigInt(quote.transactionRequest.value)
        });

        onSuccess({
            txHash,
            amount,
            message,
            senderName,
            asset: selectedAsset!.symbol,
            sourceChain: selectedChainId.toString(),
            destChain: targetChainId.toString(),
            sourceAddress: currentAddress!,
            destAddress: recipientAddress,
            token: authToken
        });
    };


    // Preview Data
    const previewTip = {
        sender: senderName || "Anonymous",
        amount: amount && selectedAsset ? `${amount} ${selectedAsset.symbol}` : `0 ${selectedAsset?.symbol || "ETH"}`,
        message: message || "Your message will appear on stream!",
        actionText: "tipped"
    };

    const previewConfig = widgetConfig || {
        tts_enabled: false,
        background_color: "rgba(24, 24, 27, 0.8)", // zinc-950/80
        user_color: "#ffffff",
        amount_color: "#a855f7", // purple-500
        message_color: "#ffffff"
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
            {/* Top Row: Network & Amount + Desktop Preview */}
            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-end">

                {/* Left Column: Network & Amount */}
                <div className="flex-1 w-full space-y-6">
                    <WalletNetworkSelector
                        selectedChainId={selectedChainId}
                        onChainSelect={handleChainSelect}
                        selectedAsset={selectedAsset}
                        onAssetSelect={setSelectedAsset}
                    />

                    {/* Amount Input */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Amount</label>
                            <div className="text-xs text-zinc-500 font-mono">
                                Balance: <span className="text-white">{displayBalance}</span>
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
                            <div className="absolute top-1/2 right-4 -translate-y-1/2 text-zinc-500 font-bold pointer-events-none">{selectedAsset?.symbol}</div>
                        </div>

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
                </div>

                {/* Right Column: Desktop Preview */}
                <div className="hidden lg:block w-96 shrink-0 sticky top-24">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1 mb-4 block">Stream Preview</label>
                    <TipWidget tip={previewTip} config={previewConfig} isPreview={true} />
                    <p className="text-[10px] text-zinc-600 mt-2 text-center">
                        This is how your alert will appear on stream
                    </p>
                </div>
            </div>

            {/* Bottom Row: Message, Name, Actions (Full Width) */}
            <div className="space-y-6">
                {/* Message Input */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Message</label>
                        <span className="text-xs text-zinc-600">{message.length}/500</span>
                    </div>
                    <textarea
                        placeholder="Write your tip message here..."
                        value={message}
                        maxLength={500}
                        onChange={(e) => {
                            if (e.target.value.length <= 500) setMessage(e.target.value);
                        }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-700 resize-none h-24 text-sm"
                    />
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Name</label>
                        <span className="text-xs text-zinc-600">{senderName.length}/20</span>
                    </div>
                    <input
                        type="text"
                        placeholder="Your Name (optional)"
                        value={senderName}
                        maxLength={20}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\./g, ""); // Remove periods
                            if (val.length <= 20) setSenderName(val);
                        }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-700 text-sm"
                    />
                </div>

                {/* Actions */}
                <div className="space-y-4">
                    <div className={`w-full transition-all ${isConnected && currentAddress ? "flex items-center justify-between px-4 py-3 bg-zinc-950/80 rounded-xl border border-zinc-800/50 backdrop-blur-sm shadow-sm hover:border-zinc-700" : ""}`}>
                        {isConnected && currentAddress ? (
                            <>
                                <div className="flex items-center gap-3 w-full overflow-hidden">
                                    <div className="flex flex-col w-full">
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Connected</span>
                                        <span className="text-sm font-medium text-zinc-300 font-mono truncate w-full">
                                            {currentAddress}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                                >
                                    DISCONNECT
                                </button>
                            </>
                        ) : (
                            <div className="w-full">
                                <WalletConnectButton
                                    chainFamily={selectedChain?.family || ChainFamily.EVM}
                                    onOpenSolana={() => setIsSolanaModalOpen(true)}
                                    onOpenBitcoin={() => setIsBitcoinModalOpen(true)}
                                    onOpenSui={() => setIsSuiModalOpen(true)}
                                    onOpenEVM={() => setIsEVMModalOpen(true)}
                                />
                            </div>
                        )}
                    </div>

                    {isConnected && (
                        <>
                            <button
                                onClick={handleTip}
                                disabled={loading || !amount || parseFloat(amount) <= 0}
                                className="w-full py-4 rounded-xl bg-white text-black font-black text-xl hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)]"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : "Send"}
                            </button>
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-xs animate-in fade-in slide-in-from-top-1">
                                    <div className="bg-red-500/20 p-1 rounded-full shrink-0">
                                        <span className="block w-1.5 h-1.5 bg-red-500 rounded-full" />
                                    </div>
                                    <p className="font-medium break-all">{error}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Mobile Only Preview (Under Send Button) */}
                <div className="block lg:hidden mt-8">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1 mb-2 block">Stream Preview</label>
                    <TipWidget tip={previewTip} config={previewConfig} isPreview={true} />
                </div>
            </div>

            {/* Modals */}
            <WalletConnectionModals
                isSolanaOpen={isSolanaModalOpen}
                onSolanaClose={() => setIsSolanaModalOpen(false)}
                isBitcoinOpen={isBitcoinModalOpen}
                onBitcoinClose={() => setIsBitcoinModalOpen(false)}
                isSuiOpen={isSuiModalOpen}
                onSuiClose={() => setIsSuiModalOpen(false)}
                isEVMOpen={isEVMModalOpen}
                onEVMClose={() => setIsEVMModalOpen(false)}
            />
        </div>
    );

}

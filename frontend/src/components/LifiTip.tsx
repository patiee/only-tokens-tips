import { useState, useEffect, useMemo } from "react";
import { useAccount, useSendTransaction, useBalance, useSwitchChain, useReadContracts, useWriteContract, useConfig, useDisconnect, useGasPrice, useEnsName, useEnsAvatar, useEnsText } from "wagmi";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseEther, formatEther, erc20Abi } from "viem";
import { mainnet, base } from "wagmi/chains";
import { Check, ChevronDown, Wallet, Coins, AlertTriangle, Settings, X } from "lucide-react";
import { allChains, ChainFamily } from "@/config/chains";
import { WalletNetworkSelector } from "./WalletNetworkSelector";
import { WalletConnectButton } from "./WalletConnectButton";
import { WalletConnectionModals } from "./WalletConnectionModals";
import { Token } from "@/hooks/useTokenList";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { VersionedTransaction } from "@solana/web3.js";
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
        enableEnsAvatar: boolean;
        enableEnsBackground: boolean;
        enableEnsTwitter: boolean;
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
    const { data: gasPriceData } = useGasPrice();
    const config = useConfig();

    // Auth Hook
    const { authenticate } = useWalletAuth();

    // Multi-Chain Hooks
    const { connection } = useConnection();
    const { publicKey: solanaPublicKey, connected: isSolanaConnected, disconnect: disconnectSolana, sendTransaction } = useWallet();
    const { address: btcAddress, isConnected: isBtcConnected, disconnect: disconnectBtc, sendBitcoinTransaction } = useBitcoinWallet();
    const suiAccount = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const isSuiConnected = !!suiAccount;
    // useDisconnectWallet for Sui? We might need to import it if we want a disconnect button.

    // ENS Hooks (EVM Only)
    const { data: ensName } = useEnsName({ address: evmAddress, chainId: 1 });
    const { data: ensAvatarUrl } = useEnsAvatar({ name: ensName || undefined, chainId: 1, query: { enabled: !!ensName } });
    const { data: ensHeader } = useEnsText({ name: ensName || undefined, key: 'header', chainId: 1, query: { enabled: !!ensName } });
    const { data: ensTwitter } = useEnsText({ name: ensName || undefined, key: 'com.twitter', chainId: 1, query: { enabled: !!ensName } });

    // State
    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("");
    const [senderName, setSenderName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // ENS Toggles
    const [useEnsNameFlag, setUseEnsNameFlag] = useState(true);
    const [useEnsAvatarFlag, setUseEnsAvatarFlag] = useState(true);
    const [useEnsBackgroundFlag, setUseEnsBackgroundFlag] = useState(true);
    const [useEnsTwitterFlag, setUseEnsTwitterFlag] = useState(true);

    // Transaction Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [slippageMode, setSlippageMode] = useState<"auto" | "custom">("auto");
    const [customSlippage, setCustomSlippage] = useState("0.5"); // Default 0.5%
    const [gasMode, setGasMode] = useState<"auto" | "fast" | "instant">("auto");

    // Auto-fill ENS Name & Toggle Defaults
    useEffect(() => {
        if (ensName) {
            setSenderName(ensName);
            setUseEnsNameFlag(true);
            setUseEnsAvatarFlag(!!ensAvatarUrl);
            setUseEnsBackgroundFlag(!!ensHeader);
            setUseEnsTwitterFlag(!!ensTwitter);
        } else {
            setUseEnsNameFlag(false);
            setUseEnsAvatarFlag(false);
            setUseEnsBackgroundFlag(false);
            setUseEnsTwitterFlag(false);
        }
    }, [ensName, ensAvatarUrl, ensHeader, ensTwitter]);

    // ... (Selection State & Modal State kept same)
    // Selection State
    // Default to Ethereum (1)
    const [selectedChainId, setSelectedChainId] = useState<number>(1);
    const [selectedAsset, setSelectedAsset] = useState<Token | null>(null);

    // Modal State
    const [isSolanaModalOpen, setIsSolanaModalOpen] = useState(false);
    const [isEVMModalOpen, setIsEVMModalOpen] = useState(false);
    const [isBitcoinModalOpen, setIsBitcoinModalOpen] = useState(false);
    const [isSuiModalOpen, setIsSuiModalOpen] = useState(false);

    // ... (rest of hooks)
    const selectedChain = allChains.find(c => c.id === selectedChainId);

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

    const handleDisconnect = () => {
        if (selectedChain?.family === ChainFamily.SOLANA) disconnectSolana();
        else if (selectedChain?.family === ChainFamily.BITCOIN) disconnectBtc();
        else disconnectEVM();
    };

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
        return "...";
    }, [evmBalance, selectedChain]);

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
            onStatus("Verifying Wallet...");
            let token = "";
            try {
                const authResult = await authenticate({ preventRedirect: true });
                token = authResult || "";
            } catch (authErr) {
                console.error("Auth warning", authErr);
            }

            if (selectedChain?.family === ChainFamily.EVM) {
                await handleEVMTip(token);
            } else if (selectedChain?.family === ChainFamily.BITCOIN) {
                await handleBitcoinTip(token);
            } else if (selectedChain?.family === ChainFamily.SOLANA) {
                await handleSolanaTip(token);
            } else if (selectedChain?.family === ChainFamily.SUI) {
                await handleSuiTip(token);
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

    const handleBitcoinTip = async (authToken: string) => {
        if (!btcAddress) throw new Error("Bitcoin wallet not connected");
        onStatus("Fetching BTC quote...");

        // Destination: Base (8453) for now, similar to EVM flow.
        const targetChainId = 8453;
        // From: BTC, To: USDC on Base (or ETH?)
        // Let's use USDC on Base as stable target? Or ETH?
        // handleEVMTip used 0x0...0 (ETH) as fromToken. Use 'BTC' for fromToken.
        // For toToken, stick to USDC or ETH. USDC is safer for value preservation? 
        // handleEVMTip uses 0x000 (Native) as toToken. Let's use Native ETH on Base.
        const toToken = "0x0000000000000000000000000000000000000000";

        let slippageDecimal = "0.005";
        if (slippageMode === "custom" && customSlippage) {
            slippageDecimal = (parseFloat(customSlippage) / 100).toString();
        }

        // Amount is in BTC (e.g. 0.001). Li.Fi expects?
        // Li.Fi fromAmount should be in smallest unit (Sats). 1 BTC = 10^8 Sats.
        const satsAmount = Math.floor(parseFloat(amount) * 100000000).toString();

        const params = new URLSearchParams({
            fromChain: "BTC", // Li.Fi uses 'BTC' for Bitcoin chain ID
            toChain: targetChainId.toString(),
            fromToken: "BTC", // Li.Fi uses 'BTC' for native Bitcoin token
            toToken: toToken,
            toAddress: recipientAddress,
            fromAmount: satsAmount,
            fromAddress: btcAddress,
            integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "stream-tips",
            fee: "0.01",
            slippage: slippageDecimal,
        });

        const apiKey = process.env.NEXT_PUBLIC_LIFI_API_KEY;
        const headers: HeadersInit = { 'accept': 'application/json' };
        if (apiKey) headers['x-lifi-api-key'] = apiKey;

        const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, { headers });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error("Li.Fi Quote Failed: " + (errData.message || response.statusText));
        }
        const quote = await response.json();

        // Check for transaction request data (PSBT)
        if (!quote.transactionRequest || !quote.transactionRequest.data) {
            throw new Error("Invalid quote received from Li.Fi (Missing transaction data)");
        }

        const psbtHex = quote.transactionRequest.data;

        onStatus("Signing Bitcoin Transaction...");
        const txHash = await sendBitcoinTransaction(psbtHex);

        if (!txHash) throw new Error("Transaction failed or cancelled");

        onSuccess({
            txHash: txHash,
            amount: amount,
            message: message,
            senderName: useEnsNameFlag && ensName ? ensName : (senderName || "Anonymous"),
            asset: "BTC",
            sourceChain: "bitcoin",
            destChain: "8453", // Base
            sourceAddress: btcAddress,
            destAddress: recipientAddress,
            token: authToken,
            enableEnsAvatar: useEnsNameFlag && useEnsAvatarFlag,
            enableEnsBackground: useEnsNameFlag && useEnsBackgroundFlag,
            enableEnsTwitter: useEnsNameFlag && useEnsTwitterFlag,
        });

        setMessage("");
        setAmount("");
    };

    const handleSolanaTip = async (authToken: string) => {
        if (!isSolanaConnected || !solanaPublicKey) throw new Error("Solana wallet not connected");
        // We will need the `useWallet` hook's `signTransaction` or `sendTransaction`.
        // The `useWallet` hook is imported as:
        // const { publicKey: solanaPublicKey, connected: isSolanaConnected, disconnect: disconnectSolana } = useWallet();
        // We need to destructure sendTransaction!
        // I will add sendTransaction to destructuring in next step if missed, but let's assume it's available or use dynamic access?
        // Actually, let me check lines 64 to see what I destructured.
        // Line 64: const { publicKey: solanaPublicKey, connected: isSolanaConnected, disconnect: disconnectSolana } = useWallet();
        // I need to update line 64 concurrently or separately. 
        // I'll update line 64 in this same multi_replace call.

        onStatus("Fetching SOL quote...");

        // Destination: Base (8453)
        const targetChainId = 8453;
        const toToken = "0x0000000000000000000000000000000000000000"; // Native ETH on Base

        let slippageDecimal = "0.005";
        if (slippageMode === "custom" && customSlippage) {
            slippageDecimal = (parseFloat(customSlippage) / 100).toString();
        }

        // Amount: SOL has 9 decimals.
        const lamports = Math.floor(parseFloat(amount) * 1000000000).toString();

        const params = new URLSearchParams({
            fromChain: "SOL",
            toChain: targetChainId.toString(),
            fromToken: "SOL",
            toToken: toToken,
            toAddress: recipientAddress,
            fromAmount: lamports,
            fromAddress: solanaPublicKey.toBase58(),
            integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "stream-tips",
            fee: "0.01",
            slippage: slippageDecimal,
        });

        const apiKey = process.env.NEXT_PUBLIC_LIFI_API_KEY;
        const headers: HeadersInit = { 'accept': 'application/json' };
        if (apiKey) headers['x-lifi-api-key'] = apiKey;

        const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, { headers });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error("Li.Fi Quote Failed: " + (errData.message || response.statusText));
        }
        const quote = await response.json();

        if (!quote.transactionRequest || !quote.transactionRequest.data) {
            throw new Error("Invalid quote received from Li.Fi (Missing transaction data)");
        }

        const txBase64 = quote.transactionRequest.data;
        onStatus("Signing Solana Transaction...");

        // Deserialize Transaction
        const txBuffer = Buffer.from(txBase64, 'base64');
        const transaction = VersionedTransaction.deserialize(txBuffer);

        try {
            const signature = await sendTransaction(transaction, connection);

            onStatus("Confirming Solana Transaction...");
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');

            if (confirmation.value.err) {
                throw new Error("Transaction failed on-chain");
            }

            onSuccess({
                txHash: signature,
                amount: amount,
                message: message,
                senderName: useEnsNameFlag && ensName ? ensName : (senderName || "Anonymous"),
                asset: "SOL",
                sourceChain: "solana",
                destChain: "8453", // Base
                sourceAddress: solanaPublicKey.toBase58(),
                destAddress: recipientAddress,
                token: authToken,
                enableEnsAvatar: useEnsNameFlag && useEnsAvatarFlag,
                enableEnsBackground: useEnsNameFlag && useEnsBackgroundFlag,
                enableEnsTwitter: useEnsNameFlag && useEnsTwitterFlag,
            });

            setMessage("");
            setAmount("");
        } catch (e: any) {
            throw new Error("Solana Transaction Failed: " + (e.message || e));
        }
    };

    const handleSuiTip = async (authToken: string) => {
        if (!suiAccount) throw new Error("Sui wallet not connected");
        onStatus("Preparing SUI Transaction...");

        const decimals = 9; // SUI
        // Use BigInt for safety
        const amountMist = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
        // Dummy Treasury Address for Demo (Valid 32-byte hex)
        const treasuryAddress = "0x7d20dcdb2bca4f508ea9613994683eb4e76e9c4ed27464022c9438e54d6404bd";

        const tx = new Transaction();
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
        tx.transferObjects([coin], tx.pure.address(treasuryAddress));

        onStatus("Signing SUI Transaction...");
        try {
            const result = await signAndExecuteTransaction({
                transaction: tx,
                chain: 'sui:mainnet',
            });



            onSuccess({
                txHash: result.digest,
                amount: amount,
                message: message,
                senderName: useEnsNameFlag && ensName ? ensName : (senderName || "Anonymous"),
                asset: "SUI",
                sourceChain: "sui",
                destChain: "8453", // Base (Simulation)
                sourceAddress: suiAccount.address,
                destAddress: recipientAddress,
                token: authToken,
                enableEnsAvatar: useEnsNameFlag && useEnsAvatarFlag,
                enableEnsBackground: useEnsNameFlag && useEnsBackgroundFlag,
                enableEnsTwitter: useEnsNameFlag && useEnsTwitterFlag,
            });

            setMessage("");
            setAmount("");
        } catch (e: any) {
            throw new Error("Sui Transaction Failed: " + (e.message || e));
        }
    };

    const handleEVMTip = async (authToken: string) => {
        if (evmChain?.id !== selectedChainId) {
            onStatus(`Switching to ${selectedChain?.name}...`);
            await switchChainAsync({ chainId: selectedChainId });
        }

        onStatus("Fetching quote...");

        const fromToken = selectedAsset!.address;
        const toToken = "0x0000000000000000000000000000000000000000";
        const targetChainId = 8453;

        let slippageDecimal = "0.005";
        if (slippageMode === "custom" && customSlippage) {
            slippageDecimal = (parseFloat(customSlippage) / 100).toString();
        }

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
            slippage: slippageDecimal,
        });

        const apiKey = process.env.NEXT_PUBLIC_LIFI_API_KEY;
        const headers: HeadersInit = { 'accept': 'application/json' };
        if (apiKey) headers['x-lifi-api-key'] = apiKey;

        const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, { headers });
        if (!response.ok) throw new Error("Failed to fetch quote");
        const quote = await response.json();

        if (quote.transactionRequest.to && selectedAsset!.address !== "0x0000000000000000000000000000000000000000") {
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

        let txGasPrice = undefined;
        if (gasMode !== "auto" && gasPriceData) {
            const multiplier = gasMode === "fast" ? 1.2 : 1.5;
            const boostedGas = BigInt(Math.floor(Number(gasPriceData) * multiplier));
            txGasPrice = boostedGas;
        }

        onStatus("Sending Transaction...");
        const txHash = await sendTransactionAsync({
            to: quote.transactionRequest.to,
            data: quote.transactionRequest.data,
            value: BigInt(quote.transactionRequest.value),
            gasPrice: txGasPrice,
        });

        onSuccess({
            txHash: txHash,
            amount: amount,
            message: message,
            senderName: useEnsNameFlag && ensName ? ensName : (senderName || "Anonymous"),
            asset: selectedAsset?.symbol || "ETH",
            sourceChain: String(selectedChainId),
            destChain: String(selectedChainId),
            sourceAddress: currentAddress || "",
            destAddress: recipientAddress,
            token: authToken,
            enableEnsAvatar: useEnsNameFlag && useEnsAvatarFlag,
            enableEnsBackground: useEnsNameFlag && useEnsBackgroundFlag,
            enableEnsTwitter: useEnsNameFlag && useEnsTwitterFlag,
        });

        setMessage("");
        setAmount("");
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
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 relative">


            {/* Top Row: Network & Amount + Desktop Preview */}
            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-end">

                {/* Left Column: Network & Amount */}
                <div className="flex-1 w-full space-y-8">
                    <WalletNetworkSelector
                        selectedChainId={selectedChainId}
                        onChainSelect={handleChainSelect}
                        selectedAsset={selectedAsset}
                        onAssetSelect={setSelectedAsset}
                    />

                    {/* Amount Input */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount</label>
                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                Balance: <span className="text-zinc-300">{displayBalance}</span>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500"></div>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-zinc-900/30 border border-white/5 rounded-2xl px-4 py-8 text-5xl font-black text-center text-white focus:outline-none focus:bg-zinc-900/50 transition-all placeholder:text-zinc-800"
                            />
                            <div className="absolute top-1/2 right-6 -translate-y-1/2 text-zinc-600 font-black text-lg pointer-events-none">{selectedAsset?.symbol}</div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 mt-4">
                            {PRESET_AMOUNTS.map((val) => (
                                <button
                                    key={val}
                                    onClick={() => setAmount(val)}
                                    className={`py-2.5 text-xs font-bold rounded-xl border transition-all duration-300 ${amount === val ? "bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/25 scale-[1.02]" : "bg-zinc-900/30 border-white/5 text-zinc-500 hover:bg-white/5 hover:text-white"}`}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Desktop Preview */}
                <div className="hidden lg:block w-96 shrink-0 sticky top-24">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-4 block">Stream Preview</label>
                    <div className="transform transition-transform hover:scale-[1.02] duration-300">
                        <TipWidget tip={previewTip} config={previewConfig} isPreview={true} />
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-3 text-center font-medium">
                        This is how your alert will appear on stream
                    </p>
                </div>
            </div>

            {/* Bottom Row: Message, Name, Actions (Full Width) */}
            <div className="space-y-8">
                {/* Message Input */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Message</label>
                        <span className={`text-[10px] font-bold ${message.length < 27 ? "text-red-400" : "text-zinc-600"}`}>
                            {message.length} / 27 min
                        </span>
                    </div>
                    <textarea
                        placeholder="Write your tip message here... (min 27 chars)"
                        value={message}
                        maxLength={500}
                        onChange={(e) => {
                            if (e.target.value.length <= 500) setMessage(e.target.value);
                        }}
                        className={`w-full bg-zinc-900/30 border rounded-2xl p-5 text-white focus:ring-2 outline-none transition-all placeholder:text-zinc-700 resize-none h-32 text-sm font-medium leading-relaxed ${message.length > 0 && message.length < 27
                            ? "border-red-500/20 focus:ring-red-500/20 focus:border-red-500/50"
                            : "border-white/5 focus:ring-purple-500/20 focus:border-purple-500/50"
                            }`}
                    />
                </div>

                {/* Name Input */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Name</label>
                        <span className="text-[10px] font-bold text-zinc-600">{senderName.length}/20</span>
                    </div>

                    {ensName && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {/* ENS Name Toggle */}
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${useEnsNameFlag ? "bg-purple-500/10 border-purple-500/50" : "bg-zinc-900/40 border-white/5 hover:bg-zinc-800"}`}>
                                <input
                                    type="checkbox"
                                    checked={useEnsNameFlag}
                                    onChange={(e) => {
                                        setUseEnsNameFlag(e.target.checked);
                                        if (e.target.checked) setSenderName(ensName);
                                    }}
                                    className="accent-purple-500 w-3 h-3 rounded-sm"
                                />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${useEnsNameFlag ? "text-purple-400" : "text-zinc-500"}`}>Use ENS Name</span>
                            </label>

                            {/* ENS Avatar Toggle */}
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${ensAvatarUrl ? "cursor-pointer" : "opacity-50 cursor-not-allowed"} ${useEnsAvatarFlag && ensAvatarUrl ? "bg-purple-500/10 border-purple-500/50" : "bg-zinc-900/40 border-white/5 hover:bg-zinc-800"}`}>
                                <input
                                    type="checkbox"
                                    checked={useEnsAvatarFlag}
                                    onChange={(e) => setUseEnsAvatarFlag(e.target.checked)}
                                    disabled={!ensAvatarUrl}
                                    className="accent-purple-500 w-3 h-3 rounded-sm"
                                />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${useEnsAvatarFlag && ensAvatarUrl ? "text-purple-400" : "text-zinc-500"}`}>Avatar</span>
                            </label>

                            {/* ENS Background Toggle */}
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${ensHeader ? "cursor-pointer" : "opacity-50 cursor-not-allowed"} ${useEnsBackgroundFlag && ensHeader ? "bg-purple-500/10 border-purple-500/50" : "bg-zinc-900/40 border-white/5 hover:bg-zinc-800"}`}>
                                <input
                                    type="checkbox"
                                    checked={useEnsBackgroundFlag}
                                    onChange={(e) => setUseEnsBackgroundFlag(e.target.checked)}
                                    disabled={!ensHeader}
                                    className="accent-purple-500 w-3 h-3 rounded-sm"
                                />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${useEnsBackgroundFlag && ensHeader ? "text-purple-400" : "text-zinc-500"}`}>Background</span>
                            </label>

                            {/* ENS Twitter Toggle */}
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${ensTwitter ? "cursor-pointer" : "opacity-50 cursor-not-allowed"} ${useEnsTwitterFlag && ensTwitter ? "bg-purple-500/10 border-purple-500/50" : "bg-zinc-900/40 border-white/5 hover:bg-zinc-800"}`}>
                                <input
                                    type="checkbox"
                                    checked={useEnsTwitterFlag}
                                    onChange={(e) => setUseEnsTwitterFlag(e.target.checked)}
                                    disabled={!ensTwitter}
                                    className="accent-purple-500 w-3 h-3 rounded-sm"
                                />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${useEnsTwitterFlag && ensTwitter ? "text-purple-400" : "text-zinc-500"}`}>Twitter</span>
                            </label>
                        </div>
                    )}

                    <input
                        type="text"
                        placeholder="Your Name (optional)"
                        value={senderName}
                        maxLength={20}
                        onChange={(e) => {
                            if (useEnsNameFlag) return;
                            const val = e.target.value.replace(/\./g, ""); // Remove periods
                            if (val.length <= 20) setSenderName(val);
                        }}
                        readOnly={useEnsNameFlag}
                        className={`w-full bg-zinc-900/30 border border-white/5 rounded-2xl p-4 text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 outline-none transition-all placeholder:text-zinc-700 text-sm font-bold ${useEnsNameFlag ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                </div>

                {/* Actions */}
                <div className="space-y-4 pt-4">
                    {/* Settings Button (Above Connected Status) */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 text-xs font-bold uppercase tracking-wider ${isSettingsOpen ? "bg-zinc-800 border-white/20 text-white" : "bg-zinc-900/40 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-white"}`}
                        >
                            <Settings size={14} />
                            Transaction Settings
                        </button>
                    </div>

                    {/* Settings Panel (Expandable) */}
                    {isSettingsOpen && (
                        <div className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 space-y-4">
                            {/* Slippage */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Slippage Tolerance</label>
                                    <span className="text-xs font-mono text-zinc-400">{slippageMode === "auto" ? "0.5%" : `${customSlippage}%`}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSlippageMode("auto")}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${slippageMode === "auto" ? "bg-purple-500 text-white border-purple-500" : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700"}`}
                                    >
                                        AUTO
                                    </button>
                                    <div className="flex-1 relative">
                                        <input
                                            type="number"
                                            placeholder="0.5"
                                            value={customSlippage}
                                            onChange={(e) => {
                                                setSlippageMode("custom");
                                                setCustomSlippage(e.target.value);
                                            }}
                                            className={`w-full py-1.5 px-2 text-xs font-bold rounded-lg border bg-zinc-800 text-white focus:outline-none transition-all text-right pr-6 ${slippageMode === "custom" ? "border-purple-500" : "border-white/5"}`}
                                        />
                                        <span className="absolute right-2 top-1.5 text-xs text-zinc-500 pointer-events-none">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Gas */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Gas Price</label>
                                    <span className="text-xs font-mono text-zinc-400 uppercase">{gasMode}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setGasMode("auto")}
                                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${gasMode === "auto" ? "bg-green-500 text-white border-green-500" : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700"}`}
                                    >
                                        AUTO
                                    </button>
                                    <button
                                        onClick={() => setGasMode("fast")}
                                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${gasMode === "fast" ? "bg-blue-500 text-white border-blue-500" : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700"}`}
                                    >
                                        FAST
                                    </button>
                                    <button
                                        onClick={() => setGasMode("instant")}
                                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${gasMode === "instant" ? "bg-red-500 text-white border-red-500" : "bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700"}`}
                                    >
                                        INSTANT
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`w-full transition-all duration-300 ${isConnected && currentAddress ? "flex items-center justify-between px-5 py-4 bg-zinc-900/40 rounded-2xl border border-white/5 backdrop-blur-sm" : ""}`}>
                        {isConnected && currentAddress ? (
                            <>
                                <div className="flex items-center gap-4 w-full overflow-hidden">
                                    <div className="flex flex-col w-full">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Connected Wallet</span>
                                        <span className="text-sm font-bold text-zinc-200 font-mono truncate w-full tracking-tight">
                                            {currentAddress}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    className="text-[10px] font-black text-red-400 hover:text-red-300 transition-colors px-4 py-2 rounded-lg hover:bg-red-500/10 uppercase tracking-wider"
                                >
                                    Disconnect
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
                                disabled={loading || !amount || parseFloat(amount) <= 0 || message.length < 27}
                                className="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 transition-all duration-200 text-black font-bold text-lg uppercase tracking-wide active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-3 border-zinc-300 border-t-black rounded-full animate-spin" />
                                        <span className="text-lg">Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        Send
                                        <Coins className="w-5 h-5 opacity-80" />
                                    </>
                                )}
                            </button>
                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-xs animate-in fade-in slide-in-from-top-1">
                                    <div className="bg-red-500/20 p-1.5 rounded-full shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                    </div>
                                    <p className="font-bold leading-relaxed pt-0.5">{error}</p>
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


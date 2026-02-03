"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useSendTransaction, useBalance, useSwitchChain, useReadContracts, useWriteContract, useConfig, useDisconnect } from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseEther, formatEther, erc20Abi, parseUnits } from "viem";
import { mainnet, base, optimism } from "wagmi/chains";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Check, ChevronDown, Wallet, Coins } from "lucide-react";

// Mainnet Chain IDs
const CHAINS = [
    { id: mainnet.id, name: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png" },
    { id: base.id, name: "Base", logo: "https://avatars.githubusercontent.com/u/108554348?s=200&v=4" },
    { id: optimism.id, name: "Optimism", logo: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png" },
];

interface Token {
    symbol: string;
    name: string;
    address: string;
    logo?: string;
    decimals: number;
}

const POPULAR_SYMBOLS = ["ETH", "USDC", "USDT", "DAI", "WBTC", "WETH"];

const PRESET_AMOUNTS = ["0.001", "0.01", "0.05", "0.1"];

interface LifiTipProps {
    recipientAddress: string;
    onSuccess: (txHash: string, amount: string, message: string, senderName: string) => void;
    onStatus: (status: string) => void;
}

export function LifiTip({ recipientAddress, onSuccess, onStatus }: LifiTipProps) {
    const { address, chain, isConnected } = useAccount();
    const { switchChainAsync } = useSwitchChain();
    const { disconnect } = useDisconnect();
    const { sendTransactionAsync } = useSendTransaction();
    const config = useConfig();

    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("");
    const [senderName, setSenderName] = useState("");
    const [error, setError] = useState("");

    // Selectors
    const [selectedChainId, setSelectedChainId] = useState<number>(mainnet.id);
    const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
    const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
    const [tokens, setTokens] = useState<Token[]>([]);
    const [selectedAsset, setSelectedAsset] = useState<Token | null>(null);

    const [loading, setLoading] = useState(false);

    // Initialize tokens with Native Asset for selected chain
    useEffect(() => {
        const fetchTokens = async () => {
            // 1. Native Token (Address Zero)
            const nativeToken: Token = {
                symbol: "ETH", // Default, will update if chain has diff native
                name: "Native Token",
                address: "0x0000000000000000000000000000000000000000",
                decimals: 18,
                logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png"
            };

            // Attempt to get more accurate Native info from Wagmi chain definition if available
            const targetChain = CHAINS.find(c => c.id === selectedChainId);

            let fetchedTokens: Token[] = [nativeToken];

            try {
                // Try fetching from LI.FI
                // Note: LI.FI mainnet API might return 400 for Testnets. 
                const response = await fetch(`https://li.quest/v1/tokens?chains=${selectedChainId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.tokens && data.tokens[selectedChainId]) {
                        const lifiTokens = data.tokens[selectedChainId].map((t: any) => ({
                            symbol: t.symbol,
                            name: t.name,
                            address: t.address,
                            logo: t.logoURI,
                            decimals: t.decimals
                        }));
                        // Filter out native if LI.FI returns it as 0x0...0 to avoid dupe, or just merge
                        const nonNative = lifiTokens.filter((t: any) => t.address !== "0x0000000000000000000000000000000000000000");
                        fetchedTokens = [...fetchedTokens, ...nonNative];
                    }
                }
            } catch (e) {
                console.log("Failed to fetch LI.FI tokens, using native only", e);
            }

            setTokens(fetchedTokens);
            // Default to native if current selection not valid?
            setSelectedAsset(prev => fetchedTokens.find(t => t.symbol === prev?.symbol) || fetchedTokens[0]);
        };

        fetchTokens();
    }, [selectedChainId]);

    // Fetch Balance for selected asset on selected chain
    const { data: balanceData } = useBalance({
        address: address,
        chainId: selectedChainId,
        token: (selectedAsset?.address === "0x0000000000000000000000000000000000000000" || !selectedAsset) ? undefined : selectedAsset.address as `0x${string}`,
    });

    // Strategy: We can't fetch balances for ALL tokens (too many).
    // so we identify "Tokens to Check": Native + Popular Tokens found in list.
    const tokensToCheck = useMemo(() => {
        if (!tokens.length) return [];
        // Always include Native (handled separately by useBalance usually, but for list sorting we might want it)
        // Actually native balance is fetched via useBalance. ERC20s via useReadContracts.

        // Find popular tokens in the list
        const popular = tokens.filter(t => POPULAR_SYMBOLS.includes(t.symbol) && t.address !== "0x0000000000000000000000000000000000000000");

        // Also take top 10 from the list just in case
        const top10 = tokens.slice(0, 10).filter(t => t.address !== "0x0000000000000000000000000000000000000000" && !POPULAR_SYMBOLS.includes(t.symbol));

        return [...popular, ...top10];
    }, [tokens]);

    // Batch fetch balances for these tokens
    const { data: tokenBalances } = useReadContracts({
        contracts: tokensToCheck.map(t => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
            chainId: selectedChainId,
        })),
        query: {
            enabled: !!address && tokensToCheck.length > 0,
            refetchInterval: 10000,
        }
    });

    // Native Balance for sorting
    const { data: nativeBalance } = useBalance({ address, chainId: selectedChainId });

    // Computed Sorted Tokens
    const sortedTokens = useMemo(() => {
        if (!tokens.length) return [];

        return [...tokens].sort((a, b) => {
            // Get balances
            let balA = BigInt(0);
            let balB = BigInt(0);

            // Resolve A
            if (a.address === "0x0000000000000000000000000000000000000000") {
                balA = nativeBalance?.value || BigInt(0);
            } else {
                const idx = tokensToCheck.findIndex(t => t.address === a.address);
                if (idx !== -1 && tokenBalances?.[idx]?.result) {
                    balA = tokenBalances[idx].result as bigint;
                }
            }

            // Resolve B
            if (b.address === "0x0000000000000000000000000000000000000000") {
                balB = nativeBalance?.value || BigInt(0);
            } else {
                const idx = tokensToCheck.findIndex(t => t.address === b.address);
                if (idx !== -1 && tokenBalances?.[idx]?.result) {
                    balB = tokenBalances[idx].result as bigint;
                }
            }

            // Sort by Balance (Desc)
            if (balA > BigInt(0) && balB === BigInt(0)) return -1;
            if (balB > BigInt(0) && balA === BigInt(0)) return 1;
            if (balA > BigInt(0) && balB > BigInt(0)) {
                return balA > balB ? -1 : 1; // Basic bigint compare, not normalized by decimals but good enough for grouping non-zero
            }

            // Secondary: Priority for Popular
            const isPopularA = POPULAR_SYMBOLS.includes(a.symbol);
            const isPopularB = POPULAR_SYMBOLS.includes(b.symbol);
            if (isPopularA && !isPopularB) return -1;
            if (isPopularB && !isPopularA) return 1;

            return 0;
        });
    }, [tokens, tokenBalances, nativeBalance, tokensToCheck]);

    // Sync chain selection with wallet if connected
    const handleChainSelect = async (chainId: number) => {
        setSelectedChainId(chainId);
        if (chain?.id !== chainId && switchChainAsync) {
            try {
                await switchChainAsync({ chainId });
            } catch (e) {
                console.error("Failed to switch chain", e);
            }
        }
    };

    const { writeContractAsync } = useWriteContract();

    const handleBridgeAndTip = async () => {
        if (!address || !recipientAddress || !amount || !selectedAsset) return;

        setLoading(true);
        setError(""); // Clear previous errors

        try {
            // 0. Ensure we are on the correct chain
            if (chain?.id !== selectedChainId) {
                onStatus(`Switching to ${CHAINS.find(c => c.id === selectedChainId)?.name || "selected chain"}...`);
                await switchChainAsync({ chainId: selectedChainId });
            }

            onStatus("Processing Fee & Quote...");
            // 1. Calculate Fee internally for logging/display if needed, but LiFi handles the split.
            // We request a quote for the FULL amount, and LiFi subtracts the fee?
            // "The fee parameter represents the percentage of the integrator's fee that will be deducted from every transaction"
            // So if user sends 100, and fee is 0.01. The bridge gets 99, we get 1.

            // We don't need to manually send the fee anymore!

            onStatus("Fetching quote from LI.FI (with 1% fee)...");

            const fromToken = selectedAsset.address;
            const toToken = "0x0000000000000000000000000000000000000000"; // Always tip ETH/Native on dest

            const params = new URLSearchParams({
                fromChain: selectedChainId.toString(),
                toChain: base.id.toString(), // Hardcoded to Base for now per plan
                fromToken: fromToken,
                toToken: toToken,
                toAddress: recipientAddress,
                fromAmount: parseEther(amount).toString(), // Send FULL amount
                fromAddress: address,
                // INTEGRATOR FEE PARAMS
                integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "only-tokens-tips",
                fee: "0.01", // 1%
            });

            // If source == dest, just send normal tx (optimization)
            if (selectedChainId === base.id) { // Assuming receiver is on Base
                // Fallback to direct send if logic requires
            }

            const headers: HeadersInit = {
                'accept': 'application/json',
            };

            const apiKey = process.env.NEXT_PUBLIC_LIFI_API_KEY;
            if (apiKey) {
                headers['x-lifi-api-key'] = apiKey;
            }

            const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, {
                method: 'GET',
                headers: headers
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to fetch quote");
            }

            const quote = await response.json();

            // --- ERC20 APPROVAL CHECK ---
            if (quote.transactionRequest.to && selectedAsset.address !== "0x0000000000000000000000000000000000000000") {
                const approvalAddress = quote.transactionRequest.to as `0x${string}`; // Usually the LiFi Diamond or a DEX router
                const tokenAddress = selectedAsset.address as `0x${string}`;
                const amountBigInt = BigInt(quote.estimate.fromAmount); // Amount we need to spend

                // Check Allowance
                const allowanceResult = await readContract(config, {
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'allowance',
                    args: [address, approvalAddress],
                    chainId: selectedChainId,
                });

                const currentAllowance = allowanceResult as bigint;

                if (currentAllowance < amountBigInt) {
                    onStatus(`Approving ${selectedAsset.symbol}...`);

                    const approveTx = await writeContractAsync({
                        address: tokenAddress,
                        abi: erc20Abi,
                        functionName: 'approve',
                        args: [approvalAddress, amountBigInt],
                        chainId: selectedChainId,
                    });

                    onStatus("Waiting for Approval Confirmation...");
                    await waitForTransactionReceipt(config, { hash: approveTx });
                    onStatus("Approved! Initiating Bridge Transaction...");
                }
            }

            onStatus("Initiating Transaction...");

            const txHash = await sendTransactionAsync({
                to: quote.transactionRequest.to,
                data: quote.transactionRequest.data,
                value: BigInt(quote.transactionRequest.value),
            });

            onStatus("Transaction Sent! Waiting for confirmation...");
            onSuccess(txHash, amount, message, senderName);

        } catch (e: any) {
            console.error(e);
            // Only show detailed error locally, reset global status
            onStatus("");
            setError(e.message || "Transaction failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Chain & Asset Selection */}
            <div className="space-y-4">
                <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Source Chain</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <span>{CHAINS.find(c => c.id === selectedChainId)?.name || "Select Chain"}</span>
                            </div>
                            <ChevronDown size={16} className={`text-zinc-500 transition-transform ${chainDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {chainDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {CHAINS.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            handleChainSelect(c.id);
                                            setChainDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                    >
                                        <img src={c.logo} alt={c.name} className="w-5 h-5 rounded-full" />
                                        <span>{c.name}</span>
                                        {selectedChainId === c.id && <Check size={16} className="ml-auto text-purple-500" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {chainDropdownOpen && (
                            <div className="fixed inset-0 z-10" onClick={() => setChainDropdownOpen(false)}></div>
                        )}
                    </div>
                </div>

                <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Asset</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setAssetDropdownOpen(!assetDropdownOpen)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                {selectedAsset ? (
                                    <>
                                        {selectedAsset.logo ? (
                                            <img src={selectedAsset.logo} alt={selectedAsset.symbol} className="w-5 h-5 rounded-full" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center">
                                                <Coins size={12} className="text-zinc-400" />
                                            </div>
                                        )}
                                        <span>{selectedAsset.symbol}</span>
                                    </>
                                ) : (
                                    <span>Select Asset</span>
                                )}
                            </div>
                            <ChevronDown size={16} className={`text-zinc-500 transition-transform ${assetDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {assetDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
                                {sortedTokens.map((a, idx) => {
                                    let balStr = "";
                                    if (a.address === "0x0000000000000000000000000000000000000000") {
                                        if (nativeBalance) balStr = `(${parseFloat(formatEther(nativeBalance.value)).toFixed(4)})`;
                                    } else {
                                        const checkIdx = tokensToCheck.findIndex(t => t.address === a.address);
                                        if (checkIdx !== -1 && tokenBalances?.[checkIdx]?.result) {
                                            const raw = tokenBalances[checkIdx].result as bigint;
                                            if (raw > BigInt(0)) balStr = "(Has Balance)";
                                        }
                                    }

                                    return (
                                        <button
                                            key={`${a.symbol}-${idx}`}
                                            type="button"
                                            onClick={() => {
                                                setSelectedAsset(a);
                                                setAssetDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                                        >
                                            {a.logo ? (
                                                <img src={a.logo} alt={a.symbol} className="w-5 h-5 rounded-full" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center">
                                                    <Coins size={12} className="text-zinc-400" />
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{a.symbol}</span>
                                                <span className="text-xs text-zinc-500">{a.name} {balStr}</span>
                                            </div>
                                            {selectedAsset?.symbol === a.symbol && <Check size={16} className="ml-auto text-purple-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {assetDropdownOpen && (
                            <div className="fixed inset-0 z-10" onClick={() => setAssetDropdownOpen(false)}></div>
                        )}
                    </div>
                </div>
            </div>

            {/* Amount Input */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Amount</label>
                    <div className="text-xs text-zinc-500 font-mono">
                        Balance: {balanceData ? <span className="text-white">{parseFloat(formatEther(balanceData.value)).toFixed(4)} {balanceData.symbol}</span> : "..."}
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

            {/* Message Input */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Message</label>
                <textarea
                    placeholder="Write your tip message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-700 resize-none h-24 text-sm"
                />
            </div>

            {/* Name Input */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Name</label>
                <input
                    type="text"
                    placeholder="Your Name (optional)"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-700 text-sm"
                />
            </div>

            {/* Status & Error & Button */}
            <div className="space-y-4">
                {/* Wallet Status / Connect Button */}
                <div className="w-full flex items-center justify-between px-4 py-3 bg-zinc-950/80 rounded-xl border border-zinc-800/50 backdrop-blur-sm shadow-sm transition-all hover:border-zinc-700">
                    {isConnected && address ? (
                        <>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                    <Wallet size={16} className="text-green-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Connected</span>
                                    <span className="text-sm font-medium text-zinc-300 font-mono">
                                        {address.slice(0, 6)}...{address.slice(-4)}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => disconnect()}
                                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                            >
                                DISCONNECT
                            </button>
                        </>
                    ) : (
                        <div className="w-full">
                            <ConnectButton.Custom>
                                {({ openConnectModal }) => (
                                    <button
                                        onClick={openConnectModal}
                                        className="w-full flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                                                <Wallet size={16} className="text-purple-500" />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</span>
                                                <span className="text-sm font-medium text-zinc-300">Wallet Disconnected</span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300 transition-colors bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
                                            CONNECT
                                        </span>
                                    </button>
                                )}
                            </ConnectButton.Custom>
                        </div>
                    )}
                </div>

                {isConnected && (
                    <>
                        <button
                            onClick={() => {
                                setError(""); // Clear error on retry
                                handleBridgeAndTip();
                            }}
                            disabled={loading || !amount || parseFloat(amount) <= 0}
                            className="w-full p-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Bridge & Tip"
                            )}
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
        </div>
    );
}

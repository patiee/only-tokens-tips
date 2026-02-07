"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Check, Coins, Search } from "lucide-react";
import { allChains, chainFamilies, ChainFamily, isValidAddress } from "@/config/chains";
import { useTokenList, Token } from "@/hooks/useTokenList";
import { useReadContracts } from "wagmi";
import { erc20Abi } from "viem";

interface WalletNetworkSelectorProps {
    selectedChainId: number;
    onChainSelect: (chainId: number) => void;
    selectedAsset: Token | null;
    onAssetSelect: (asset: Token) => void;
    label?: string;
    includeBalance?: boolean; // If we want to show balances (requires address prop?)
    preferredAssetAddress?: string;
}

// Helper to group chains
const groupedChains = chainFamilies.map(family => ({
    family,
    chains: allChains.filter(c => c.family === family)
}));

export function WalletNetworkSelector({
    selectedChainId,
    onChainSelect,
    selectedAsset,
    onAssetSelect,
    preferredAssetAddress
}: WalletNetworkSelectorProps) {
    // State
    const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
    const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
    const [chainSearch, setChainSearch] = useState("");
    const [assetSearch, setAssetSearch] = useState("");

    // Data
    const { tokens, loading } = useTokenList(selectedChainId);
    const selectedChain = allChains.find(c => c.id === selectedChainId);

    // Custom Token Logic
    const [customToken, setCustomToken] = useState<Token | null>(null);
    const isEVM = selectedChain?.family === ChainFamily.EVM;
    const isValidInputInfo = selectedChain ? isValidAddress(assetSearch, selectedChain.family) : false;

    // EVM Custom Token Fetch
    const { data: customTokenData } = useReadContracts({
        contracts: [
            {
                address: (isValidInputInfo && isEVM) ? assetSearch as `0x${string}` : undefined,
                abi: erc20Abi,
                functionName: 'symbol',
                chainId: selectedChainId,
            },
            {
                address: (isValidInputInfo && isEVM) ? assetSearch as `0x${string}` : undefined,
                abi: erc20Abi,
                functionName: 'name',
                chainId: selectedChainId,
            },
            {
                address: (isValidInputInfo && isEVM) ? assetSearch as `0x${string}` : undefined,
                abi: erc20Abi,
                functionName: 'decimals',
                chainId: selectedChainId,
            }
        ],
        query: {
            enabled: !!isValidInputInfo && isEVM && !tokens.some(t => t.address.toLowerCase() === assetSearch.toLowerCase()),
            retry: false
        }
    });

    useEffect(() => {
        if (customTokenData && customTokenData[0]?.result && customTokenData[1]?.result && customTokenData[2]?.result !== undefined) {
            setCustomToken({
                address: assetSearch,
                symbol: customTokenData[0].result as string,
                name: customTokenData[1].result as string,
                decimals: Number(customTokenData[2].result),
                logo: undefined
            });
        }
    }, [customTokenData, assetSearch]);

    // Non-EVM Custom Token (DexScreener)
    useEffect(() => {
        if (isValidInputInfo && !isEVM && !tokens.some(t => t.address.toLowerCase() === assetSearch.toLowerCase())) {
            fetch(`https://api.dexscreener.com/latest/dex/tokens/${assetSearch}`)
                .then(res => res.json())
                .then(data => {
                    if (data.pairs && data.pairs.length > 0) {
                        const pair = data.pairs[0];
                        const baseToken = pair.baseToken;
                        setCustomToken({
                            address: baseToken.address,
                            symbol: baseToken.symbol,
                            name: baseToken.name,
                            decimals: 9, // Default
                            logo: undefined
                        });
                    }
                })
                .catch(err => console.error("Failed to fetch non-evm token", err));
        } else if (!isValidInputInfo) {
            setCustomToken(null);
        }
    }, [assetSearch, isValidInputInfo, isEVM, tokens]);

    // Filtered lists
    const filteredChains = useMemo(() => {
        if (!chainSearch) return groupedChains;
        return groupedChains.map(g => ({
            ...g,
            chains: g.chains.filter(c => c.name.toLowerCase().includes(chainSearch.toLowerCase()))
        })).filter(g => g.chains.length > 0);
    }, [chainSearch]);

    // Ensure valid selection
    useEffect(() => {
        if (tokens.length > 0) {
            // Check if current selected asset is valid for this list
            const isCurrentValid = selectedAsset && tokens.some(t => t.address.toLowerCase() === selectedAsset.address.toLowerCase());

            if (!isCurrentValid && !customToken) {
                // Try preference
                if (preferredAssetAddress) {
                    const match = tokens.find(t => t.address.toLowerCase() === preferredAssetAddress.toLowerCase());
                    if (match) {
                        onAssetSelect(match);
                        return;
                    }
                }
                // Default to first (Native)
                onAssetSelect(tokens[0]);
            }
        }
    }, [tokens, selectedAsset, onAssetSelect, customToken, preferredAssetAddress]);

    const filteredAssets = useMemo(() => {
        const lowerSearch = assetSearch.toLowerCase();
        let list = tokens.filter(t =>
            t.symbol.toLowerCase().includes(lowerSearch) ||
            t.name.toLowerCase().includes(lowerSearch) ||
            t.address.toLowerCase() === lowerSearch
        );

        if (customToken && assetSearch && customToken.address.toLowerCase() === lowerSearch && !list.some(t => t.address.toLowerCase() === customToken.address.toLowerCase())) {
            list.push(customToken);
        }
        return list;
    }, [tokens, assetSearch, customToken]);

    return (
        <div className="space-y-4 text-left">
            {/* Chain Selector */}
            <div className="space-y-2 relative">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Network</label>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between transition-all hover:border-zinc-700"
                    >
                        <div className="flex items-center gap-2">
                            {selectedChain?.logoURI ? <img src={selectedChain.logoURI} alt={selectedChain.name} className="w-5 h-5 rounded-full" /> : <div className="w-5 h-5 rounded-full bg-zinc-800" />}
                            <span>{selectedChain?.name || "Select Chain"}</span>
                        </div>
                        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${chainDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {chainDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-30 max-h-60 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">
                            <div className="p-2 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder="Search network..."
                                        value={chainSearch}
                                        onChange={(e) => setChainSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-48">
                                {filteredChains.map(group => (
                                    <div key={group.family}>
                                        <div className="px-4 py-2 text-xs font-bold text-zinc-500 bg-zinc-900/50 uppercase tracking-wider sticky top-0 backdrop-blur-sm">
                                            {group.family}
                                        </div>
                                        {group.chains.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    onChainSelect(c.id);
                                                    setChainDropdownOpen(false);
                                                    setChainSearch("");
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center justify-between group transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <img src={c.logoURI} alt={c.name} className="w-5 h-5 rounded-full" />
                                                    <span>{c.name}</span>
                                                </div>
                                                {selectedChainId === c.id && <Check size={16} className="text-blue-500" />}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                                {filteredChains.length === 0 && (
                                    <div className="px-4 py-3 text-zinc-500 text-sm italic">No networks found</div>
                                )}
                            </div>
                        </div>
                    )}
                    {chainDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setChainDropdownOpen(false)} />}
                </div>
            </div>

            {/* Asset Selector */}
            <div className="space-y-2 relative">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Asset</label>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setAssetDropdownOpen(!assetDropdownOpen)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between transition-all hover:border-zinc-700"
                    >
                        <div className="flex items-center gap-2">
                            {selectedAsset?.logo ? <img src={selectedAsset.logo} className="w-5 h-5 rounded-full" /> : <Coins size={16} className="text-zinc-500" />}
                            <span>{selectedAsset?.symbol || "Select Asset"}</span>
                        </div>
                        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${assetDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {assetDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-30 max-h-60 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">
                            <div className="p-2 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder="Search asset..."
                                        value={assetSearch}
                                        onChange={(e) => setAssetSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-48">
                                {loading && !filteredAssets.length ? (
                                    <div className="px-4 py-4 text-center text-zinc-500 text-xs">Loading tokens...</div>
                                ) : (
                                    filteredAssets.slice(0, 100).map((t, idx) => (
                                        <button
                                            key={`${t.address}-${idx}`}
                                            type="button"
                                            onClick={() => {
                                                onAssetSelect(t);
                                                setAssetDropdownOpen(false);
                                                setAssetSearch("");
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center justify-between group transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {t.logo ? <img src={t.logo} className="w-5 h-5 rounded-full" /> : <Coins size={16} className="text-zinc-500" />}
                                                <div>
                                                    <span className="text-sm font-medium block">{t.symbol}</span>
                                                    <span className="text-xs text-zinc-500 block">{t.name}</span>
                                                </div>
                                            </div>
                                            {selectedAsset?.address === t.address && <Check size={16} className="text-blue-500" />}
                                        </button>
                                    ))
                                )}
                                {!loading && filteredAssets.length === 0 && (
                                    <div className="px-4 py-3 text-zinc-500 text-sm italic">No assets found</div>
                                )}
                            </div>
                        </div>
                    )}
                    {assetDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setAssetDropdownOpen(false)} />}
                </div>
            </div>
        </div>
    );
}

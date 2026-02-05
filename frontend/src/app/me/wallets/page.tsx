"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ArrowLeft, Save, CheckCircle, AlertTriangle, ChevronDown, Coins } from "lucide-react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContracts } from "wagmi";
import { isAddress, erc20Abi } from "viem";
import { evmChains } from "@/config/generated-chains";

export type UserProfile = {
    username: string;
    eth_address: string;
    main_wallet: boolean;
    name?: string;
    avatar?: string;
    preferred_chain_id?: number;
    preferred_asset_address?: string;
};

function WalletsContent() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const router = useRouter();

    const { address, isConnected } = useAccount();

    // Preferences State
    const [selectedChainId, setSelectedChainId] = useState<number>(evmChains[0]?.id || 1);
    const [selectedAsset, setSelectedAsset] = useState<{ symbol: string; address: string; logo?: string; name?: string } | null>(null);
    const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
    const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
    const [chainSearch, setChainSearch] = useState("");
    const [assetSearch, setAssetSearch] = useState("");
    const [tokens, setTokens] = useState<any[]>([]);

    // Custom Token Import Logic
    const [customToken, setCustomToken] = useState<any>(null);
    const isSearchAddress = isAddress(assetSearch);
    const isCustomTokenAlreadyListed = tokens.some(t => isSearchAddress && t.address.toLowerCase() === assetSearch.toLowerCase());

    const { data: customTokenData } = useReadContracts({
        contracts: [
            {
                address: isSearchAddress ? assetSearch as `0x${string}` : undefined,
                abi: erc20Abi,
                functionName: 'symbol',
                chainId: selectedChainId,
            },
            {
                address: isSearchAddress ? assetSearch as `0x${string}` : undefined,
                abi: erc20Abi,
                functionName: 'name',
                chainId: selectedChainId,
            },
            {
                address: isSearchAddress ? assetSearch as `0x${string}` : undefined,
                abi: erc20Abi,
                functionName: 'decimals',
                chainId: selectedChainId,
            }
        ],
        query: {
            enabled: !!isSearchAddress && !isCustomTokenAlreadyListed,
            retry: false
        }
    });

    useEffect(() => {
        if (customTokenData && customTokenData[0].result && customTokenData[1].result && customTokenData[2].result !== undefined) {
            setCustomToken({
                address: assetSearch as `0x${string}`,
                symbol: customTokenData[0].result as string,
                name: customTokenData[1].result as string,
                decimals: Number(customTokenData[2].result),
                logo: undefined
            });
        } else {
            setCustomToken(null);
        }
    }, [customTokenData, assetSearch]);

    // Initialize Default Asset (Native) when chain changes
    useEffect(() => {
        const chain = evmChains.find(c => c.id === selectedChainId);
        if (chain) {
            const native = {
                symbol: chain.nativeToken.symbol,
                address: chain.nativeToken.address, // Usually 0x00..00
                logo: chain.nativeToken.logoURI,
                name: chain.nativeToken.name,
                decimals: chain.nativeToken.decimals
            };

            // Fetch more tokens from LiFi
            fetch(`https://li.quest/v1/tokens?chains=${selectedChainId}`)
                .then(res => res.json())
                .then(data => {
                    let newTokens = [native];
                    if (data.tokens && data.tokens[selectedChainId]) {
                        const extraTokens = data.tokens[selectedChainId]
                            .filter((t: { address: string }) => t.address !== "0x0000000000000000000000000000000000000000")
                            .map((t: { symbol: string, name: string, address: string, logoURI: string, decimals: number }) => ({
                                symbol: t.symbol,
                                name: t.name,
                                address: t.address,
                                logo: t.logoURI,
                                decimals: t.decimals
                            }));
                        newTokens = [...newTokens, ...extraTokens];
                    }
                    setTokens(newTokens);

                    // If we have a profile preference for this chain, select it
                    if (profile && profile.preferred_chain_id === selectedChainId && profile.preferred_asset_address) {
                        const existing = newTokens.find(t => t.address.toLowerCase() === profile.preferred_asset_address?.toLowerCase());
                        if (existing) {
                            setSelectedAsset(existing);
                        } else if (profile.preferred_asset_address === native.address) {
                            setSelectedAsset(native);
                        } else if (!selectedAsset) {
                            // If custom token, it might not be in list yet, wait for import or ignore?
                            // For now default to native if not found
                            setSelectedAsset(native);
                        }
                    } else if (!selectedAsset) {
                        setSelectedAsset(native);
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch tokens", err);
                    setTokens([native]);
                    if (!selectedAsset) setSelectedAsset(native);
                });
        }
    }, [selectedChainId]);

    // Load Profile
    useEffect(() => {
        const token = localStorage.getItem("user_token");
        if (!token) {
            router.push("/auth");
            return;
        }

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me?token=` + token)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch profile");
                return res.json();
            })
            .then(data => {
                setProfile(data);
                if (data.preferred_chain_id) {
                    setSelectedChainId(data.preferred_chain_id);
                }
                // Asset selection is handled in the chain effect once tokens load
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Failed to load profile. Please try again.");
                setLoading(false);
            });
    }, [router]);


    const handleSaveWallet = async () => {
        // Allow saving even if address hasn't changed, to update preferences
        setSaving(true);
        setError("");
        setMessage("");

        const token = localStorage.getItem("user_token");
        if (!token) return;

        // Use current connected address OR existing profile address if not connected/same
        // But logic says: if connected & different => update wallet
        // If not connected or same => just update preferences
        let addressToSave = profile?.eth_address || "";
        if (isConnected && address && address.toLowerCase() !== profile?.eth_address.toLowerCase()) {
            addressToSave = address;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me/wallet`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    eth_address: addressToSave,
                    preferred_chain_id: selectedChainId,
                    preferred_asset_address: selectedAsset?.address || "0x0000000000000000000000000000000000000000"
                })
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error("JSON Parse Error:", jsonErr);
                throw new Error(`Invalid server response: ${text.substring(0, 100)}...`);
            }

            if (!res.ok) {
                throw new Error(data.error || "Failed to update wallet settings");
            }

            // Success
            setProfile(prev => prev ? {
                ...prev,
                eth_address: addressToSave,
                preferred_chain_id: selectedChainId,
                preferred_asset_address: selectedAsset?.address
            } : null);
            setMessage("Wallet settings updated successfully!");
        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>
    );

    if (error && !profile) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
            <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl max-w-md w-full text-center">
                <h2 className="text-xl font-bold mb-2 text-white">Access Failed</h2>
                <p className="text-zinc-400 mb-6">{error}</p>
                <Link href="/me" className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-sm">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );

    const isDifferent = profile && address && profile.eth_address.toLowerCase() !== address.toLowerCase();
    const selectedChain = evmChains.find(c => c.id === selectedChainId);

    // Check if preferences changed (dirty state)
    const prefsChanged = profile && (profile.preferred_chain_id !== selectedChainId || profile.preferred_asset_address?.toLowerCase() !== selectedAsset?.address.toLowerCase());
    const canSave = isDifferent || prefsChanged;

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-8">

                <div className="flex items-center gap-4">
                    <Link href="/me" className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-bold">Manage Wallets</h1>
                </div>

                {message && (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle size={20} />
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle size={20} />
                        {error}
                    </div>
                )}

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                            <Wallet className="text-blue-400" /> Wallet Preferences
                        </h2>
                        <p className="text-zinc-400 text-sm">
                            Configure your main wallet and preferred tip currency.
                        </p>
                    </div>

                    {/* Preferences Section */}
                    <div className="space-y-4 pt-2">
                        <div className="space-y-3 text-left">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Preferred Network</label>

                            {/* Chain Selector */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        {selectedChain?.logoURI && <img src={selectedChain.logoURI} alt={selectedChain.name} className="w-5 h-5 rounded-full" />}
                                        <span>{selectedChain?.name || "Select Chain"}</span>
                                    </div>
                                    <ChevronDown size={16} className={`text-zinc-500 ${chainDropdownOpen ? "rotate-180" : ""}`} />
                                </button>

                                {chainDropdownOpen && (
                                    <div className="absolute top-0 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 max-h-60 overflow-hidden flex flex-col">
                                        <div className="p-2 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                                            <input
                                                type="text"
                                                placeholder="Search network..."
                                                value={chainSearch}
                                                onChange={(e) => setChainSearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="overflow-y-auto max-h-48">
                                            {evmChains
                                                .filter(c => c.name.toLowerCase().includes(chainSearch.toLowerCase()))
                                                .map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => { setSelectedChainId(c.id); setChainDropdownOpen(false); setChainSearch(""); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-2"
                                                    >
                                                        <img src={c.logoURI} alt={c.name} className="w-5 h-5 rounded-full" />
                                                        <span>{c.name}</span>
                                                    </button>
                                                ))}
                                            {evmChains.filter(c => c.name.toLowerCase().includes(chainSearch.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-zinc-500 text-sm italic">No networks found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {chainDropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setChainDropdownOpen(false)} />}
                            </div>
                        </div>

                        <div className="space-y-3 text-left">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Preferred Asset</label>

                            {/* Asset Selector */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setAssetDropdownOpen(!assetDropdownOpen)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        {selectedAsset?.logo ? <img src={selectedAsset.logo} className="w-5 h-5 rounded-full" /> : <Coins size={16} className="text-zinc-500" />}
                                        <span>{selectedAsset?.symbol || "Select Asset"}</span>
                                    </div>
                                    <ChevronDown size={16} className={`text-zinc-500 ${assetDropdownOpen ? "rotate-180" : ""}`} />
                                </button>

                                {assetDropdownOpen && (
                                    <div className="absolute top-0 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 max-h-60 overflow-hidden flex flex-col">
                                        <div className="p-2 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                                            <input
                                                type="text"
                                                placeholder="Search asset..."
                                                value={assetSearch}
                                                onChange={(e) => setAssetSearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="overflow-y-auto max-h-48">
                                            {(() => {
                                                const filtered = tokens
                                                    .filter(t => t.symbol.toLowerCase().includes(assetSearch.toLowerCase()) || t.name.toLowerCase().includes(assetSearch.toLowerCase()) || t.address.toLowerCase() === assetSearch.toLowerCase());

                                                if (customToken && assetSearch && customToken.address.toLowerCase() === assetSearch.toLowerCase() && !filtered.some(t => t.address.toLowerCase() === customToken.address.toLowerCase())) {
                                                    filtered.push(customToken);
                                                }

                                                return filtered.slice(0, 100).map((t, idx) => (
                                                    <button
                                                        key={`${t.symbol}-${idx}`}
                                                        type="button"
                                                        onClick={() => { setSelectedAsset(t); setAssetDropdownOpen(false); setAssetSearch(""); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-2"
                                                    >
                                                        {t.logo ? <img src={t.logo} className="w-5 h-5 rounded-full" /> : <Coins size={16} />}
                                                        <div className="flex flex-col text-left">
                                                            <span className="text-sm font-medium">{t.symbol}</span>
                                                            <span className="text-xs text-zinc-500">{t.name}</span>
                                                        </div>
                                                    </button>
                                                ));
                                            })()}
                                            {tokens.filter(t => t.symbol.toLowerCase().includes(assetSearch.toLowerCase()) || t.name.toLowerCase().includes(assetSearch.toLowerCase()) || t.address.toLowerCase() === assetSearch.toLowerCase()).length === 0 && !customToken && (
                                                <div className="px-4 py-3 text-zinc-500 text-sm italic">No assets found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {assetDropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setAssetDropdownOpen(false)} />}
                            </div>
                        </div>
                    </div>


                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col gap-2">
                        <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Current Main Wallet</span>
                        <code className="font-mono text-zinc-300 break-all">{profile?.eth_address || "Not set"}</code>
                    </div>

                    <div className="border-t border-zinc-800 pt-6">
                        <h3 className="text-sm font-bold text-zinc-300 mb-4">Connect New Wallet</h3>
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <ConnectButton showBalance={false} chainStatus="none" />

                            <button
                                onClick={handleSaveWallet}
                                disabled={saving || !canSave}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:shadow-none"
                            >
                                {saving ? (
                                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save Changes
                            </button>
                        </div>
                        {isConnected && !isDifferent && (
                            <p className="text-xs text-zinc-500 mt-4 text-center sm:text-left">
                                Connected wallet matches your current main wallet.
                            </p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function WalletsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <WalletsContent />
        </Suspense>
    );
}

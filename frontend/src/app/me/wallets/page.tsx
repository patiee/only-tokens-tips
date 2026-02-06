"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ArrowLeft, Save, CheckCircle, AlertTriangle, ChevronDown, Coins } from "lucide-react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContracts } from "wagmi";
import { isAddress, erc20Abi } from "viem";
import { evmChains } from "@/config/generated-chains";
import { allChains, chainFamilies, ChainFamily, CustomChainConfig, isValidAddress } from "@/config/chains";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

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
    const { publicKey, connected: solanaConnected } = useWallet();

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
    const selectedChain = allChains.find(c => c.id === selectedChainId);

    // Determine validity based on family
    const isValidInputInfo = selectedChain ? isValidAddress(assetSearch, selectedChain.family) : false;
    const isEVM = selectedChain?.family === ChainFamily.EVM;

    // EVM: Use Wagmi
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

    // EVM Effect
    useEffect(() => {
        if (customTokenData && customTokenData[0]?.result && customTokenData[1]?.result && customTokenData[2]?.result !== undefined) {
            setCustomToken({
                address: assetSearch as `0x${string}`,
                symbol: customTokenData[0].result as string,
                name: customTokenData[1].result as string,
                decimals: Number(customTokenData[2].result),
                logo: undefined
            });
        }
    }, [customTokenData, assetSearch]);

    // Non-EVM (Solana/Sui/BTC) Effect - Using DexScreener
    useEffect(() => {
        if (isValidInputInfo && !isEVM && !tokens.some(t => t.address.toLowerCase() === assetSearch.toLowerCase())) {
            // Fetch from DexScreener
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
                            decimals: 9, // DexScreener doesn't always return decimals, default to 9 or 18?
                            logo: undefined
                        });
                    }
                })
                .catch(err => console.error("Failed to fetch non-evm token", err));
        } else if (!isValidInputInfo) {
            setCustomToken(null);
        }
    }, [assetSearch, isValidInputInfo, isEVM, tokens]);

    const handleChainSelect = (chainId: number) => {
        const newChain = allChains.find(c => c.id === chainId);

        setSelectedChainId(chainId);
        setChainDropdownOpen(false);
        setChainSearch("");

        if (newChain) {
            const native = {
                symbol: newChain.nativeToken.symbol,
                address: newChain.nativeToken.address,
                logo: newChain.nativeToken.logoURI,
                name: newChain.nativeToken.name,
                decimals: newChain.nativeToken.decimals
            };
            // Default to native, useEffect will fetch more if EVM
            setSelectedAsset(native);
            setTokens([native]);
        }
    };

    // Initialize Default Asset (Native) when chain changes
    useEffect(() => {
        const chain = allChains.find(c => c.id === selectedChainId);
        if (chain) {
            const native = {
                symbol: chain.nativeToken.symbol,
                address: chain.nativeToken.address, // Usually 0x00..00
                logo: chain.nativeToken.logoURI,
                name: chain.nativeToken.name,
                decimals: chain.nativeToken.decimals
            };

            // Helper to set selected asset based on profile
            function checkAndSetSelected(tokenList: any[], nativeTok: any) {
                if (profile && profile.preferred_chain_id === chain?.id && profile.preferred_asset_address) {
                    const existing = tokenList.find(t => t.address.toLowerCase() === profile.preferred_asset_address?.toLowerCase());
                    if (existing) {
                        setSelectedAsset(existing);
                    } else if (profile.preferred_asset_address === nativeTok.address) {
                        setSelectedAsset(nativeTok);
                    } else if (!selectedAsset) {
                        setSelectedAsset(nativeTok);
                    }
                } else if (selectedAsset) {
                    const currentStillValid = tokenList.find(t => t.address.toLowerCase() === selectedAsset.address.toLowerCase());
                    if (!currentStillValid) {
                        setSelectedAsset(nativeTok);
                    }
                } else {
                    setSelectedAsset(nativeTok);
                }
            }

            // Only fetch LiFi tokens if it's an EVM chain
            if (chain.family === ChainFamily.EVM) {
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
                        checkAndSetSelected(newTokens, native);
                    })
                    .catch(err => {
                        console.error("Failed to fetch tokens", err);
                        setTokens([native]);
                        checkAndSetSelected([native], native);
                    });
            } else if (chain.family === ChainFamily.SOLANA) {
                // Fetch from Jupiter Strict List via Proxy
                fetch('/api/jupiter/tokens')
                    .then(res => {
                        if (!res.ok) throw new Error("Failed to fetch");
                        return res.json();
                    })
                    .then(data => {
                        // Data is array of { address, chainId, decimals, name, symbol, logoURI }
                        // Filter for Solana? Jup API is Solana only usually.
                        const solTokens = data.slice(0, 100).map((t: any) => ({
                            symbol: t.symbol,
                            name: t.name,
                            address: t.address,
                            logo: t.logoURI,
                            decimals: t.decimals
                        }));
                        // Add Native SOL at top if not present (Jup usually has Wrapped SOL)
                        // Our native address is '111...111'
                        let newTokens = [native, ...solTokens];
                        setTokens(newTokens);
                        checkAndSetSelected(newTokens, native);
                    })
                    .catch(err => {
                        console.error("Failed to fetch Solana tokens", err);
                        setTokens([native]);
                        checkAndSetSelected([native], native);
                    });
            } else {
                // Non-EVM other (BTC, SUI)
                setTokens([native]);
                checkAndSetSelected([native], native);
            }
        }
    }, [selectedChainId, profile]);

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
        setSaving(true);
        setError("");
        setMessage("");

        const token = localStorage.getItem("user_token");
        if (!token) return;

        let addressToSave = profile?.eth_address || "";

        // Logic to determine new address to save based on selected chain family
        if (selectedChain?.family === ChainFamily.SOLANA) {
            if (solanaConnected && publicKey) {
                addressToSave = publicKey.toBase58();
            }
        } else if (selectedChain?.family === ChainFamily.EVM) {
            if (isConnected && address) {
                addressToSave = address;
            }
        }

        // Only update if address is actually different from profile, OR if we are just saving preferences
        // But if user switched to Solana and connected a wallet, we want to save that as main wallet if they click save.

        // Actually, the requirement "Solana address as main wallet" implies we replace eth_address with solana address.
        // Backend treats 'eth_address' as generic 'main_wallet_address'.

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

    // Check if preferences changed (dirty state)
    const prefsChanged = profile && (profile.preferred_chain_id !== selectedChainId || profile.preferred_asset_address?.toLowerCase() !== selectedAsset?.address.toLowerCase());

    // Logic for Saving:
    const isFamilyMismatch = selectedChain && selectedChain.family !== ChainFamily.EVM;
    const canSave = (isDifferent || prefsChanged) && !isFamilyMismatch;

    // Grouping chains for dropdown
    const groupedChains = chainFamilies.map(family => ({
        family,
        chains: allChains.filter(c => c.family === family)
    }));

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
                                            {groupedChains.map(group => {
                                                const filteredChains = group.chains.filter(c => c.name.toLowerCase().includes(chainSearch.toLowerCase()));
                                                if (filteredChains.length === 0) return null;

                                                return (
                                                    <div key={group.family}>
                                                        <div className="px-4 py-2 text-xs font-bold text-zinc-500 bg-zinc-900/50 uppercase tracking-wider sticky top-0">
                                                            {group.family}
                                                        </div>
                                                        {filteredChains.map(c => (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                onClick={() => handleChainSelect(c.id)}
                                                                className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-2"
                                                            >
                                                                <img src={c.logoURI} alt={c.name} className="w-5 h-5 rounded-full" />
                                                                <span>{c.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                            {allChains.filter(c => c.name.toLowerCase().includes(chainSearch.toLowerCase())).length === 0 && (
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



                    <div className="border-t border-zinc-800 pt-6">
                        <h3 className="text-sm font-bold text-zinc-300 mb-4">Connected Wallet</h3>
                        <div className="flex flex-col gap-4">
                            {selectedChain?.family === ChainFamily.SOLANA ? (
                                <CustomSolanaConnectButton />
                            ) : (
                                <ConnectButton.Custom>
                                    {({
                                        account,
                                        chain,
                                        openAccountModal,
                                        openChainModal,
                                        openConnectModal,
                                        authenticationStatus,
                                        mounted,
                                    }) => {
                                        const ready = mounted && authenticationStatus !== 'loading';
                                        const connected =
                                            ready &&
                                            account &&
                                            chain &&
                                            (!authenticationStatus ||
                                                authenticationStatus === 'authenticated');

                                        return (
                                            <div
                                                {...(!ready && {
                                                    'aria-hidden': true,
                                                    'style': {
                                                        opacity: 0,
                                                        pointerEvents: 'none',
                                                        userSelect: 'none',
                                                    },
                                                })}
                                                className="w-full"
                                            >
                                                {(() => {
                                                    if (!connected) {
                                                        return (
                                                            <button onClick={openConnectModal} type="button" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20">
                                                                Connect Wallet
                                                            </button>
                                                        );
                                                    }

                                                    if (chain.unsupported) {
                                                        return (
                                                            <button onClick={openChainModal} type="button" className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 px-4 rounded-xl transition-all">
                                                                Wrong network
                                                            </button>
                                                        );
                                                    }

                                                    return (
                                                        <button onClick={openAccountModal} type="button" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-center gap-3 transition-all hover:bg-zinc-900">
                                                            {account.ensAvatar ? (
                                                                <img src={account.ensAvatar} alt="ENS Avatar" className="w-6 h-6 rounded-full" />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold">
                                                                    {account.displayName ? account.displayName[0] : "W"}
                                                                </div>
                                                            )}
                                                            <span className="font-medium text-xs break-all">{account.address}</span>
                                                            <ChevronDown size={16} className="text-zinc-500" />
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    }}
                                </ConnectButton.Custom>
                            )}

                            <button
                                onClick={handleSaveWallet}
                                disabled={saving || !canSave}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                Save Changes
                            </button>
                        </div>
                        {isConnected && !isDifferent && selectedChain?.family === ChainFamily.EVM && (
                            <p className="text-xs text-zinc-500 mt-4 text-center">
                                Connected wallet matches your current main wallet.
                            </p>
                        )}
                        {isConnected && selectedChain?.family !== ChainFamily.EVM && !(selectedChain?.family === ChainFamily.SOLANA && solanaConnected) && (
                            <p className="text-xs text-amber-500 mt-4 text-center">
                                Connection not supported for {selectedChain?.name}. Please connect a compatible wallet to save.
                            </p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

function CustomSolanaConnectButton() {
    const { setVisible } = useWalletModal();
    const { publicKey, connected, wallet } = useWallet();

    if (!connected) {
        return (
            <button
                onClick={() => setVisible(true)}
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20"
            >
                Connect Wallet
            </button>
        );
    }

    return (
        <button
            onClick={() => setVisible(true)}
            type="button"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white flex items-center justify-center gap-3 transition-all hover:bg-zinc-900"
        >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-[10px]">
                {wallet?.adapter.icon ? <img src={wallet.adapter.icon} className="w-full h-full rounded-full" alt="Wallet" /> : "S"}
            </div>
            <span className="font-medium text-xs break-all">{publicKey?.toBase58()}</span>
            <ChevronDown size={16} className="text-zinc-500" />
        </button>
    );
}

export default function WalletsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <WalletsContent />
        </Suspense>
    );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { jwtDecode } from "jwt-decode";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage, useReadContracts } from "wagmi";
import { Twitch, Monitor, Chrome, ArrowLeft, ChevronDown, Check, Coins, AlertTriangle } from "lucide-react";
import { isAddress, erc20Abi } from "viem";
import Link from "next/link";
import { evmChains } from "@/config/generated-chains";
import { allChains, chainFamilies, ChainFamily, CustomChainConfig, isValidAddress } from "@/config/chains";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";

export default function AuthPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthContent />
        </Suspense>
    );
}

function AuthContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        username: "",
        signup_token: "",
    });
    const [usernameError, setUsernameError] = useState("");

    useEffect(() => {
        const error = searchParams.get("error");
        if (error) {
            console.error("Auth error:", error);
            alert(`Authentication Failed: ${error}`);
            router.replace("/auth");
            return;
        }

        const token = searchParams.get("token");
        if (token) {
            localStorage.setItem("user_token", token);
            router.push("/me");
            return;
        }

        const signupToken = searchParams.get("signup_token");
        const urlStep = searchParams.get("step");
        const urlUsername = searchParams.get("username");

        if (signupToken) {
            // Restore state from URL
            const nextFormData = {
                username: urlUsername || "",
                signup_token: signupToken
            };
            setFormData(nextFormData);

            if (urlStep === "3" && urlUsername) {
                setStep(3);
            } else {
                setStep(2);
            }
        }
    }, [searchParams, router]);

    const handleSocialLogin = (provider: string) => {
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/${provider}/login`;
    };

    const handleUsernameSubmit = () => {
        if (!formData.username) return;
        setUsernameError("");
        // Update URL to persist state
        const params = new URLSearchParams(searchParams.toString());
        params.set("step", "3");
        params.set("username", formData.username);
        router.push(`/auth?${params.toString()}`);
    };

    const handleBackToUsername = (errorMsg?: string) => {
        if (errorMsg) setUsernameError(errorMsg);
        setStep(2);
        // Update URL
        const params = new URLSearchParams(searchParams.toString());
        params.set("step", "2");
        router.push(`/auth?${params.toString()}`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black/95 text-white p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="w-full max-w-2xl bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-8 border border-zinc-800 shadow-2xl relative z-10 transition-all duration-300 hover:shadow-purple-500/10 hover:border-zinc-700">

                <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-white mb-6 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Back
                </Link>

                {step > 1 && (
                    <div className="flex justify-between mb-8 relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -z-10 -translate-y-1/2 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
                        </div>
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${step >= s ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/50" : "bg-zinc-800 text-zinc-500"}`}>
                                {s}
                            </div>
                        ))}
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                                Welcome
                            </h2>
                            <p className="text-zinc-400 text-sm">Sign in or create an account to continue.</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleSocialLogin("twitch")}
                                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-[#9146FF] hover:bg-[#7a3acc] text-white transition-all font-semibold shadow-lg shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Twitch className="w-5 h-5" /> Continue with Twitch
                            </button>

                            <button
                                onClick={() => handleSocialLogin("kick")}
                                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-[#53FC18] text-black hover:bg-[#42cf12] transition-all font-bold shadow-lg shadow-green-900/20 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Monitor className="w-5 h-5" /> Continue with Kick
                            </button>

                            <button
                                onClick={() => handleSocialLogin("google")}
                                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-white text-black hover:bg-zinc-200 transition-all font-semibold shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Chrome className="w-5 h-5" /> Continue with Google
                            </button>
                        </div>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-zinc-800" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-zinc-900 px-2 text-zinc-500">Or connect wallet</span>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <WalletLoginButton setStep={setStep} setFormData={setFormData} />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold mb-2">Choose Username</h2>
                            <p className="text-zinc-400 text-sm">This will be your unique handle.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Username</label>
                            <input
                                type="text"
                                placeholder="e.g. SatoshiNakamoto"
                                value={formData.username}
                                onChange={(e) => {
                                    setFormData({ ...formData, username: e.target.value });
                                    setUsernameError("");
                                }}
                                className={`w-full bg-zinc-950 border rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600 ${usernameError ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-blue-500"}`}
                            />
                            {usernameError && (
                                <p className="text-red-400 text-xs mt-1">{usernameError}</p>
                            )}
                        </div>

                        <button
                            onClick={handleUsernameSubmit}
                            disabled={!formData.username}
                            className="w-full p-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <WalletConnectStep formData={formData} onBack={() => handleBackToUsername()} onError={(msg) => handleBackToUsername(msg)} />
                )}
            </div>
        </div>
    );
}

function WalletLoginButton({ setStep, setFormData }: { setStep: (step: number) => void, setFormData: React.Dispatch<React.SetStateAction<any>> }) {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!isConnected || !address) return;
        setLoading(true);
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = await signMessageAsync({ message: `{"address":"${address}","timestamp":${timestamp}}` });

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/wallet-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address,
                    timestamp,
                    signature
                })
            });

            const data = await res.json();
            if (res.ok) {
                if (data.status === "success") {
                    // Login Success
                    localStorage.setItem("user_token", data.token);
                    router.push("/me");
                } else if (data.status === "signup_needed") {
                    // Signup Needed
                    setFormData((prev: any) => ({ ...prev, signup_token: data.signup_token }));
                    setStep(2);
                }
            } else {
                console.error("Wallet login failed:", data.error);
                alert(data.error || "Login failed");
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="w-full flex justify-center">
                <ConnectButton showBalance={false} chainStatus="none" />
            </div>
        )
    }

    return (
        <div className="w-full space-y-3">
            <div className="flex justify-center">
                <ConnectButton showBalance={false} chainStatus="none" />
            </div>
            <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 font-bold shadow-lg transition-all"
            >
                {loading ? "Verifying..." : "Sign In with Wallet"}
            </button>
        </div>
    );
}


interface FormData {
    username: string;
    signup_token: string;
}

function WalletConnectStep({ formData, onBack, onError }: { formData: FormData, onBack: () => void, onError: (msg: string) => void }) {
    const { address, isConnected } = useAccount();
    const { publicKey, connected: solanaConnected } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showSessionExpired, setShowSessionExpired] = useState(false);

    // Preferences
    const [selectedChainId, setSelectedChainId] = useState<number>(evmChains[0]?.id || 1);
    const [selectedAsset, setSelectedAsset] = useState<{ symbol: string; address: string; logo?: string; name?: string } | null>(null);
    const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
    const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
    const [chainSearch, setChainSearch] = useState("");
    const [assetSearch, setAssetSearch] = useState("");
    const [tokens, setTokens] = useState<any[]>([]);

    // Custom Token Import Logic
    const [customToken, setCustomToken] = useState<any>(null);

    // Select chain object
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
                            decimals: 9, // DexScreener doesn't always return decimals
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
            // Reset asset to native
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
                        // If current selection is invalid for new chain, it was already reset in handleChainSelect to native.
                        // But if we just loaded, ensure selectedAsset is set
                        setSelectedAsset(prev => prev && prev.symbol === native.symbol ? prev : native);
                    })
                    .catch(err => {
                        console.error("Failed to fetch tokens", err);
                        setTokens([native]);
                        setSelectedAsset(native);
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
                        const solTokens = data.slice(0, 100).map((t: any) => ({
                            symbol: t.symbol,
                            name: t.name,
                            address: t.address,
                            logo: t.logoURI,
                            decimals: t.decimals
                        }));
                        let newTokens = [native, ...solTokens];
                        setTokens(newTokens);
                        setSelectedAsset(prev => prev && prev.symbol === native.symbol ? prev : native);
                    })
                    .catch(err => {
                        console.error("Failed to fetch Solana tokens", err);
                        setTokens([native]);
                        setSelectedAsset(native);
                    });
            } else {
                // Non-EVM, just native for now unless we have a manual list
                setTokens([native]);
                setSelectedAsset(native);
            }
        }
    }, [selectedChainId]);

    const handleFinish = async () => {
        setLoading(true);
        try {
            // Determine active address based on chain family
            let finalAddress = "";
            let isMainWallet = false;

            if (selectedChain?.family === ChainFamily.SOLANA) {
                if (solanaConnected && publicKey) {
                    finalAddress = publicKey.toBase58();
                    isMainWallet = true;
                }
            } else {
                if (isConnected && address) {
                    finalAddress = address;
                    isMainWallet = true;
                }
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: formData.username,
                    signup_token: formData.signup_token,
                    eth_address: finalAddress,
                    main_wallet: isMainWallet,
                    // New Preferences
                    preferred_chain_id: selectedChainId,
                    preferred_asset_address: selectedAsset?.address || "0x0000000000000000000000000000000000000000"
                })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("user_token", data.token);
                router.push("/me");
            } else {
                if (res.status === 401) {
                    setShowSessionExpired(true);
                    return;
                }
                if (res.status === 409 || data.error?.includes("already taken") || data.error?.includes("Username")) {
                    onError("Username already taken or invalid");
                } else {
                    alert("Signup failed: " + data.error);
                }
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    // Grouping chains for dropdown
    const groupedChains = chainFamilies.map(family => ({
        family,
        chains: allChains.filter(c => c.family === family)
    }));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <SessionExpiredModal
                isOpen={showSessionExpired}
                onClose={() => {
                    setShowSessionExpired(false);
                    router.push("/auth");
                }}
            />
            <div>
                <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
                <p className="text-zinc-400 text-sm">Link your Ethereum wallet to receive tips directly.</p>
            </div>

            {/* Network & Asset Selection (Always Visible) */}
            <div className="space-y-3 text-left">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Preferred Network for Tips</label>

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

            <div className="flex justify-center py-2">
                {selectedChain?.family === ChainFamily.SOLANA ? (
                    <div className="w-full flex justify-center">
                        <CustomSolanaConnectButton />
                    </div>
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
                                                <span className="font-medium text-lg text-xs break-all">{account.address}</span>
                                                <ChevronDown size={16} className="text-zinc-500" />
                                            </button>
                                        );
                                    })()}
                                </div>
                            );
                        }}
                    </ConnectButton.Custom>
                )}
            </div>


            <div className="space-y-3">
                <button
                    onClick={handleFinish}
                    disabled={loading}
                    className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Creating Account...
                        </span>
                    ) : "Finish Setup"}
                </button>

                {!isConnected && !solanaConnected && (
                    <button
                        onClick={() => handleFinish()}
                        className="text-zinc-500 hover:text-zinc-300 text-sm"
                    >
                        Skip for now
                    </button>
                )}

                <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm block mx-auto mt-4">
                    Back to Username
                </button>
            </div>
        </div>
    );
}

function SessionExpiredModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 mb-4 mx-auto">
                    <AlertTriangle size={24} />
                </div>
                <h3 className="text-xl font-bold text-center mb-2">Session Expired</h3>
                <p className="text-zinc-400 text-center text-sm mb-6">
                    Your session credential has expired or is invalid. Please sign in again to continue.
                </p>
                <div className="flex justify-center">
                    <button
                        onClick={onClose}
                        className="w-full p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-900/20 transition-all"
                    >
                        Back to Login
                    </button>
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
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-bold">
                {wallet?.adapter.icon ? <img src={wallet.adapter.icon} className="w-6 h-6 rounded-full" alt="Wallet" /> : "S"}
            </div>
            <span className="font-medium text-lg text-xs break-all">{publicKey?.toBase58()}</span>
            <ChevronDown size={16} className="text-zinc-500" />
        </button>
    );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { jwtDecode } from "jwt-decode";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage, useReadContracts } from "wagmi";
import { Twitch, Monitor, Chrome, ArrowLeft, ChevronDown, Check, Coins } from "lucide-react";
import { isAddress, erc20Abi } from "viem";
import Link from "next/link";
import { evmChains, ChainConfig } from "@/config/generated-chains";

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
    const router = useRouter();
    const [loading, setLoading] = useState(false);

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
            setTokens([native]);
            setSelectedAsset(native);

            // Optional: Fetch more tokens from LiFi
            fetch(`https://li.quest/v1/tokens?chains=${selectedChainId}`)
                .then(res => res.json())
                .then(data => {
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
                        setTokens(prev => [...prev, ...extraTokens]);
                    }
                })
                .catch(err => console.error("Failed to fetch tokens", err));
        }
    }, [selectedChainId]);

    const handleFinish = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: formData.username,
                    signup_token: formData.signup_token,
                    eth_address: address || "",
                    main_wallet: !!address,
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

    const selectedChain = evmChains.find(c => c.id === selectedChainId);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
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
                <ConnectButton showBalance={false} chainStatus="none" />
            </div>

            {isConnected && (
                <div className="space-y-4 text-left">
                    <div className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl break-all text-xs font-mono text-zinc-400 text-center">
                        <span className="text-zinc-500">Connected:</span> {address}
                    </div>
                </div>
            )}

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

                {!isConnected && (
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

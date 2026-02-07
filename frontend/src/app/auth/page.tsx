"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { jwtDecode } from "jwt-decode";
import { useAccount, useSignMessage, useReadContracts, useDisconnect } from "wagmi";
import { Twitch, Monitor, Chrome, ArrowLeft, ChevronDown, Check, Coins, AlertTriangle, Wallet, LogOut } from "lucide-react";
import { isAddress, erc20Abi } from "viem";
import Link from "next/link";
import { evmChains } from "@/config/generated-chains";
import { allChains, chainFamilies, ChainFamily, CustomChainConfig, isValidAddress } from "@/config/chains";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletNetworkSelector } from "@/components/WalletNetworkSelector";
import type { Token } from "@/hooks/useTokenList";
import { WalletSelectionModal } from "@/components/WalletSelectionModal";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { WalletConnectionModals } from "@/components/WalletConnectionModals";


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
    const [isEVMModalOpen, setIsEVMModalOpen] = useState(false);
    const [isSolanaModalOpen, setIsSolanaModalOpen] = useState(false);
    const [isBitcoinModalOpen, setIsBitcoinModalOpen] = useState(false);
    const [isSuiModalOpen, setIsSuiModalOpen] = useState(false);

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

        // Check for existing session (and prevent redirect if we are in signup flow)
        // Check for existing session
        const storedToken = localStorage.getItem("user_token");
        const signupToken = searchParams.get("signup_token");

        if (storedToken && !signupToken && !error && !token) {
            // Verify token validity (optional: could just trust existence for speed and let /me handle 401)
            // For better UX, let's just redirect. If invalid, /me will redirect back.
            router.replace("/me");
            return;
        }

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

                            {/* <button
                                onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/tiktok/login`}
                                className="w-full flex items-center justify-center space-x-3 bg-black/50 hover:bg-black/70 border border-white/10 hover:border-white/20 text-white p-4 rounded-xl transition-all duration-300 group backdrop-blur-sm"
                            >
                                <div className="p-2 bg-black rounded-full group-hover:scale-110 transition-transform">
                                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                                    </svg>
                                </div>
                                <span className="font-medium">Continue with TikTok</span>
                            </button> */}

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
                            <WalletLoginButton
                                setStep={setStep}
                                setFormData={setFormData}
                                onOpenEVM={() => setIsEVMModalOpen(true)}
                                onOpenSolana={() => setIsSolanaModalOpen(true)}
                                onOpenBitcoin={() => setIsBitcoinModalOpen(true)}
                                onOpenSui={() => setIsSuiModalOpen(true)}
                            />
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
                    <WalletConnectStep
                        formData={formData}
                        onBack={() => handleBackToUsername()}
                        onError={(msg) => handleBackToUsername(msg)}
                        onOpenEVM={() => setIsEVMModalOpen(true)}
                        onOpenSolana={() => setIsSolanaModalOpen(true)}
                        onOpenBitcoin={() => setIsBitcoinModalOpen(true)}
                        onOpenSui={() => setIsSuiModalOpen(true)}
                    />
                )}
            </div>
        </div>
    );
}



function WalletLoginButton({
    setStep,
    setFormData,
    onOpenEVM,
    onOpenSolana,
    onOpenBitcoin,
    onOpenSui
}: {
    setStep: (step: number) => void,
    setFormData: React.Dispatch<React.SetStateAction<any>>,
    onOpenEVM: () => void,
    onOpenSolana: () => void,
    onOpenBitcoin: () => void,
    onOpenSui: () => void
}) {
    // EVM
    const { address: evmAddress, isConnected: isEVMConnected } = useAccount();
    const { signMessageAsync: signEVM } = useSignMessage();

    // Solana
    const { publicKey: solanaPublicKey, connected: isSolanaConnected, signMessage: signSolana } = useWallet();

    // Bitcoin
    const { address: btcAddress, isConnected: isBtcConnected, signMessage: signBitcoin } = useBitcoinWallet();

    // Sui
    const suiAccount = useCurrentAccount();
    const { mutateAsync: signSui } = useSignPersonalMessage();
    const isSuiConnected = !!suiAccount;

    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const performLogin = async (
        address: string,
        chainFamily: ChainFamily,
        signFn: () => Promise<string>
    ) => {
        setLoading(true);
        setError("");
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            let signature = "";
            let message = "";

            if (chainFamily === ChainFamily.EVM || chainFamily === ChainFamily.BITCOIN) {
                // EVM & BTC usually expect standard string/json structure
                message = `{"address":"${address}","timestamp":${timestamp}}`;
                signature = await signFn();
            } else if (chainFamily === ChainFamily.SOLANA) {
                // Solana signMessage returns Uint8Array, we need hex/base58
                // Handled in specific wrapper below or passed signFn returns string
                signature = await signFn();
            } else if (chainFamily === ChainFamily.SUI) {
                signature = await signFn();
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/wallet-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address,
                    timestamp,
                    signature,
                    chain_family: chainFamily // Backend needs to know family to verify signature
                })
            });

            const data = await res.json();
            if (res.ok) {
                if (data.status === "success") {
                    localStorage.setItem("user_token", data.token);
                    router.push("/me");
                } else if (data.status === "signup_needed") {
                    setFormData((prev: any) => ({ ...prev, signup_token: data.signup_token }));
                    setStep(2);
                }
            } else {
                console.error("Wallet login failed:", data.error);
                setError(data.error || "Login failed");
            }

        } catch (e: any) {
            console.error(e);
            // Handle specific user rejection errors for better UX
            if (e.message?.includes("User rejected") || e.message?.includes("User denied")) {
                setError("Request rejected by user.");
            } else {
                setError(e.message || "An unexpected error occurred.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLoginEVM = async () => {
        if (!isEVMConnected || !evmAddress) return onOpenEVM();
        await performLogin(evmAddress, ChainFamily.EVM, async () => {
            // Reconstruct message inside here if needed or pass logic
            const timestamp = Math.floor(Date.now() / 1000);
            return await signEVM({ message: `{"address":"${evmAddress}","timestamp":${timestamp}}` });
        });
    };

    const handleLoginSolana = async () => {
        if (!isSolanaConnected || !solanaPublicKey || !signSolana) return onOpenSolana();
        await performLogin(solanaPublicKey.toBase58(), ChainFamily.SOLANA, async () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const messageStr = `{"address":"${solanaPublicKey.toBase58()}","timestamp":${timestamp}}`;
            const message = new TextEncoder().encode(messageStr);
            const signatureBytes = await signSolana(message);
            // Hex encoded for consistency with other chains if backend supports it, or Base58
            // Let's use Hex as per previous SolanaLoginButton
            return Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        });
    };

    const handleLoginBitcoin = async () => {
        if (!isBtcConnected || !btcAddress || !signBitcoin) return onOpenBitcoin();
        await performLogin(btcAddress, ChainFamily.BITCOIN, async () => {
            const timestamp = Math.floor(Date.now() / 1000);
            return await signBitcoin(`{"address":"${btcAddress}","timestamp":${timestamp}}`);
        });
    };

    const handleLoginSui = async () => {
        if (!isSuiConnected || !suiAccount) return onOpenSui();
        await performLogin(suiAccount.address, ChainFamily.SUI, async () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const messageStr = `{"address":"${suiAccount.address}","timestamp":${timestamp}}`;
            const msgBytes = new TextEncoder().encode(messageStr);
            const result = await signSui({ message: msgBytes });
            return result.signature;
        });
    };

    const [isSelectionOpen, setIsSelectionOpen] = useState(false);

    // ... handlers (handleLoginEVM etc) ...

    return (
        <>
            <WalletSelectionModal
                isOpen={isSelectionOpen}
                onClose={() => setIsSelectionOpen(false)}
                onSelectEVM={handleLoginEVM}
                onSelectSolana={handleLoginSolana}
                onSelectBitcoin={handleLoginBitcoin}
                onSelectSui={handleLoginSui}
            />

            <button
                onClick={() => setIsSelectionOpen(true)}
                disabled={loading}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 font-bold shadow-lg transition-all text-white flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
            >
                {loading ? "Verifying..." : (
                    <>
                        <Wallet size={20} /> Sign In with Wallet
                    </>
                )}
            </button>

            {error && (
                <div className="text-red-400 text-xs text-center px-4 animate-in fade-in slide-in-from-top-2">
                    {error}
                </div>
            )}
        </>
    );
}

interface FormData {
    username: string;
    signup_token: string;
}


interface WalletConnectStepProps {
    formData: FormData;
    onBack: () => void;
    onError: (msg: string) => void;
    onOpenEVM: () => void;
    onOpenSolana: () => void;
    onOpenBitcoin: () => void;
    onOpenSui: () => void;
}

function WalletConnectStep({ formData, onBack, onError, onOpenEVM, onOpenSolana, onOpenBitcoin, onOpenSui }: WalletConnectStepProps) {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { publicKey, connected: solanaConnected } = useWallet();
    const { address: btcAddress, isConnected: btcConnected } = useBitcoinWallet();
    const currentSuiAccount = useCurrentAccount();
    const suiConnected = !!currentSuiAccount;

    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showSessionExpired, setShowSessionExpired] = useState(false);

    // Preferences
    const [selectedChainId, setSelectedChainId] = useState<number>(evmChains[0]?.id || 1);
    const [selectedAsset, setSelectedAsset] = useState<Token | null>(null);

    // Select chain object
    const selectedChain = allChains.find(c => c.id === selectedChainId);

    const handleChainSelect = (chainId: number) => {
        setSelectedChainId(chainId);
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            // Determine active address based on chain family
            let finalAddress = "";

            if (selectedChain?.family === ChainFamily.SOLANA) {
                if (solanaConnected && publicKey) {
                    finalAddress = publicKey.toBase58();
                }
            } else if (selectedChain?.family === ChainFamily.EVM) {
                if (isConnected && address) {
                    finalAddress = address;
                }
            } else if (selectedChain?.family === ChainFamily.BITCOIN) {
                if (btcConnected && btcAddress) {
                    finalAddress = btcAddress;
                }
            } else if (selectedChain?.family === ChainFamily.SUI) {
                if (suiConnected && currentSuiAccount) {
                    finalAddress = currentSuiAccount.address;
                }
            }

            if (!finalAddress) {
                throw new Error("Please connect your wallet first.");
            }

            if (formData.signup_token) {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        signup_token: formData.signup_token,
                        username: formData.username,
                        wallet_address: finalAddress,
                        main_wallet: true,
                        preferred_chain_id: selectedChainId,
                        preferred_asset_address: selectedAsset?.address || ""
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Registration failed");
                }

                if (data.token) {
                    localStorage.setItem("user_token", data.token);
                    router.push("/me");
                } else {
                    throw new Error("No session token received");
                }
            } else {
                // If we are here without a signup token, something is wrong with the flow
                // But for now, if they are just connecting a wallet to start a flow?
                // No, Auth page is for finding an account.
                // If they are here, they simply must have a token.
                throw new Error("Session expired or invalid. Please start over.");
            }

        } catch (e: any) {
            console.error(e);
            onError(e.message || "Failed to setup wallet");
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">Connect Wallet</h2>
                <p className="text-zinc-400 text-sm">Link your wallet to receive tips directly to your address</p>
            </div>

            {/* Network Selector */}
            <WalletNetworkSelector
                selectedChainId={selectedChainId}
                onChainSelect={handleChainSelect}
                selectedAsset={selectedAsset}
                onAssetSelect={setSelectedAsset}
            />

            {/* Wallet Button */}
            <div className="flex justify-center py-2">
                <WalletConnectButton
                    chainFamily={selectedChain?.family || ChainFamily.EVM}
                    onOpenSolana={onOpenSolana}
                    onOpenBitcoin={onOpenBitcoin}
                    onOpenSui={onOpenSui}
                    onOpenEVM={onOpenEVM}
                    showFullAddress={true}
                    showIcon={false}
                />
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

                {!isConnected && !solanaConnected && !btcConnected && !suiConnected && (
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





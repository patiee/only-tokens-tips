"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import { useAccount, useSignMessage, useDisconnect, useEnsName, useEnsAvatar as useEnsAvatarHook, useEnsText } from "wagmi";
import { Twitch, Chrome, ArrowLeft, Wallet, AlertTriangle, Check, X, ExternalLink, User, FileText, Upload, Settings, ChevronDown } from "lucide-react";
import Link from "next/link";
import { evmChains } from "@/config/generated-chains";
import { allChains, chainFamilies, ChainFamily } from "@/config/chains";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";
import { useCurrentAccount, useSignPersonalMessage, useDisconnectWallet } from "@mysten/dapp-kit";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletNetworkSelector } from "@/components/WalletNetworkSelector";
import type { Token } from "@/hooks/useTokenList";
import { WalletSelectionModal } from "@/components/WalletSelectionModal";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { WalletConnectionModals } from "@/components/WalletConnectionModals";
// import { normalize } from 'viem/ens' // Removed as it causes error

export default function AuthPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthContent />
        </Suspense>
    );
}

function FieldSettings({ label, hasDNS, useDNS, onToggle }: { label: string, hasDNS: boolean, useDNS: boolean, onToggle: (useDNS: boolean) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!hasDNS) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-300"
            >
                <Settings size={14} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 space-y-1">
                        <button
                            type="button"
                            onClick={() => { onToggle(true); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${useDNS ? "bg-purple-500/10 text-purple-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
                        >
                            <span>Use ENS {label}</span>
                            {useDNS && <Check size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => { onToggle(false); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!useDNS ? "bg-purple-500/10 text-purple-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
                        >
                            <span>Edit Manually</span>
                            {!useDNS && <Check size={14} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function AuthContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        username: "",
        signup_token: "",
        wallet_address: "",
        avatar_url: "",
        description: "",
        background_url: "",
        twitter_handle: "",
    });
    const [usernameError, setUsernameError] = useState("");
    const [isEVMModalOpen, setIsEVMModalOpen] = useState(false);
    const [isSolanaModalOpen, setIsSolanaModalOpen] = useState(false);
    const [isBitcoinModalOpen, setIsBitcoinModalOpen] = useState(false);
    const [isSuiModalOpen, setIsSuiModalOpen] = useState(false);

    // ENS Hooks
    const { address: evmAddress, isConnected: isEVMConnected } = useAccount();
    const { data: ensName } = useEnsName({ address: evmAddress });
    const { data: ensAvatar } = useEnsAvatarHook({ name: ensName! });
    const { data: ensDescription } = useEnsText({ name: ensName!, key: 'description' });
    const { data: ensHeader } = useEnsText({ name: ensName!, key: 'header' }); // 'header' is common for background, or 'url'

    // ENS Toggles State
    const [useEnsUsername, setUseEnsUsername] = useState(false);
    const [useEnsAvatar, setUseEnsAvatar] = useState(false);
    const [useEnsBackground, setUseEnsBackground] = useState(false);
    const [useEnsDescription, setUseEnsDescription] = useState(false);

    useEffect(() => {
        if (isEVMConnected && evmAddress) {
            // Auto-fill and default to true if data exists
            if (ensName) {
                const hasAvatar = !!ensAvatar;
                const hasBackground = !!ensHeader;
                const hasDescription = !!ensDescription;

                setUseEnsUsername(true);
                setUseEnsAvatar(hasAvatar);
                setUseEnsBackground(hasBackground);
                setUseEnsDescription(hasDescription);

                setFormData(prev => ({
                    ...prev,
                    username: ensName,
                    avatar_url: hasAvatar ? ensAvatar : prev.avatar_url,
                    wallet_address: evmAddress,
                    description: hasDescription ? ensDescription! : prev.description,
                    background_url: hasBackground ? ensHeader! : prev.background_url,
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    wallet_address: evmAddress
                }));
            }
        }
    }, [isEVMConnected, evmAddress, ensName, ensAvatar, ensDescription, ensHeader]);

    // Effect to enforce ENS values when toggles are on
    useEffect(() => {
        if (useEnsUsername && ensName) setFormData(prev => ({ ...prev, username: ensName }));
        if (useEnsAvatar && ensAvatar) setFormData(prev => ({ ...prev, avatar_url: ensAvatar }));
        if (useEnsBackground && ensHeader) setFormData(prev => ({ ...prev, background_url: ensHeader }));
        if (useEnsDescription && ensDescription) setFormData(prev => ({ ...prev, description: ensDescription }));
    }, [useEnsUsername, useEnsAvatar, useEnsBackground, useEnsDescription, ensName, ensAvatar, ensHeader, ensDescription]);


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

        const storedToken = localStorage.getItem("user_token");
        const signupToken = searchParams.get("signup_token");
        const urlStep = searchParams.get("step");

        if (storedToken && !signupToken && !error && !token) {
            router.replace("/me");
            return;
        }

        if (signupToken) {
            setFormData(prev => ({ ...prev, signup_token: signupToken }));
            if (urlStep === "2") {
                setStep(2);
            } else {
                setStep(2); // Default to step 2 if token present
            }
        }
    }, [searchParams, router]);

    const handleSocialLogin = (provider: string) => {
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/${provider}/login`;
    };

    const validateUsername = (username: string) => {
        if (!username) return "Username is required";
        if (username.length < 3) return "Username must be at least 3 characters";
        if (username.length > 20 && !username.includes(".")) return "Username must be at most 20 characters"; // Allow longer for ENS

        // Regex for allowed chars: a-z, A-Z, 0-9, special chars
        // But if it contains '.', it must match ENS rules check (backend does this, but frontend warning)
        if (username.includes(".")) {
            if (isEVMConnected && ensName && username.toLowerCase() === ensName.toLowerCase()) {
                return ""; // Valid ENS match
            }
            // Be lenient here, backend enforces ownership
            // But user asked: "if there is "." in the username, strict check... disallow "." unless verified"
            // Since we can't fully verify 3rd party ENS on frontend easily without ownership check (which backend does),
            // We warn if it doesn't match connected ENS.
            if (isEVMConnected && (!ensName || username.toLowerCase() !== ensName.toLowerCase())) {
                return "You can only use a .eth name that you own and is connected.";
            }
            if (!isEVMConnected) {
                return "Connect your wallet to use an ENS name.";
            }
        }

        // Backend regex: ^[a-zA-Z0-9!@#$%^&*()]+$
        if (!/^[a-zA-Z0-9!@#$%^&*()]+$/.test(username)) {
            return "Only letters, numbers, and !@#$%^&*() are allowed";
        }

        return "";
    };

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (useEnsUsername) return; // Prevent change if locked
        const val = e.target.value;
        setFormData({ ...formData, username: val });
        setUsernameError(validateUsername(val));
    };

    // Username Availability Check
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    useEffect(() => {
        const username = formData.username;
        if (!username || username.length < 3 || usernameError) return;
        if (useEnsUsername) {
            setUsernameError(""); // Assume ENS is valid if connected/verified
            return;
        }

        const checkAvailability = async () => {
            // If it looks like ENS and user is connected, we might skip or handle differently,
            // but backend ownership check is ultimate truth. 
            // Here we check if "username" (account) already exists in DB.

            setIsCheckingUsername(true);
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/user/${username}`);
                if (res.ok) {
                    // 200 means user exists
                    setUsernameError("Username is already taken");
                } else if (res.status === 404) {
                    // 404 means user does not exist (Available)
                    // Keep error empty if validateUsername passed
                    if (validateUsername(username) === "") {
                        setUsernameError("");
                    }
                }
            } catch (e) {
                console.error("Failed to check username", e);
            } finally {
                setIsCheckingUsername(false);
            }
        };

        const timeoutId = setTimeout(checkAvailability, 500); // 500ms debounce
        return () => clearTimeout(timeoutId);
    }, [formData.username, usernameError, useEnsUsername]);

    // Wallet Connection & Network State
    const [selectedChainId, setSelectedChainId] = useState<number>(evmChains[0]?.id || 1);
    const [selectedAsset, setSelectedAsset] = useState<Token | null>(null);

    // Image Upload Logic
    const handleFileUpload = async (file: File, type: 'avatar' | 'background') => {
        if (type === 'avatar' && useEnsAvatar) return;
        if (type === 'background' && useEnsBackground) return;

        // We need a token to upload? The backend HandleUpload checks for "Bearer token".
        // But the user is not signed up yet.
        // CHECK: specific requirements. Backend `HandleUpload` in `server.go` checks `ValidateSessionToken`.
        // If users are signing up, they don't have a session token yet.
        // However, `handleStartSignup` usually gives a `signup_token`.
        // Does `HandleUpload` accept `signup_token`?
        // Looking at `server.go` `HandleUpload`, it calls `ValidateSessionToken`.
        // `ValidateSessionToken` checks JWT. `signup_token` is also a JWT but with `signup: true`.
        // If `ValidateSessionToken` only checks signature, it might pass. 
        // But if it checks DB for user, it might fail if user doesn't exist yet.
        // Let's assume for now we might need to modify backend or use a different endpoint if it fails.
        // BUT: User has `signup_token` (from social login) OR they are just connecting wallet?
        // If they stick to Wallet only, they don't have a token until they sign (login).
        // Wait, if they are connecting wallet for the first time to SIGN UP, they sign a message in `WalletLoginButton`.
        // The response gives `signup_token` if they need to register.
        // So they SHOULD have `formData.signup_token` at Step 2.
        // Let's try using that as the Bearer token.

        const token = formData.signup_token;
        if (!token) {
            alert("Please connect a wallet or login with social first to upload images.");
            return;
        }

        const uploadData = new FormData();
        uploadData.append("file", file);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: uploadData
            });

            if (!res.ok) {
                const err = await res.json();
                console.error("Upload failed", err);
                alert("Upload failed: " + (err.error || "Unknown error"));
                return;
            }

            const data = await res.json();
            if (type === 'avatar') {
                setFormData(prev => ({ ...prev, avatar_url: data.url }));
            } else {
                setFormData(prev => ({ ...prev, background_url: data.url }));
            }
        } catch (e: any) {
            console.error(e);
            alert("Upload failed");
        }
    };

    const handleRegister = async () => {
        const error = validateUsername(formData.username);
        if (error) {
            setUsernameError(error);
            return;
        }

        try {
            // If wallet connected, use that address. If not, maybe they linked social only?
            // User requirement: "merge wallet connection...".
            // If they haven't connected wallet, they can still sign up if they have social token?
            // Yes, assuming social login provided signup_token.

            // Prepare Request
            const body = {
                username: formData.username,
                signup_token: formData.signup_token,
                wallet_address: formData.wallet_address || evmAddress || "", // prioritize formData which might be set from other chains
                main_wallet: !!formData.wallet_address,
                preferred_chain_id: selectedChainId, // Default or selected
                preferred_asset_address: selectedAsset?.address || "", // Default
                avatar_url: formData.avatar_url,
                description: formData.description,
                background_url: formData.background_url,
                twitter_handle: formData.twitter_handle,
                use_ens_avatar: useEnsAvatar,
                use_ens_background: useEnsBackground,
                use_ens_description: useEnsDescription,
                use_ens_username: useEnsUsername,
            };

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("user_token", data.token);
                router.push("/me");
            } else {
                setUsernameError(data.error || "Registration failed");
            }
        } catch (e: any) {
            console.error(e);
            setUsernameError("An unexpected error occurred");
        }
    };

    // Wallet Connect logic moved here
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const { disconnect } = useDisconnect();
    const { publicKey, disconnect: disconnectSolana } = useWallet();
    const { address: btcAddress, disconnect: disconnectBtc } = useBitcoinWallet();
    const currentSuiAccount = useCurrentAccount();
    const { mutate: disconnectSui } = useDisconnectWallet();

    const handleDisconnect = () => {
        if (isEVMConnected) disconnect();
        if (publicKey) disconnectSolana();
        if (btcAddress) disconnectBtc();
        if (currentSuiAccount) disconnectSui();
        setFormData(prev => ({ ...prev, wallet_address: "", username: "" })); // Clear
    };

    const displayAddress = isEVMConnected
        ? evmAddress
        : publicKey
            ? publicKey.toBase58()
            : btcAddress
                ? btcAddress
                : currentSuiAccount
                    ? currentSuiAccount.address
                    : "";

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

            <div className="w-full max-w-2xl bg-zinc-900/40 backdrop-blur-xl rounded-3xl p-8 border border-white/5 shadow-2xl relative z-10 transition-all duration-300 hover:border-white/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

                <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-white mb-6 transition-colors relative z-10">
                    <ArrowLeft size={16} className="mr-2" /> Back
                </Link>

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
                            <h2 className="text-3xl font-bold mb-2">Complete Profile</h2>
                            <p className="text-zinc-400 text-sm">Choose your username and wallet to receive tips</p>
                        </div>

                        {/* Combined Settings-like Form */}
                        <div className="grid gap-6">
                            {/* Images Row */}
                            <div className="relative group mx-auto w-full">
                                {/* Background Image */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Cover Image</label>
                                        <FieldSettings
                                            label="Cover"
                                            hasDNS={!!ensHeader}
                                            useDNS={useEnsBackground}
                                            onToggle={setUseEnsBackground}
                                        />
                                    </div>
                                    <div
                                        className={`w-full h-48 rounded-2xl bg-black/50 border overflow-hidden relative transition-all ${useEnsBackground ? "border-purple-500/50 cursor-default" : "border-white/5 cursor-pointer hover:border-white/10"}`}
                                        onClick={() => !useEnsBackground && formData.signup_token && document.getElementById('bg-upload')?.click()}
                                    >
                                        {formData.background_url ? (
                                            <img src={formData.background_url} alt="Background" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                                                <FileText size={32} />
                                                <span className="text-xs font-bold uppercase tracking-wider">Upload Cover</span>
                                            </div>
                                        )}

                                        {!useEnsBackground && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-black/50 backdrop-blur-sm p-3 rounded-full border border-white/10">
                                                    <Upload className="text-white" size={24} />
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            id="bg-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={useEnsBackground}
                                            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'background')}
                                        />
                                    </div>
                                </div>

                                {/* Avatar Image (Overlapping) */}
                                <div className="absolute -bottom-10 left-6">
                                    <div className="relative">
                                        <div
                                            className={`w-24 h-24 rounded-full border-4 border-black bg-zinc-900 overflow-hidden relative shadow-xl z-20 ${useEnsAvatar ? "cursor-default" : "cursor-pointer group/avatar"}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!useEnsAvatar && formData.signup_token) document.getElementById('avatar-upload')?.click();
                                            }}
                                        >
                                            {formData.avatar_url ? (
                                                <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                                    <User size={32} />
                                                </div>
                                            )}
                                            {!useEnsAvatar && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                                                    <Upload className="text-white" size={20} />
                                                </div>
                                            )}
                                            <input
                                                id="avatar-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={useEnsAvatar}
                                                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'avatar')}
                                            />
                                        </div>
                                        {/* Settings Button for Avatar - Absolute positioned next to it */}
                                        <div className="absolute -right-8 top-0 bg-black/50 rounded-lg backdrop-blur-md border border-white/10">
                                            <FieldSettings
                                                label="Avatar"
                                                hasDNS={!!ensAvatar}
                                                useDNS={useEnsAvatar}
                                                onToggle={setUseEnsAvatar}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Spacer for overlapping avatar */}
                            <div className="h-6"></div>

                            {/* Username Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Username</label>
                                    <FieldSettings
                                        label="Name"
                                        hasDNS={!!ensName}
                                        useDNS={useEnsUsername}
                                        onToggle={(val) => {
                                            setUseEnsUsername(val);
                                            if (val && ensName) {
                                                setFormData(prev => ({ ...prev, username: ensName }));
                                                setUsernameError("");
                                            }
                                        }}
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="e.g. Satoshi"
                                        value={formData.username}
                                        onChange={handleUsernameChange}
                                        disabled={useEnsUsername}
                                        className={`w-full bg-zinc-950 border rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600 ${useEnsUsername
                                            ? "border-purple-500/50 text-purple-200 cursor-not-allowed bg-purple-900/10"
                                            : usernameError
                                                ? "border-red-500 focus:border-red-500"
                                                : "border-zinc-800 focus:border-blue-500"
                                            }`}
                                    />
                                    {ensName && formData.username === ensName && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
                                            <Check size={20} />
                                        </div>
                                    )}
                                </div>
                                {usernameError ? (
                                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                        <AlertTriangle size={12} /> {usernameError}
                                    </p>
                                ) : (
                                    <p className="text-zinc-500 text-xs mt-1">
                                        {isEVMConnected && !ensName ? (
                                            <span className="flex items-center gap-1">
                                                No ENS found. <a href="https://app.ens.domains" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-0.5">Purchase ENS <ExternalLink size={10} /></a>
                                            </span>
                                        ) : (
                                            "Username or ENS"
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* Description Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Description</label>
                                    <FieldSettings
                                        label="Bio"
                                        hasDNS={!!ensDescription}
                                        useDNS={useEnsDescription}
                                        onToggle={(val) => {
                                            setUseEnsDescription(val);
                                            if (val && ensDescription) setFormData(prev => ({ ...prev, description: ensDescription }));
                                        }}
                                    />
                                </div>
                                <textarea
                                    placeholder="Tell us about yourself..."
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    disabled={useEnsDescription}
                                    rows={3}
                                    className={`w-full bg-zinc-950 border rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600 resize-none ${useEnsDescription
                                        ? "border-purple-500/50 text-purple-200 cursor-not-allowed bg-purple-900/10"
                                        : "border-zinc-800 focus:border-blue-500"
                                        }`}
                                />
                            </div>

                            {/* Network Selection */}
                            <WalletNetworkSelector
                                selectedChainId={selectedChainId}
                                onChainSelect={setSelectedChainId}
                                selectedAsset={selectedAsset}
                                onAssetSelect={setSelectedAsset}
                                label="Receive Tips On"
                            />

                            {/* Connected Wallet Info */}
                            {(isEVMConnected || publicKey || btcAddress || currentSuiAccount) ? (
                                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 flex items-center justify-between">
                                    <div className="text-zinc-400 font-mono text-sm break-all mr-4">
                                        {displayAddress}
                                    </div>
                                    <button
                                        onClick={handleDisconnect}
                                        className="text-xs text-red-400 hover:text-red-300 px-3 py-1 bg-red-500/10 rounded-lg transition-colors whitespace-nowrap"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full mt-2">
                                    <WalletConnectButton
                                        chainFamily={allChains.find(c => c.id === selectedChainId)?.family || ChainFamily.EVM}
                                        onOpenSolana={() => setIsSolanaModalOpen(true)}
                                        onOpenBitcoin={() => setIsBitcoinModalOpen(true)}
                                        onOpenSui={() => setIsSuiModalOpen(true)}
                                        onOpenEVM={() => setIsEVMModalOpen(true)}
                                    />
                                </div>
                            )}
                        </div>

                        {(() => {
                            const selectedChain = allChains.find(c => c.id === selectedChainId);
                            const family = selectedChain?.family || ChainFamily.EVM;
                            const isWalletConnectedForSelectedChain =
                                (family === ChainFamily.EVM && isEVMConnected) ||
                                (family === ChainFamily.SOLANA && !!publicKey) ||
                                (family === ChainFamily.BITCOIN && !!btcAddress) ||
                                (family === ChainFamily.SUI && !!currentSuiAccount);

                            return (
                                <button
                                    onClick={handleRegister}
                                    disabled={!formData.username || !!usernameError || !isWalletConnectedForSelectedChain}
                                    className="w-full py-4 rounded-xl bg-white hover:bg-zinc-200 transition-all duration-200 text-black font-bold text-lg uppercase tracking-wide active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                                >
                                    Create Account
                                </button>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}

// ... (WalletLoginButton remains similar but we might need to adjust props if needed, mostly kept for Step 1)
function WalletLoginButton({ setStep, setFormData, onOpenEVM, onOpenSolana, onOpenBitcoin, onOpenSui }: any) {
    // Keep existing implementation
    // ...
    // But when login succeeds with "signup_needed", it sets step 2.
    // ...
    // NOTE: Copying existing WalletLoginButton implementation below for completeness if I replace the whole file.
    // To save tokens, I will assume the previous implementation is fine, but I need to make sure I include it in the replacement or I replace the whole file. 
    // Since I am replacing the whole file, I MUST include WalletLoginButton.

    // EVM
    const { address: evmAddress, isConnected: isEVMConnected } = useAccount();
    const { signMessageAsync: signEVM } = useSignMessage();
    const router = useRouter();

    // Solana
    const { publicKey: solanaPublicKey, connected: isSolanaConnected, signMessage: signSolana } = useWallet();

    // Bitcoin
    const { address: btcAddress, isConnected: isBtcConnected, signMessage: signBitcoin } = useBitcoinWallet();

    // Sui
    const suiAccount = useCurrentAccount();
    const { mutateAsync: signSui } = useSignPersonalMessage();
    const isSuiConnected = !!suiAccount;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);

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

            if (chainFamily === ChainFamily.EVM || chainFamily === ChainFamily.BITCOIN) {
                signature = await signFn();
            } else if (chainFamily === ChainFamily.SOLANA) {
                signature = await signFn();
            } else if (chainFamily === ChainFamily.SUI) {
                signature = await signFn();
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/auth/wallet/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address,
                    timestamp,
                    signature,
                    chain_family: chainFamily
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

// Interfaces
interface FormData {
    username: string;
    signup_token: string;
}






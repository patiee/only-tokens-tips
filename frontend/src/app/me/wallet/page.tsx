"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Wallet, ArrowLeft, Save, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { allChains, ChainFamily, isValidAddress } from "@/config/chains";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletConnectionModals } from "@/components/WalletConnectionModals";
import { useBitcoinWallet } from "@/contexts/BitcoinWalletContext";
import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import { useDisconnect } from "wagmi";
import { WalletNetworkSelector } from "@/components/WalletNetworkSelector";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { Token } from "@/hooks/useTokenList";

export type UserProfile = {
    username: string;
    wallet_address: string;
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

    // Bitcoin
    const { isConnected: btcConnected, address: btcAddress } = useBitcoinWallet();

    // Sui
    const currentSuiAccount = useCurrentAccount();
    const suiConnected = !!currentSuiAccount;
    const suiAddress = currentSuiAccount?.address;

    // Preferences State
    const [selectedChainId, setSelectedChainId] = useState<number>(1); // Default to Ethereum
    const [selectedAsset, setSelectedAsset] = useState<Token | null>(null);

    // Modal State
    const [isSolanaModalOpen, setIsSolanaModalOpen] = useState(false);
    const [isEVMModalOpen, setIsEVMModalOpen] = useState(false);
    const [isBitcoinModalOpen, setIsBitcoinModalOpen] = useState(false);
    const [isSuiModalOpen, setIsSuiModalOpen] = useState(false);

    const selectedChain = allChains.find(c => c.id === selectedChainId);

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
                // We rely on WalletNetworkSelector to match the preferred_asset_address
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

        let addressToSave = profile?.wallet_address || "";

        // Logic to determine new address to save based on selected chain family
        if (selectedChain?.family === ChainFamily.SOLANA) {
            if (solanaConnected && publicKey) {
                addressToSave = publicKey.toBase58();
            }
        } else if (selectedChain?.family === ChainFamily.BITCOIN) {
            if (btcConnected && btcAddress) {
                addressToSave = btcAddress;
            }
        } else if (selectedChain?.family === ChainFamily.SUI) {
            if (suiConnected && suiAddress) {
                addressToSave = suiAddress;
            }
        } else if (selectedChain?.family === ChainFamily.EVM) {
            if (isConnected && address) {
                addressToSave = address;
            }
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/me/wallet`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    wallet_address: addressToSave,
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
                wallet_address: addressToSave,
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

    // Determine current connected address based on selected family
    let currentAddress: string | undefined | null = null;
    if (selectedChain?.family === ChainFamily.SOLANA) {
        currentAddress = solanaConnected && publicKey ? publicKey.toBase58() : null;
    } else if (selectedChain?.family === ChainFamily.BITCOIN) {
        currentAddress = btcConnected && btcAddress ? btcAddress : null;
    } else if (selectedChain?.family === ChainFamily.SUI) {
        currentAddress = suiConnected && suiAddress ? suiAddress : null;
    } else if (selectedChain?.family === ChainFamily.EVM) {
        currentAddress = isConnected && address ? address : null;
    }

    // Check if wallet matches profile
    const isDifferent = profile && currentAddress && profile.wallet_address.toLowerCase() !== currentAddress.toLowerCase();

    // Check if preferences changed (dirty state)
    const prefsChanged = profile && (profile.preferred_chain_id !== selectedChainId || profile.preferred_asset_address?.toLowerCase() !== selectedAsset?.address.toLowerCase());

    // Logic for Saving:
    const isWalletMismatch =
        (selectedChain?.family === ChainFamily.SOLANA && !solanaConnected) ||
        (selectedChain?.family === ChainFamily.BITCOIN && !btcConnected) ||
        (selectedChain?.family === ChainFamily.SUI && !suiConnected) ||
        (selectedChain?.family === ChainFamily.EVM && !isConnected);

    // Allow saving if:
    // 1. Wallets match (connected and verified)
    // 2. OR: We are NOT connected, but the currently saved address is valid for the target chain (e.g. switching EVM chains), AND we are not trying to change the address itself.
    const savedAddressCompatible = profile?.wallet_address && selectedChain && isValidAddress(profile.wallet_address, selectedChain.family);

    // We can save if:
    // - There is a difference to save (address or prefs)
    // - AND:
    //   - We are connected correctly (!isWalletMismatch)
    //   - OR we are just changing preferences and the saved address is compatible (offline update)
    const canSave = (isDifferent || prefsChanged) && (!isWalletMismatch || (prefsChanged && !isDifferent && savedAddressCompatible));

    return (
        <div className="min-h-screen bg-black text-white p-4 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-8">

                <div className="flex items-center gap-4">
                    <Link href="/me" className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-bold">Manage Wallet</h1>
                </div>

                {message && (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle size={20} />
                        {message}
                    </div>
                )}

                {/* Main Settings Panel */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                            <Wallet className="text-blue-400" /> Wallet Settings
                        </h2>
                        <p className="text-zinc-400 text-sm">
                            Configure wallet, network and asset where you want to receive the tips
                        </p>
                    </div>

                    {/* Reusable Selector Component */}
                    <WalletNetworkSelector
                        selectedChainId={selectedChainId}
                        onChainSelect={setSelectedChainId}
                        selectedAsset={selectedAsset}
                        onAssetSelect={setSelectedAsset}
                        preferredAssetAddress={profile?.preferred_chain_id === selectedChainId ? profile.preferred_asset_address : undefined}
                    />

                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Saved Wallet Address</h3>
                        {profile?.wallet_address ? (
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-6 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs text-zinc-500 mb-1">Current Saved Address</span>
                                    <span className="font-mono text-sm text-white break-all">{profile.wallet_address}</span>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle size={16} className="text-green-500" />
                                </div>
                            </div>
                        ) : (
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-6 text-zinc-500 text-sm">
                                No wallet address saved yet.
                            </div>
                        )}

                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Update Wallet Address</h3>
                        <div className="flex flex-col gap-4">

                            <WalletConnectButton
                                chainFamily={selectedChain?.family || ChainFamily.EVM}
                                onOpenSolana={() => setIsSolanaModalOpen(true)}
                                onOpenBitcoin={() => setIsBitcoinModalOpen(true)}
                                onOpenSui={() => setIsSuiModalOpen(true)}
                                onOpenEVM={() => setIsEVMModalOpen(true)}
                                showFullAddress={true}
                                showIcon={false}
                            />

                            <button
                                onClick={handleSaveWallet}
                                disabled={saving || !canSave}
                                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${saving || !canSave
                                    ? "bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-50"
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                                    }`}
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
                        {isConnected && selectedChain?.family === ChainFamily.SOLANA && !solanaConnected && !canSave && (
                            <p className="text-xs text-amber-500 mt-4 text-center">
                                Please connect a Solana wallet to save.
                            </p>
                        )}
                    </div>
                </div>

                {/* Custom Wallet Modals */}
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

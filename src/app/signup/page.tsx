"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { Twitch, Monitor, Chrome } from "lucide-react"; // Icons mock

export default function SignupPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        provider: "",
        username: "",
        wallet: "",
    });

    // Step 1: OAuth (Mock)
    const handleSocialLogin = (provider: string) => {
        // In real app, this redirects to OAuth provider.
        // Here, we simulate getting a token/ID.
        console.log("Logged in with", provider);
        setFormData({ ...formData, provider });
        setStep(2);
    };

    // Step 2: Username
    const handleUsernameSubmit = () => {
        if (!formData.username) return;
        setStep(3);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
            <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800 shadow-xl">

                {/* Progress */}
                <div className="flex justify-between mb-8 text-sm text-zinc-500">
                    <span className={step >= 1 ? "text-blue-500 font-bold" : ""}>1. Connect</span>
                    <span className={step >= 2 ? "text-blue-500 font-bold" : ""}>2. Username</span>
                    <span className={step >= 3 ? "text-blue-500 font-bold" : ""}>3. Wallet</span>
                </div>

                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-bold text-center mb-6">Sign in with account</h2>

                        <button
                            onClick={() => handleSocialLogin("twitch")}
                            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-[#9146FF] hover:bg-[#7a3acc] transition-all font-semibold"
                        >
                            <Twitch /> Twitch
                        </button>

                        <button
                            onClick={() => handleSocialLogin("kick")}
                            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-[#53FC18] text-black hover:bg-[#42cf12] transition-all font-bold"
                        >
                            <Monitor /> Kick
                        </button>

                        <button
                            onClick={() => handleSocialLogin("google")}
                            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-white text-black hover:bg-gray-200 transition-all font-semibold"
                        >
                            <Chrome /> Google
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-bold text-center mb-2">Create Username</h2>
                        <p className="text-zinc-400 text-center mb-6">Choose your unique handle.</p>

                        <input
                            type="text"
                            placeholder="Username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
                        />

                        <button
                            onClick={handleUsernameSubmit}
                            disabled={!formData.username}
                            className="w-full p-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
                        >
                            Next
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <WalletStep formData={formData} />
                )}

            </div>
        </div>
    );
}

function WalletStep({ formData }: { formData: any }) {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleFinish = async () => {
        if (!isConnected || !address) return;
        setLoading(true);

        try {
            // Sign message to prove ownership
            // const sig = await signMessageAsync({ message: `Verify ownership for ${formData.username}` });

            // Call Backend to Create User
            const res = await fetch("http://localhost:8080/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: formData.username,
                    provider: formData.provider,
                    eth_address: address,
                    main_wallet: true,
                })
            });

            if (res.ok) {
                // Save token mock
                localStorage.setItem("user_token", "mock_token_" + formData.username);
                router.push("/me");
            } else {
                console.error("Signup failed");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <h2 className="text-2xl font-bold">Connect Wallet</h2>
            <p className="text-zinc-400">Link your Ethereum wallet to receive tips.</p>

            <div className="flex justify-center py-4">
                <ConnectButton />
            </div>

            {isConnected && (
                <div className="p-4 bg-zinc-900/50 border border-zinc-700 rounded-xl break-all text-sm font-mono text-zinc-300">
                    Connected: {address}
                </div>
            )}

            <button
                onClick={handleFinish}
                disabled={!isConnected || loading}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
            >
                {loading ? "Creating Profile..." : "Finish & Go to Dashboard"}
            </button>
        </div>
    );
}

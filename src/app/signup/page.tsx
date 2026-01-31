"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { jwtDecode } from "jwt-decode";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { Twitch, Monitor, Chrome } from "lucide-react"; // Icons mock

export default function SignupPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SignupContent />
        </Suspense>
    );
}

function SignupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        provider: "",
        username: "",
        wallet: "",
        signup_token: "", // Store JWT here
    });

    useEffect(() => {
        const error = searchParams.get("error");
        if (error) {
            console.error("Signup error:", error);
            return;
        }

        const token = searchParams.get("token"); // Login success
        if (token) {
            localStorage.setItem("user_token", token);
            router.push("/me");
            return;
        }

        const signupToken = searchParams.get("signup_token"); // Signup continue
        if (signupToken) {
            try {
                // Decode token just to show provider info (or just trust param if we prefer)
                // We'll decode to get the provider name for UI if possible, 
                // but really we just need to store the token.
                const decoded: any = jwtDecode(signupToken);

                setFormData(prev => ({
                    ...prev,
                    provider: decoded.provider || "",
                    signup_token: signupToken,
                }));
                setStep(2);
            } catch (e) {
                console.error("Invalid signup token", e);
            }
        }
    }, [searchParams, router]);

    // Step 1: OAuth (Real)
    const handleSocialLogin = (provider: string) => {
        window.location.href = `https://localhost:8080/auth/${provider}/login`;
    };

    // Step 2: Username
    const handleUsernameSubmit = () => {
        if (!formData.username) return;
        setStep(3);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black/95 text-white p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[0%] left-[0%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-8 border border-zinc-800 shadow-2xl relative z-10 transition-all duration-300 hover:shadow-purple-500/10 hover:border-zinc-700">

                {/* Progress Steps */}
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

                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold mb-2 tracking-tight">Connect Account</h2>
                            <p className="text-zinc-400 text-sm">Select a platform to verify your identity.</p>
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

                        <p className="text-xs text-center text-zinc-500 mt-4">
                            By connecting, you agree to our Terms & Conditions.
                        </p>
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
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-600"
                            />
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
                    <WalletStep formData={formData} />
                )}

            </div>
        </div>
    );
}

function WalletStep({ formData }: { formData: any }) {
    const { address, isConnected } = useAccount();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleFinish = async () => {
        if (!isConnected || !address) return;
        setLoading(true);

        try {
            // Sign message to prove ownership (Commented out in original)
            // const sig = await signMessageAsync({ message: `Verify ownership for ${formData.username}` });

            // Call Backend to Create User
            const res = await fetch("https://localhost:8080/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: formData.username,
                    signup_token: formData.signup_token,
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
                alert("Signup failed, please try again.");
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div>
                <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
                <p className="text-zinc-400 text-sm">Link your Ethereum wallet to receive tips directly.</p>
            </div>

            <div className="flex justify-center py-2">
                <ConnectButton showBalance={false} chainStatus="none" />
            </div>

            {isConnected && (
                <div className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl break-all text-xs font-mono text-zinc-400">
                    <span className="text-zinc-500">Connected:</span> {address}
                </div>
            )}

            <button
                onClick={handleFinish}
                disabled={!isConnected || loading}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Creating Profile...
                    </span>
                ) : "Finish Setup"}
            </button>
        </div>
    );
}

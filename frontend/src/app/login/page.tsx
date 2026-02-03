"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Twitch, Monitor, Chrome, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("user_token");
        if (token) {
            router.push("/me");
        }
    }, [router]);

    const handleSocialLogin = (provider: string) => {
        // Backend handles logic: If user exists -> Login, If new -> Signup
        // We just point to the same auth endpoints
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/${provider}/login`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black/95 text-white p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[100px] rounded-full" />
            </div>

            <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-8 border border-zinc-800 shadow-2xl relative z-10 hover:border-zinc-700 transition-all">

                <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-white mb-6 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Back
                </Link>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                        Welcome Back
                    </h2>
                    <p className="text-zinc-400 text-sm">Sign in to manage your profile and tips.</p>
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

                <div className="mt-8 text-center">
                    <p className="text-sm text-zinc-500">
                        Don't have an account?{" "}
                        <Link href="/signup" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

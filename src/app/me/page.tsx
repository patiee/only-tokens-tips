"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, User as UserIcon } from "lucide-react";

type UserProfile = {
    username: string;
    eth_address: string;
    main_wallet: boolean;
};

export default function DashboardPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const router = useRouter();

    useEffect(() => {
        // In real app, fetch from /api/me using token
        // For MVP, if we just authorized, we might not have a persistently running backend with auth state 
        // unless we built the auth middleware.
        // Let's create a specific fetch to get the user based on username stored in localstorage/token, 
        // or just mock it if the backend endpoint isn't fully ready with JWT parsing.

        // Simulating fetch
        const token = localStorage.getItem("user_token");
        if (!token) {
            router.push("/signup");
            return;
        }

        // We'll try to fetch from backend if implemented, else mock from local storage values for immediate feedback
        // But the requirement says "for logged in account".
        // Let's assume we fetch by some ID if we had it, or just show the "Me" Endpoint result.

        fetch("http://localhost:8080/api/me?token=" + token)
            .then(res => res.json())
            .then(data => setProfile(data))
            .catch(err => console.log("Failed to fetch profile", err));

    }, [router]);

    if (!profile) return <div className="min-h-screen bg-black text-white p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <header className="flex items-center gap-4 border-b border-zinc-800 pb-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                        {profile.username[0]?.toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{profile.username}</h1>
                        <p className="text-zinc-500">Streamer Profile</p>
                    </div>
                </header>

                <div className="grid gap-6">
                    <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-3 mb-4 text-zinc-400">
                            <UserIcon size={20} />
                            <span className="font-semibold">Account Details</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Username</span>
                                <span>{profile.username}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Public Page</span>
                                <a href={`/${profile.username}`} className="text-blue-400 hover:underline">
                                    /{profile.username}
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-3 mb-4 text-zinc-400">
                            <Wallet size={20} />
                            <span className="font-semibold">Connected Wallet</span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                            <div className="font-mono text-sm break-all">
                                {profile.eth_address}
                            </div>
                            {profile.main_wallet && (
                                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-800">
                                    Main
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

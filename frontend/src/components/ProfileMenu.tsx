"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Wallet, LayoutGrid, DollarSign, LogOut, ExternalLink, Menu, X, ChevronRight, ArrowLeft } from "lucide-react";

export function ProfileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [profile, setProfile] = useState<{ username: string; avatar_url?: string } | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    // Check auth
    useEffect(() => {
        const token = localStorage.getItem("user_token");
        if (token) {
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://earth-charleston-firms-horn.trycloudflare.com'}/api/me?token=${token}`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error("Failed");
                })
                .then(data => setProfile(data))
                .catch(() => {
                    localStorage.removeItem("user_token");
                    setProfile(null);
                });
        } else {
            setProfile(null);
        }
    }, [pathname]);

    const handleLogout = () => {
        localStorage.removeItem("user_token");
        setProfile(null);
        setIsOpen(false);
        router.push("/");
    };

    const isDashboard = pathname?.startsWith("/me");

    if (!profile || !isDashboard) return null;

    const navItems = [
        { label: "Public Page", href: `/${profile.username}`, icon: ExternalLink },
        { label: "Account Settings", href: "/me/settings", icon: User },
        { label: "Overlay Widget", href: "/me/widget", icon: DollarSign },
        { label: "Wallet Settings", href: "/me/wallet", icon: Wallet },
        { label: "All Tips", href: "/me/tips", icon: Menu },
    ];

    return (
        <>
            {/* Toggle Button (Fixed Right) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed right-6 top-6 z-50 p-3 rounded-full shadow-lg transition-all duration-300 ${isOpen ? "bg-zinc-800 text-white rotate-90" : "bg-white text-black hover:scale-110"}`}
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Menu */}
            <div className={`fixed top-0 right-0 h-full w-80 bg-zinc-950 border-l border-zinc-800 z-50 transform transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
                <div className="flex flex-col h-full p-6">
                    {/* Header */}
                    {/* Header */}
                    <div className="mb-8 mt-12 pb-6 border-b border-zinc-900">
                        <div
                            onClick={() => {
                                if (pathname !== "/me") {
                                    setIsOpen(false);
                                    router.push("/me");
                                }
                            }}
                            className={`flex items-center gap-4 p-2 -ml-2 rounded-xl transition-all ${pathname !== "/me" ? "cursor-pointer hover:bg-zinc-900 group" : ""}`}
                        >
                            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-zinc-700 group-hover:border-zinc-600 transition-colors">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={20} className="text-zinc-400" />
                                )}
                            </div>
                            <div>
                                <div className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">@{profile.username}</div>
                                {pathname !== "/me" ? (
                                    <div className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                                        <ArrowLeft size={12} /> Back to Dashboard
                                    </div>
                                ) : (
                                    <div className="text-xs text-green-500 font-medium">● Online</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Nav Links */}
                    <div className="flex-1 space-y-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-all group ${isActive
                                        ? "bg-zinc-900 text-white border border-zinc-800"
                                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={20} className={`transition-colors ${isActive ? "text-purple-400" : "group-hover:text-purple-400"}`} />
                                        <span className="font-medium">{item.label}</span>
                                    </div>
                                    {isActive && <ChevronRight size={16} className="text-purple-400" />}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Footer / Logout */}
                    <div className="pt-6 border-t border-zinc-900">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all font-medium"
                        >
                            <LogOut size={20} />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

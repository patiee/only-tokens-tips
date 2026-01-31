"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Wallet } from "lucide-react";

type Tip = {
    sender: string;
    amount: string;
    message: string;
    asset: string;
};

export default function WidgetPage() {
    const params = useParams();
    const username = params.username as string;
    const [alert, setAlert] = useState<Tip | null>(null);

    // Poll for new tips
    useEffect(() => {
        const interval = setInterval(() => {
            // Mock fetching "pending" tips from backend queue
            // In real impl, we'd act on unread tips
            // For now, let's just keep it empty until we wire up specific "widget" poll endpoint
            // or use a websocket.

            // fetch(`/api/widget/${username}/poll`)....
        }, 5000);

        return () => clearInterval(interval);
    }, [username]);

    // Test effect to show animation for dev
    useEffect(() => {
        // Trigger a test alert on load
        // setAlert({ sender: "Anonymous", amount: "0.05", message: "Great stream! Keep it up!", asset: "ETH" });
        // setTimeout(() => setAlert(null), 8000);
    }, []);

    return (
        <div className="min-h-screen bg-transparent flex items-end justify-center p-8 overflow-hidden font-sans">
            <AnimatePresence>
                {alert && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="relative w-full max-w-lg"
                    >
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full animate-pulse" />

                        <div className="relative bg-zinc-900/95 border-2 border-blue-500/50 rounded-3xl p-6 shadow-2xl backdrop-blur-xl overflow-hidden">
                            {/* Accent line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-green-400" />

                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 p-1 shadow-lg shrink-0">
                                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                                        <Wallet className="text-white w-8 h-8" />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-2xl font-bold text-white drop-shadow-md">
                                            {alert.sender}
                                        </span>
                                        <span className="text-lg text-zinc-400">sent</span>
                                        <span className="text-3xl font-extrabold text-green-400 drop-shadow-md">
                                            {alert.amount} {alert.asset}
                                        </span>
                                    </div>

                                    {alert.message && (
                                        <div className="mt-2 text-xl font-medium text-blue-100 italic break-words leading-snug">
                                            "{alert.message}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

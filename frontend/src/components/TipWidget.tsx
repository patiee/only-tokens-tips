"use client";

import { motion } from "framer-motion";
import { Twitter } from "lucide-react"; // Fallback to Twitter icon if X not available or just use generic

export interface TipWidgetConfig {
    tts_enabled: boolean;
    background_color: string;
    user_color: string;
    amount_color: string;
    message_color: string;
}

export interface TipData {
    sender: string;
    amount: string;
    message: string;
    actionText?: string;
    avatarUrl?: string;
    backgroundUrl?: string;
    twitterHandle?: string;
}

interface TipWidgetProps {
    tip: TipData;
    config: TipWidgetConfig;
    isPreview?: boolean;
}

export const TipWidget = ({ tip, config, isPreview = false }: TipWidgetProps) => {
    // User requested "girl by default always".
    // We maintain unique avatars based on sender name.
    const avatarSeed = tip.sender;

    return (
        <div className="flex flex-col items-start w-full max-w-xl mx-auto">
            {/* Twitter/X Badge */}
            {tip.twitterHandle && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="flex items-center gap-2 px-4 py-1.5 mb-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full text-white shadow-lg"
                >
                    {/* Simple X Logo SVG */}
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span className="text-sm font-bold tracking-wide">@{tip.twitterHandle}</span>
                </motion.div>
            )}

            <motion.div
                initial={isPreview ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`w-full rounded-xl p-6 shadow-2xl relative overflow-hidden ${isPreview ? "" : "border-2 border-white/10"}`}
                style={{
                    backgroundColor: config.background_color,
                }}
            >
                {/* Background Image Layer */}
                {tip.backgroundUrl && (
                    <>
                        <div
                            className="absolute inset-0 bg-cover bg-center z-0"
                            style={{ backgroundImage: `url(${tip.backgroundUrl})` }}
                        />
                        {/* Dark Overlay for Readability */}
                        <div className="absolute inset-0 bg-black/60 z-0" />
                    </>
                )}

                {/* Content Layer */}
                <div className="relative z-10 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 shadow-md shrink-0">
                        <img
                            src={tip.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9`}
                            alt="Avatar"
                            className="w-full h-full bg-zinc-800 object-cover"
                        />
                    </div>
                    <div className="flex-1">
                        <div className="font-bold text-lg leading-tight mb-1" style={{ color: config.user_color }}>
                            {tip.sender} <span className="opacity-80 font-normal" style={{ color: config.message_color }}>{tip.actionText || 'tipped'}</span> <span style={{ color: config.amount_color }} className="drop-shadow-sm">{tip.amount}</span>
                        </div>
                        {tip.message && (
                            <p className="text-base opacity-90 leading-snug break-words" style={{ color: config.message_color }}>
                                {tip.message}
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

"use client";

import { motion } from "framer-motion";

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
}

interface TipWidgetProps {
    tip: TipData;
    config: TipWidgetConfig;
    isPreview?: boolean;
}

export const TipWidget = ({ tip, config, isPreview = false }: TipWidgetProps) => {
    // User requested "girl by default always".
    // We maintain unique avatars based on sender name.
    // Switching to 'lorelei' collection which is natively female-styled, 
    // avoiding the need for complex and error-prone query parameters on 'avataaars'.
    const avatarSeed = tip.sender;

    return (
        <motion.div
            initial={isPreview ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`w-full max-w-xl rounded-xl p-6 shadow-2xl relative ${isPreview ? "" : "border-2 border-white/10"}`} // Added border to live widget for visibility on dark/transparent backgrounds if needed, matching previous styles
            style={{
                backgroundColor: config.background_color,
            }}
        >
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 shadow-md shrink-0">
                    <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9`}
                        alt="Avatar"
                        className="w-full h-full bg-zinc-800 object-cover"
                    />
                </div>
                <div>
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
    );
};

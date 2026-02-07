"use client";

import { useState, useEffect, useRef } from "react";
import { TipWidget, TipData, TipWidgetConfig } from "./TipWidget";
import { Play, ChevronLeft, ChevronRight, Volume2, StopCircle } from "lucide-react";

const DEMO_TIPS: (TipData & { language: string, actionText: string })[] = [
    {
        sender: "Felix88",
        amount: "0.0002 BTC",
        message: "Great stream! Here is some coffee money ☕️ Keep grinding!",
        actionText: "tipped",
        language: "en"
    },
    {
        sender: "BaoBao",
        amount: "0.006 ETH",
        message: "主播真棒！这是给你的咖啡钱 ☕️ 继续加油！",
        actionText: "打赏了",
        language: "zh"
    },
    {
        sender: "Klaus_M",
        amount: "20 USDC",
        message: "Toller Stream! Hier ist etwas Kaffeegeld ☕️ Weiter so!",
        actionText: "hat gespendet",
        language: "de"
    },
    {
        sender: "Piotr_K",
        amount: "690000 PEPE",
        message: "Świetny stream! Oto na kawę ☕️ Tak trzymaj!",
        actionText: "wysłał napiwek",
        language: "pl"
    },
    {
        sender: "Sofia_L",
        amount: "30000000000 SHIB",
        message: "¡Gran transmisión! Aquí tienes para el café ☕️ ¡Sigue así!",
        actionText: "ha enviado",
        language: "es"
    },
    {
        sender: "Taka_S",
        amount: "0.5 SOL",
        message: "素晴らしい配信！コーヒー代です ☕️ 頑張ってください！",
        actionText: "がチップを送りました",
        language: "ja"
    }
];

const WIDGET_CONFIG: TipWidgetConfig = {
    tts_enabled: true,
    background_color: "rgba(9, 9, 11, 0.9)", // zinc-950/90
    user_color: "#facc15", // yellow-400
    amount_color: "#4ade80", // green-400
    message_color: "#ffffff"
};

const SAYS_MAP: Record<string, string> = {
    'pl': 'mówi',
    'de': 'sagt',
    'fr': 'dit',
    'es': 'dice',
    'it': 'dice',
    'ru': 'говорит',
    'zh': '说',
    'zh-HK': '說',
    'ja': 'が言いました',
    'ko': '가 말했습니다',
    'pt': 'diz',
    'tr': 'diyor ki',
    'uk': 'каже',
    'ar': 'يقول',
    'hi': 'कहते हैं',
    'en': 'says'
};

export function HomeWidgetDemo() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [voicesLoaded, setVoicesLoaded] = useState(false);

    // Ensure voices are loaded
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) setVoicesLoaded(true);
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    const currentTip = DEMO_TIPS[currentIndex];

    // Reset playing state when tip changes manually
    useEffect(() => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }, [currentIndex]);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % DEMO_TIPS.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + DEMO_TIPS.length) % DEMO_TIPS.length);
    };

    const handlePlay = () => {
        if (isPlaying) {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
            return;
        }

        const saysWord = SAYS_MAP[currentTip.language] || 'says';
        const textToSpeak = `${currentTip.sender} ${saysWord}: ${currentTip.message}`;

        const speech = new SpeechSynthesisUtterance(textToSpeak);
        speech.lang = currentTip.language;

        // Try to find a voice for this language
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(currentTip.language));
        if (voice) speech.voice = voice;

        speech.onstart = () => setIsPlaying(true);
        speech.onend = () => setIsPlaying(false);
        speech.onerror = () => setIsPlaying(false);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(speech);
    };

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
            <div className="flex items-center gap-4 w-full">
                <div className="flex-1 transform transition-all duration-500 hover:scale-[1.02]">
                    <TipWidget
                        key={currentIndex} // Force re-render for animation
                        tip={currentTip}
                        config={WIDGET_CONFIG}
                        isPreview={true}
                    />
                </div>

                {/* Play Button - Right Side */}
                <button
                    onClick={handlePlay}
                    className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isPlaying
                        ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                        : "bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30 hover:scale-110 active:scale-95"
                        }`}
                    title={isPlaying ? "Stop TTS" : "Play TTS"}
                >
                    {isPlaying ? <StopCircle size={28} /> : <Volume2 size={28} />}
                </button>
            </div>

            {/* Navigation - Bottom */}
            <div className="flex items-center gap-6">
                <button
                    onClick={handlePrev}
                    className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all hover:-translate-x-1"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="px-4 py-1 rounded-full bg-zinc-900/50 border border-zinc-800 text-xs font-mono text-zinc-500 uppercase tracking-widest">
                    {currentTip.language}
                </div>

                <button
                    onClick={handleNext}
                    className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all hover:translate-x-1"
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            <p className="text-xs text-zinc-500 text-center max-w-[200px]">
                Click the sound icon to hear the message in {currentTip.language === 'en' ? 'English' : 'native language'}.
            </p>
        </div>
    );
}

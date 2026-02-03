"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { TipWidget } from "@/components/TipWidget";
import { franc } from "franc";

type Tip = {
    sender: string;
    amount: string;
    message: string;
    asset: string;
    language?: string;
    actionText?: string;
};

export default function WidgetPage() {
    const params = useParams();
    const username = params.username as string;
    const [alert, setAlert] = useState<Tip | null>(null);
    const [connected, setConnected] = useState(false);
    const [config, setConfig] = useState({
        tts_enabled: false,
        background_color: "#000000",
        user_color: "#ffffff",
        amount_color: "#22c55e",
        message_color: "#ffffff"
    });

    // Fetch Widget Config
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/user/${username}`)
            .then(res => res.json())
            .then(data => {
                if (data.username) {
                    setConfig({
                        tts_enabled: data.widget_tts || false,
                        background_color: data.widget_bg_color || "#000000",
                        user_color: data.widget_user_color || "#ffffff",
                        amount_color: data.widget_amount_color || "#22c55e",
                        message_color: data.widget_message_color || "#ffffff"
                    });
                }
            })
            .catch(console.error);
    }, [username]);

    // WebSocket Connection
    useEffect(() => {
        const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080').replace("http", "ws") + `/ws/${username}`;
        let socket: WebSocket;

        const connect = () => {
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("Widget connected to WS");
                setConnected(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "TIP") {
                        const newTip: Tip = {
                            sender: data.sender || "Anonymous",
                            amount: data.amount || "0",
                            message: data.message || "",
                            asset: "ETH", // simplified for MVP
                            language: 'en' // default
                        };

                        // 1. Detect Language EARLY (for both Visual Widget & TTS)
                        if (newTip.message) {
                            // Added: cmn (Mandarin), zho (Chinese), arb (Arabic), hin (Hindi)
                            const commonLangs = ['pol', 'eng', 'deu', 'fra', 'spa', 'ita', 'rus', 'kor', 'jpn', 'ukr', 'tur', 'por', 'cmn', 'zho', 'arb', 'hin'];
                            const detectedLang3 = franc(newTip.message, { only: commonLangs });

                            // Map 3-letter to 2-letter (iso-639-1)
                            const langMap: Record<string, string> = {
                                'pol': 'pl',
                                'deu': 'de',
                                'eng': 'en',
                                'spa': 'es',
                                'fra': 'fr',
                                'ita': 'it',
                                'jpn': 'ja',
                                'kor': 'ko',
                                'zho': 'zh',
                                'cmn': 'zh',
                                'yue': 'zh-HK',
                                'rus': 'ru',
                                'nld': 'nl',
                                'por': 'pt',
                                'tur': 'tr',
                                'ukr': 'uk',
                                'arb': 'ar',
                                'hin': 'hi'
                            };

                            newTip.language = langMap[detectedLang3] || 'en';

                            // Localize "tipped"
                            const tippedMap: Record<string, string> = {
                                'pl': 'wysłał napiwek',
                                'de': 'hat gespendet',
                                'fr': 'a donné',
                                'es': 'ha enviado',
                                'it': 'ha inviato',
                                'ru': 'отправил',
                                'zh': '打赏了',
                                'zh-HK': '打賞了',
                                'ja': 'がチップを送りました',
                                'ko': '님이 후원했습니다',
                                'pt': 'enviou',
                                'tr': 'bağışladı',
                                'uk': 'надіслав tip',
                                'ar': 'أرسل إكرامية',
                                'hi': 'ने टिप दिया',
                                'en': 'tipped'
                            };
                            newTip.actionText = tippedMap[newTip.language] || 'tipped';
                        }

                        // Show Alert
                        setAlert(newTip);

                        // TTS
                        // TTS & duration logic
                        const minimumDuration = 10000; // 10s minimum
                        let tipFinishedSpeaking = false;
                        let tipMinDurationPassed = false;

                        const attemptClose = () => {
                            if (tipFinishedSpeaking && tipMinDurationPassed) {
                                setAlert(null);
                            }
                        };

                        // 1. Start Minimum Duration Timer
                        setTimeout(() => {
                            tipMinDurationPassed = true;
                            attemptClose();
                        }, minimumDuration);

                        // 2. Handle TTS or No-TTS path
                        if (config.tts_enabled && newTip.message) {

                            const targetLang = newTip.language || 'en';

                            // Localize "says"
                            const saysMap: Record<string, string> = {
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

                            const saysWord = saysMap[targetLang] || 'says';

                            // Construct message
                            let textToSpeak = `${newTip.sender} ${saysWord}: ${newTip.message}`;

                            const speech = new SpeechSynthesisUtterance(textToSpeak);
                            speech.lang = targetLang;

                            // 2b. Select Voice
                            const voices = window.speechSynthesis.getVoices();
                            let selectedVoice = voices.find(v => v.lang.startsWith(targetLang));

                            if (selectedVoice) {
                                speech.voice = selectedVoice;
                                console.log(`TTS: Detected ${targetLang}, using voice: ${selectedVoice.name}. Phrase: "${textToSpeak}"`);
                            } else {
                                console.log(`TTS: Detected ${targetLang}, but no voice found. Using default.`);
                            }

                            speech.onend = () => {
                                tipFinishedSpeaking = true;
                                attemptClose();
                            };

                            speech.onerror = (event) => {
                                console.error("TTS Error details:", event);
                                if (event.error === 'not-allowed') {
                                    console.log("Autoplay blocked. Showing overlay.");
                                    setInteractionNeeded(true);
                                }
                                // Don't close immediately on not-allowed, usually implies audio context blocked.
                                // But effectively speech is "done" (failed).
                                tipFinishedSpeaking = true;
                                attemptClose();
                            };

                            // Safety fallback: if speech takes excessively long (e.g. browser bug), force close after 60s
                            setTimeout(() => setAlert(null), 60000);

                            window.speechSynthesis.cancel(); // Cancel any previous speech

                            // Small delay to allow cancel to process
                            setTimeout(() => {
                                window.speechSynthesis.speak(speech);
                            }, 100);
                        } else {
                            // No TTS, so "speaking" is done immediately
                            tipFinishedSpeaking = true;
                            // Attempt close (will likely just wait for min timer)
                            attemptClose();
                        }
                    }
                } catch (e) {
                    console.error("WS Parse Error", e);
                }
            };

            // Ensure voices are loaded (Chrome edge case)
            if (window.speechSynthesis.getVoices().length === 0) {
                window.speechSynthesis.onvoiceschanged = () => {
                    // trigger re-render or just let the next event pick it up
                };
            }

            socket.onclose = () => {
                console.log("WS Disconnected, retrying...");
                setConnected(false);
                setTimeout(connect, 3000);
            };
        };

        connect();
        return () => socket?.close();
    }, [username, config.tts_enabled]);

    const [interactionNeeded, setInteractionNeeded] = useState(true);

    return (
        <div
            className="min-h-screen bg-transparent flex items-end justify-center p-8 overflow-hidden font-sans relative"
            onClick={() => setInteractionNeeded(false)} // Any click enables checks
        >
            {/* Connection Status Indicator (Hidden in OBS usually, but good for debug) */}
            <div className={`fixed top-4 right-4 w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500 animate-pulse"} shadow-md border border-white/20`} title={connected ? "Connected" : "Disconnected"} />

            {/* Interaction Overlay for Audio Context */}
            {interactionNeeded && config.tts_enabled && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 cursor-pointer backdrop-blur-sm">
                    <div className="bg-black border border-white/20 px-8 py-4 rounded-full animate-pulse">
                        <span className="text-white font-bold tracking-widest uppercase text-sm">Click anywhere to enable TTS</span>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {alert && (
                    <TipWidget
                        tip={alert}
                        config={config}
                        isPreview={false}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

"use client";

import { useEffect, useState, useRef } from "react";
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
    avatarUrl?: string; // Added for ENS/Custom Avatars
    backgroundUrl?: string; // Added for ENS Backgrounds
    twitterHandle?: string; // Added for ENS Twitter
};

export default function WidgetPage() {
    const params = useParams();
    const token = params.token as string;

    // State
    const [queue, setQueue] = useState<Tip[]>([]);
    const [currentTip, setCurrentTip] = useState<Tip | null>(null);
    const [connected, setConnected] = useState(false);
    const [interactionNeeded, setInteractionNeeded] = useState(true);

    // Queue Ref to avoid stale closures in timeouts
    const queueRef = useRef(queue);
    useEffect(() => { queueRef.current = queue; }, [queue]);

    // Config State
    const [config, setConfig] = useState({
        tts_enabled: false,
        background_color: "#000000",
        user_color: "#ffffff",
        amount_color: "#22c55e",
        message_color: "#ffffff"
    });

    // Fetch Widget Config
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/api/widget/${token}/config`)
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
    }, [token]);

    // WebSocket Connection - Ingests into Queue
    useEffect(() => {
        const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080').replace("http", "ws") + `/ws/${token}`;
        let socket: WebSocket | null = null;
        let retryTimeout: NodeJS.Timeout;
        let isMounted = true;

        const connect = () => {
            if (!isMounted) return;

            console.log("Connecting to WS...", wsUrl);
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("Widget connected to WS");
                if (isMounted) setConnected(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "TIP") {
                        const newTip: Tip = {
                            sender: data.sender || "Anonymous",
                            amount: data.amount || "0",
                            message: data.message || "",
                            asset: data.asset || "ETH",
                            avatarUrl: data.avatarUrl || data.avatar_url, // Support both cases
                            backgroundUrl: data.backgroundUrl || data.background_url, // Support both cases
                            twitterHandle: data.twitterHandle || data.twitter_handle, // Support both cases
                            language: 'en'
                        };

                        // Detect Language IMMEDIATELY upon receipt
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

                        if (isMounted) {
                            console.log("Added tip to queue:", newTip);
                            setQueue(prev => [...prev, newTip]);
                        }
                    }
                } catch (e) {
                    console.error("WS Parse Error", e);
                }
            };

            socket.onclose = () => {
                console.log("WS Disconnected");
                if (isMounted) {
                    setConnected(false);
                    // Only retry if intentional disconnect didn't happen (which sets isMounted false)
                    retryTimeout = setTimeout(connect, 3000);
                }
            };
        };

        connect();

        return () => {
            isMounted = false;
            clearTimeout(retryTimeout);
            socket?.close();
        };
    }, [token]);

    // Queue Processor
    useEffect(() => {
        // Only run if we are IDLE and there is something in the queue
        const hasItems = queue.length > 0;

        if (!currentTip && hasItems) {
            console.log("Queue idle, preparing next tip in 2s...");

            // Wait 2000ms for exit animation + buffer
            const timer = setTimeout(() => {
                setQueue(prev => {
                    // Pop from the head using ref to ensuring latest state
                    const currentQueue = queueRef.current;
                    if (currentQueue.length === 0) return prev; // Safety

                    const nextTip = currentQueue[0];
                    setCurrentTip(nextTip);

                    return prev.slice(1);
                });
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [currentTip, queue.length > 0]); // Depend on boolean emptiness to restart delay only if we run out and fetch more

    // Current Tip Processor (Display & TTS)
    useEffect(() => {
        if (!currentTip) return;

        console.log("Processing tip:", currentTip);
        let tipFinishedSpeaking = false;
        let tipMinDurationPassed = false;
        let isCleanedUp = false;

        const attemptFinish = () => {
            if (isCleanedUp) return;
            // Only clear if BOTH conditions are met
            if (tipFinishedSpeaking && tipMinDurationPassed) {
                console.log("Tip finished, clearing...");
                // Small buffer to ensure visual smoothness
                setTimeout(() => {
                    if (!isCleanedUp) setCurrentTip(null);
                }, 500);
            }
        };

        // 1. Minimum Duration Timer (10s)
        setTimeout(() => {
            tipMinDurationPassed = true;
            attemptFinish();
        }, 10000);

        // 2. TTS Logic
        if (config.tts_enabled && currentTip.message) {
            const targetLang = currentTip.language || 'en';
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
            const textToSpeak = `${currentTip.sender} ${saysWord}: ${currentTip.message}`;

            const speech = new SpeechSynthesisUtterance(textToSpeak);
            speech.lang = targetLang;

            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.lang.startsWith(targetLang));

            if (selectedVoice) {
                speech.voice = selectedVoice;
                console.log(`TTS: Using voice: ${selectedVoice.name}`);
            }

            speech.onend = () => {
                console.log("TTS Ended");
                tipFinishedSpeaking = true;
                attemptFinish();
            };

            speech.onerror = (event) => {
                console.error("TTS Error details:", event);
                if (event.error === 'not-allowed') {
                    console.log("Autoplay blocked. Showing overlay.");
                    setInteractionNeeded(true);
                }
                // Even on error, we mark it as "spoken" so the queue doesn't hang forever
                tipFinishedSpeaking = true;
                attemptFinish();
            };

            // Safety fallback: if speech takes excessively long (e.g. browser bug), force close after 60s
            // This prevents the queue from locking up if onend/onerror never fires.
            setTimeout(() => {
                if (!tipFinishedSpeaking) {
                    console.warn("TTS timed out, forcing next.");
                    tipFinishedSpeaking = true;
                    attemptFinish();
                }
            }, 60000);


            window.speechSynthesis.cancel(); // Cancel any previous speech

            // Small delay to allow cancel to process
            setTimeout(() => {
                window.speechSynthesis.speak(speech);
            }, 100);
        } else {
            // No TTS, so "speaking" is done immediately
            tipFinishedSpeaking = true;
            attemptFinish();
        }

        return () => { isCleanedUp = true; window.speechSynthesis.cancel(); };
    }, [currentTip, config.tts_enabled]);

    return (
        <div
            className="min-h-screen bg-transparent flex items-end justify-center p-8 overflow-hidden font-sans relative"
            onClick={() => setInteractionNeeded(false)} // Any click enables checks
        >


            {/* Interaction Overlay for Audio Context */}
            {interactionNeeded && config.tts_enabled && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 cursor-pointer backdrop-blur-sm">
                    <div className="bg-black border border-white/20 px-8 py-4 rounded-full animate-pulse">
                        <span className="text-white font-bold tracking-widest uppercase text-sm">Click anywhere to enable TTS</span>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {currentTip && (
                    <TipWidget
                        tip={currentTip}
                        config={config}
                        isPreview={false}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

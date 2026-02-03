"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { TipWidget } from "@/components/TipWidget";

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
                            asset: "ETH" // simplified for MVP
                        };

                        // Show Alert
                        setAlert(newTip);

                        // TTS
                        // TTS & duration logic
                        if (config.tts_enabled && newTip.message) {
                            const speech = new SpeechSynthesisUtterance(`${newTip.sender} says: ${newTip.message}`);

                            // Keep widget open until speech ends
                            speech.onend = () => {
                                setAlert(null);
                            };

                            // Safety fallback: if speech takes excessively long or fails to trigger onend, close after 45s
                            setTimeout(() => setAlert(null), 45000);

                            window.speechSynthesis.speak(speech);
                        } else {
                            // Standard duration if no TTS
                            setTimeout(() => setAlert(null), 8000);
                        }
                    }
                } catch (e) {
                    console.error("WS Parse Error", e);
                }
            };

            socket.onclose = () => {
                console.log("WS Disconnected, retrying...");
                setConnected(false);
                setTimeout(connect, 3000);
            };
        };

        connect();
        return () => socket?.close();
    }, [username, config.tts_enabled]); // Re-connect if TTS changes? Actually just reading config ref inside would be better but this is fine

    return (
        <div className="min-h-screen bg-transparent flex items-end justify-center p-8 overflow-hidden font-sans">
            {/* Connection Status Indicator (Hidden in OBS usually, but good for debug) */}
            <div className={`fixed top-4 right-4 w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500 animate-pulse"} shadow-md border border-white/20`} title={connected ? "Connected" : "Disconnected"} />

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

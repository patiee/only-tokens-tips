"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Tip = {
    type: string;
    sender: string;
    message: string;
    amount: string;
};

export default function WidgetPage() {
    const params = useParams();
    const username = params.username as string;
    const [tips, setTips] = useState<Tip[]>([]);
    const [currentTip, setCurrentTip] = useState<Tip | null>(null);

    useEffect(() => {
        if (!username) return;

        // Connect to WebSocket
        const ws = new WebSocket(`ws://localhost:8080/ws/${username}`);

        ws.onopen = () => {
            console.log("Connected to OBS Widget WebSocket");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.Type === "TIP") {
                    setTips((prev) => [...prev, {
                        type: "TIP",
                        sender: data.sender,
                        message: data.message,
                        amount: data.amount
                    }]);
                }
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from WS");
            // Reconnect logic could go here
        };

        return () => {
            ws.close();
        };
    }, [username]);

    // Queue system for displaying tips one by one
    useEffect(() => {
        if (!currentTip && tips.length > 0) {
            setCurrentTip(tips[0]);
            setTips((prev) => prev.slice(1));

            // Show for 5 seconds then clear
            setTimeout(() => {
                setCurrentTip(null);
            }, 5000);
        }
    }, [tips, currentTip]);

    if (!currentTip) return <div className="text-transparent">Waiting for tips...</div>;

    return (
        <div className="flex items-center justify-center min-h-screen bg-transparent">
            <div className="bg-black/80 text-white p-6 rounded-xl border-4 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] animate-bounce-in max-w-lg w-full text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2 drop-shadow-md">
                    {currentTip.sender}
                </div>
                <div className="text-xl text-purple-200 mb-4 font-semibold">
                    sent ${currentTip.amount}
                </div>
                <div className="text-2xl font-medium leading-relaxed break-words">
                    "{currentTip.message}"
                </div>
            </div>

            <style jsx global>{`
        body { background: transparent; }
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
        </div>
    );
}

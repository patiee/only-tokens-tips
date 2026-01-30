"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";

const PRESET_AMOUNTS = ["1", "5", "10", "50", "100", "150", "200"];

// Mock USDC on Sepolia (or use a real faucet one)
// Example: AAVE USDC Faucet on Sepolia: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
// If not available, we can use a dummy ERC20 deployed by us or standard ETH transfer for demo.
// Let's use standard ETH transfer for simplicity unless strictly USDC is required by user prompt (User said USDC).
// We'll assume USDC.
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC (Example)

const ERC20_ABI = [
    {
        constant: false,
        inputs: [
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        type: "function",
    },
] as const;

export default function ProfilePage() {
    const params = useParams();
    const username = params.username as string;
    const { address, isConnected } = useAccount();
    const { data: hash, writeContract, error: writeError, isPending: isWritePending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    });

    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("");
    const [senderName, setSenderName] = useState("");

    const handleSendTip = async () => {
        if (!isConnected || !amount) return;

        try {
            const amountInUnits = parseUnits(amount, 6); // USDC has 6 decimals usually

            // Recipient: In real app, fetch from backend. 
            // Mock recipient (replace with your test wallet)
            const RECIPIENT_ADDRESS = "0x7d206cd2e525f6c8d3505c6d32df1554fa40938456f4d805825e648342468301";

            writeContract({
                address: USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [RECIPIENT_ADDRESS, amountInUnits],
            });

        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
            <div className="max-w-md w-full bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-xl font-bold">Tip {username}</h1>
                    <ConnectButton />
                </header>

                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_AMOUNTS.map((val) => (
                            <button
                                key={val}
                                onClick={() => setAmount(val)}
                                className={`py-2 px-3 rounded-lg font-semibold transition-colors ${amount === val
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                                    }`}
                            >
                                ${val}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400">$</span>
                        <input
                            type="number"
                            placeholder="Custom Amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-gray-700 rounded-lg py-2 pl-8 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <input
                        type="text"
                        placeholder="Your Name (Optional)"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full bg-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <textarea
                        placeholder="Message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full bg-gray-700 rounded-lg p-3 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />

                    <button
                        onClick={handleSendTip}
                        disabled={!isConnected || !amount || isWritePending || isConfirming}
                        className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${isConnected && amount
                                ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                                : "bg-gray-600 cursor-not-allowed text-gray-400"
                            }`}
                    >
                        {isWritePending ? "Confirming in Wallet..." : isConfirming ? "Processing Transaction..." : "Send Tip"}
                    </button>

                    {/* Success/Error Handling would go here (using isConfirmed, writeError, hash) */}
                    {isConfirmed && (
                        <SuccessHandler
                            hash={hash}
                            username={username}
                            senderName={senderName}
                            message={message}
                            amount={amount}
                        />
                    )}
                    {writeError && (
                        <div className="p-3 bg-red-900/50 border border-red-500 rounded text-center text-red-200">
                            Error: {writeError.message.split('\n')[0]}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SuccessHandler({ hash, username, senderName, message, amount }: any) {
    const [notified, setNotified] = useState(false);

    if (!notified) {
        setNotified(true);
        fetch("http://localhost:8080/api/tip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                streamerId: username,
                sender: senderName || "Anonymous",
                message,
                amount: amount,
                txDigest: hash,
            }),
        }).catch(console.error);
    }

    return (
        <div className="p-3 bg-green-900/50 border border-green-500 rounded text-center text-green-200">
            Tip sent successfully!
        </div>
    );
}

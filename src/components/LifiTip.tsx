"use client";

import { useState } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";

const SEPOLIA_CHAIN_ID = 11155111;
const BASE_SEPOLIA_CHAIN_ID = 84532;

// Token Addresses on Sepolia (Mock/Real)
// Note: These are example addresses. For real LI.FI testnet usage we need supported tokens.
// Using ETH (0x000...) for native token.
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

interface LifiTipProps {
    recipientAddress: string;
    onSuccess: (txHash: string, amount: string, message: string) => void;
}

export function LifiTip({ recipientAddress, onSuccess }: LifiTipProps) {
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    const [amount, setAmount] = useState("0.01");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    const handleBridgeAndTip = async () => {
        if (!address || !recipientAddress) return;
        setLoading(true);
        setStatus("Fetching quote from LI.FI...");

        try {
            // 1. Get Quote from LI.FI
            // We want to bridge ETH from Sepolia to ETH on Base Sepolia (or USDC if supported)
            // Using ETH -> ETH for simplicity in this demo if supported, or falling back to Mainnet IDs if testnet fails.
            // For this MVP, we will try to use the API structure.

            const params = new URLSearchParams({
                fromChain: SEPOLIA_CHAIN_ID.toString(),
                toChain: BASE_SEPOLIA_CHAIN_ID.toString(),
                fromToken: ETH_ADDRESS,
                toToken: ETH_ADDRESS, // receiving ETH on Base
                toAddress: recipientAddress,
                fromAmount: parseEther(amount).toString(),
                fromAddress: address,
            });

            const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to fetch quote");
            }

            const quote = await response.json();

            setStatus("Initiating Transaction...");

            // 2. Execute Transaction
            const txHash = await sendTransactionAsync({
                to: quote.transactionRequest.to,
                data: quote.transactionRequest.data,
                value: BigInt(quote.transactionRequest.value),
            });

            setStatus("Transaction Sent! Waiting for confirmation...");
            onSuccess(txHash, amount, message);

        } catch (e: any) {
            console.error(e);
            setStatus(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 p-4 bg-zinc-900 rounded-xl border border-zinc-700">
            <h3 className="font-bold text-lg text-white">Cross-Chain Tip (LI.FI)</h3>
            <div className="space-y-2">
                <label className="text-sm text-zinc-400">Amount (ETH)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-white"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm text-zinc-400">Message</label>
                <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Say something nice..."
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-white"
                />
            </div>

            {status && (
                <div className="text-xs font-mono text-yellow-400 break-words bg-yellow-900/20 p-2 rounded">
                    {status}
                </div>
            )}

            <button
                onClick={handleBridgeAndTip}
                disabled={loading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-white transition-all disabled:opacity-50"
            >
                {loading ? "Processing..." : "Bridge & Tip (Sepolia -> Base)"}
            </button>
        </div>
    );
}

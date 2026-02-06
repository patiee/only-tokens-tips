import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import bs58 from "bs58"; // We need bs58 to encode signature. Or just send hex? Backend expects Hex or Base58. Standard is Base58.

export function SolanaLoginButton({ setStep, setFormData }: { setStep: (step: number) => void, setFormData: React.Dispatch<React.SetStateAction<any>> }) {
    const { publicKey, signMessage, connected } = useWallet();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!connected || !publicKey || !signMessage) return;
        setLoading(true);
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const address = publicKey.toBase58();
            const messageStr = `{"address":"${address}","timestamp":${timestamp}}`;
            const message = new TextEncoder().encode(messageStr);

            const signatureBytes = await signMessage(message);
            // Encode signature to Base58 (standard for Solana)
            // But we need a way to encode. installing bs58 package?
            // Or use Buffer? Buffer is node.
            // Let's stick to Hex if we can easily?
            // No, standard Solana signature is Base58.
            // I'll assume we can use `bs58` package. If not installed, I'll use a helper.
            // Wait, we didn't install bs58. @solana/web3.js has it inside maybe?
            // We can simple use a Hex encoding for now to avoid extra deps if the backend supports Hex.
            // Backend `verifySignature` supports Hex fallback.
            // So we can send Hex.

            // Hex encoding helper
            const signature = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080'}/auth/wallet-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address,
                    timestamp,
                    signature // Hex encoded
                })
            });

            const data = await res.json();
            if (res.ok) {
                if (data.status === "success") {
                    localStorage.setItem("user_token", data.token);
                    router.push("/me");
                } else if (data.status === "signup_needed") {
                    setFormData((prev: any) => ({ ...prev, signup_token: data.signup_token }));
                    setStep(2);
                }
            } else {
                console.error("Wallet login failed:", data.error);
                alert(data.error || "Login failed");
            }

        } catch (e: any) {
            console.error(e);
            alert("Sign message failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!connected) {
        return (
            <div className="w-full flex justify-center">
                <WalletMultiButton />
            </div>
        )
    }

    return (
        <div className="w-full space-y-3">
            <div className="flex justify-center">
                <WalletMultiButton />
            </div>
            <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 font-bold shadow-lg transition-all"
            >
                {loading ? "Verifying..." : "Sign In with Solana"}
            </button>
        </div>
    );
}

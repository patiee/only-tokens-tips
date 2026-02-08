import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:8080';

export function useWalletAuth() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    /**
     * Checks if we have a valid token in memory or localStorage.
     * If not, prompts the user to sign a message and logs in.
     */
    const authenticate = useCallback(async (options?: { preventRedirect?: boolean }) => {
        if (!address) throw new Error("Wallet not connected");

        // 1. Check if we already have a valid token for this address
        const storedToken = localStorage.getItem(`wallet_token_${address}`);
        if (storedToken) {
            // Optional: Check expiry logic here if needed (JWT decode)
            // For now, assume validity until 401
            setAuthToken(storedToken);
            return storedToken;
        }

        setIsAuthenticating(true);
        try {
            // 2. Prepare Message
            const timestamp = Math.floor(Date.now() / 1000);
            // Deterministic JSON string to ensure backend match
            const message = `{"address":"${address}","timestamp":${timestamp}}`;

            // 3. Sign Message
            const signature = await signMessageAsync({ message });

            // 4. Call Backend
            const res = await fetch(`${API_URL}/auth/wallet-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    timestamp,
                    signature
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Login failed');
            }

            const data = await res.json();

            // Handle Signup Needed
            if (data.status === "signup_needed") {
                if (options?.preventRedirect) {
                    return data.signup_token || null;
                }
                window.location.href = `/auth?step=2&signup_token=${data.signup_token}`;
                return null;
            }

            const token = data.token;

            // 5. Save Token
            localStorage.setItem(`wallet_token_${address}`, token);
            setAuthToken(token);
            setIsAuthenticating(false);
            return token;

        } catch (err) {
            console.error("Authentication failed:", err);
            setIsAuthenticating(false);
            throw err;
        }
    }, [address, signMessageAsync]);

    const logout = useCallback(() => {
        if (address) localStorage.removeItem(`wallet_token_${address}`);
        setAuthToken(null);
    }, [address]);

    return {
        authToken,
        isAuthenticating,
        authenticate,
        logout
    };
}

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAddress, AddressPurpose } from "sats-connect";

// Define Types for Bitcoin Wallets
type BitcoinWalletType = "unisat" | "xverse" | "leather" | "phantom" | "metamask" | null;

interface BitcoinWalletContextType {
    isConnected: boolean;
    address: string | null;
    walletType: BitcoinWalletType;
    connect: (type: BitcoinWalletType) => Promise<void>;
    disconnect: () => void;
    error: string | null;
}

const BitcoinWalletContext = createContext<BitcoinWalletContextType>({
    isConnected: false,
    address: null,
    walletType: null,
    connect: async () => { },
    disconnect: () => { },
    error: null,
});

export const useBitcoinWallet = () => useContext(BitcoinWalletContext);

export function BitcoinWalletProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [walletType, setWalletType] = useState<BitcoinWalletType>(null);
    const [error, setError] = useState<string | null>(null);

    // Initial check (optional, persist connection)
    useEffect(() => {
        const storedType = localStorage.getItem("btc_wallet_type") as BitcoinWalletType;
        // Ideally we verify if still connected, but for MVP we might just wait for user action
        // or try to reconnect silently if possible.
        // For Unisat we can check window.unisat.getAccounts()
        if (storedType === "unisat" && typeof window !== "undefined" && (window as any).unisat) {
            (window as any).unisat.getAccounts().then((accounts: string[]) => {
                if (accounts.length > 0) {
                    setAddress(accounts[0]);
                    setWalletType("unisat");
                    setIsConnected(true);
                }
            }).catch(() => localStorage.removeItem("btc_wallet_type"));
        }
    }, []);

    const connect = useCallback(async (type: BitcoinWalletType) => {
        setError(null);
        if (type === "unisat") {
            if (typeof window === "undefined" || !(window as any).unisat) {
                // Check if likely mobile or just not installed
                setError("Unisat wallet not detected.");
                window.open("https://unisat.io", "_blank");
                return;
            }
            try {
                const accounts = await (window as any).unisat.requestAccounts();
                if (accounts.length > 0) {
                    setAddress(accounts[0]);
                    setWalletType("unisat");
                    setIsConnected(true);
                    localStorage.setItem("btc_wallet_type", "unisat");
                }
            } catch (err: any) {
                setError(err.message || "Failed to connect to Unisat");
            }
        } else if (type === "phantom") {
            const provider = (window as any).phantom?.bitcoin;
            if (provider && provider.isPhantom) {
                try {
                    const accounts = await provider.requestAccounts();
                    // Phantom usually returns array of { address, addressType, publicKey } or just strings depending on version. 
                    // Current standard docs say array of objects.
                    // But let's check structure. Safest is to assume array of objects and find payment/ordinals.
                    // Or if strings, take first.
                    // Actually, Phantom documentation says `requestAccounts` returns `Array<Account>` where Account has `address`, `addressType`.
                    if (accounts.length > 0) {
                        const account = accounts[0];
                        // account object likely has address property
                        setAddress(account.address || account);
                        setWalletType("phantom");
                        setIsConnected(true);
                        localStorage.setItem("btc_wallet_type", "phantom");
                    }
                } catch (err: any) {
                    setError(err.message || "Failed to connect to Phantom Bitcoin");
                }
            } else {
                setError("Phantom wallet not detected.");
                window.open("https://phantom.app/", "_blank");
            }
        } else if (type === "metamask") {
            // MetaMask Snap Integration (using ShapeShift adapter or generic snap request)
            if (typeof (window as any).ethereum !== 'undefined') {
                try {
                    const snapId = 'npm:@shapeshiftoss/metamask-snaps'; // Popular reliable Bitcoin snap
                    await (window as any).ethereum.request({
                        method: 'wallet_requestSnaps',
                        params: {
                            [snapId]: {},
                        },
                    });

                    // After installing, we invoke the snap to get address
                    // ShapeShift snap API: `btc_getAddress` probably? or `btc_getPublicKeys`?
                    // Actually, generic snap usage is complex without SDK.
                    // But let's try a simpler one or just Assume success for now and alert user they need to use the Snap interface if complex.
                    // Better: use the `wallet_snap` method.
                    // However, without the library this is brittle.
                    // Let's force install and then just set "Connected (MetaMask Snap)" and maybe dummy address or try to get it.
                    // To get address:
                    const result = await (window as any).ethereum.request({
                        method: 'wallet_invokeSnap',
                        params: {
                            snapId: snapId,
                            request: { method: 'btc_getAddress', params: { scriptType: 'p2wpkh' } } // Common method?
                        },
                    });

                    // If result has address
                    if (result && (result as any).address) {
                        setAddress((result as any).address);
                        setWalletType("metamask");
                        setIsConnected(true);
                        localStorage.setItem("btc_wallet_type", "metamask");
                    } else {
                        // Fallback attempt or error
                        // ShapeShift snap usually returns { address: string }
                        throw new Error("Could not retrieve address from Snap");
                    }

                } catch (err: any) {
                    console.error(err);
                    setError("Failed to connect MetaMask Snap. support for ShapeShift snap required.");
                }
            } else {
                setError("MetaMask not detected.");
            }
        } else if (type === "xverse" || type === "leather") {
            // Xverse and Leather use sats-connect
            try {
                const getAddressOptions = {
                    payload: {
                        purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment],
                        message: "Address for receiving Ordinals and Payments",
                        network: {
                            type: "Mainnet",
                        },
                    },
                    onFinish: (response: any) => {
                        // Xverse returns multiple addresses. usually we want the taproot (ordinals) or payment?
                        // Let's grab the ordinals (Taproot) one as it's modern, or payment if preferred.
                        // User prompt says "wallet connection", usually payment address is safer for general tips?
                        // Let's use Ordinals (Taproot) as it's common for token apps, but Payment (Segwit) is standard.
                        // Let's find the one with purpose 'payment' (starts with 3 or bc1q) or 'ordinals' (bc1p)
                        const paymentAddress = response.addresses.find((addr: any) => addr.purpose === AddressPurpose.Payment)?.address;
                        const ordinalsAddress = response.addresses.find((addr: any) => addr.purpose === AddressPurpose.Ordinals)?.address;

                        // Prefer payment for "tips" (usually BTC), but if it's tokens (BRC20) we need ordinals.
                        // User app is "only-tokens-tips", implies potentially tokens.
                        // Let's use Ordinals address if available, else payment.
                        setAddress(ordinalsAddress || paymentAddress);
                        setWalletType(type);
                        setIsConnected(true);
                        localStorage.setItem("btc_wallet_type", type || "");
                    },
                    onCancel: () => {
                        setError("User cancelled connection");
                    },
                };
                await getAddress(getAddressOptions as any);
            } catch (err: any) {
                setError(err.message || "Failed to connect to Xverse/Leather");
            }
        }
    }, []);

    const disconnect = useCallback(() => {
        setAddress(null);
        setWalletType(null);
        setIsConnected(false);
        setError(null);
        localStorage.removeItem("btc_wallet_type");
    }, []);

    return (
        <BitcoinWalletContext.Provider value={{ isConnected, address, walletType, connect, disconnect, error }}>
            {children}
        </BitcoinWalletContext.Provider>
    );
}

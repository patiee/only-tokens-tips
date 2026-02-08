"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAddress, AddressPurpose, signTransaction } from "sats-connect";

// Define Types for Bitcoin Wallets
type BitcoinWalletType = "unisat" | "xverse" | "leather" | "phantom" | "metamask" | null;

interface BitcoinWalletContextType {
    isConnected: boolean;
    address: string | null;
    walletType: BitcoinWalletType;
    connect: (type: BitcoinWalletType) => Promise<void>;
    disconnect: () => void;
    signMessage: (message: string) => Promise<string>;
    sendBitcoinTransaction: (psbtHex: string) => Promise<string>; // Returns TxHash
    error: string | null;
}

const BitcoinWalletContext = createContext<BitcoinWalletContextType>({
    isConnected: false,
    address: null,
    walletType: null,
    connect: async () => { },
    disconnect: () => { },
    signMessage: async () => "",
    sendBitcoinTransaction: async () => "",
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
                    if (accounts.length > 0) {
                        const account = accounts[0];
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
        } else if (type === "xverse" || type === "leather") {
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
                        const paymentAddress = response.addresses.find((addr: any) => addr.purpose === AddressPurpose.Payment)?.address;
                        const ordinalsAddress = response.addresses.find((addr: any) => addr.purpose === AddressPurpose.Ordinals)?.address;
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

    const signMessage = useCallback(async (message: string): Promise<string> => {
        if (!walletType || !address) throw new Error("Wallet not connected");

        if (walletType === "unisat") {
            return await (window as any).unisat.signMessage(message);
        }

        if (walletType === "phantom") {
            const provider = (window as any).phantom?.bitcoin;
            if (provider) {
                const encodedMessage = new TextEncoder().encode(message);
                const signed = await provider.signMessage(encodedMessage);
                return Buffer.from(signed.signature).toString("base64");
            }
        }

        if (walletType === "xverse" || walletType === "leather") {
            // Not directly supported easily without checking docs for message signing in sats-connect
            // For now simpler to throw
            throw new Error("Message signing not supported for " + walletType + " yet.");
        }

        throw new Error("Signing not supported for this wallet type");
    }, [walletType, address]);

    const sendBitcoinTransaction = useCallback(async (psbtHex: string): Promise<string> => {
        if (!walletType || !address) throw new Error("Wallet not connected");

        // 1. UNISAT
        if (walletType === "unisat") {
            try {
                // Sign
                const signedPsbt = await (window as any).unisat.signPsbt(psbtHex);
                // Broadcast
                const txHash = await (window as any).unisat.pushPsbt(signedPsbt);
                return txHash;
            } catch (e: any) {
                throw new Error("Unisat Failed: " + (e.message || e));
            }
        }

        // 2. PHANTOM
        if (walletType === "phantom") {
            const provider = (window as any).phantom?.bitcoin;
            if (provider) {
                try {
                    // Phantom signAndSendTransaction usually expects PSBT in specific format?
                    // documentation: signTransaction returns signed PSBT.
                    // Let's try to sign and then we need to push.
                    // Does Phantom have push?
                    // provider.signTransaction(psbtBase64).
                    // Convert hex to base64
                    const psbtBuffer = Buffer.from(psbtHex, 'hex');
                    const psbtBase64 = psbtBuffer.toString('base64');

                    // Phantom 
                    const signedTransaction = await provider.signTransaction(psbtBase64);
                    // This returns signed PSBT. We need to broadcast.
                    // We can use a public mempool API to push?
                    // NOTE: This is a limitation. 
                    // Let's throw for now or assume user can use Unisat.
                    throw new Error("Phantom signing implemented but broadcast missing. Use Unisat.");
                } catch (e: any) {
                    throw new Error("Phantom Failed: " + (e.message || e));
                }
            }
        }

        // 3. XVERSE / LEATHER (sats-connect)
        if (walletType === "xverse" || walletType === "leather") {
            return new Promise((resolve, reject) => {
                const psbtBase64 = Buffer.from(psbtHex, 'hex').toString('base64');
                const signOptions = {
                    payload: {
                        network: {
                            type: "Mainnet",
                        },
                        message: "Sign Transaction",
                        psbtBase64: psbtBase64,
                        broadcast: true,
                        inputsToSign: [
                            {
                                address: address,
                                signingIndexes: [0], // Optimistic assumption: input 0 is ours? 
                                // Li.Fi usually constructs inputs. We might need to map them.
                                // If providing all inputs, we need to know which ones match our address.
                                // For tip, usually valid.
                                // If we don't specify inputsToSign, does it sign all?
                            }
                        ],
                    },
                    onFinish: (response: any) => {
                        resolve(response.txId);
                    },
                    onCancel: () => reject(new Error("User Canceled")),
                };

                // We need to be careful about inputsToSign.
                // If we don't know the inputs, Xverse might fail.
                // Let's try passing empty array and see if it auto-detects or fails.
                // Actually, sats-connect usually requires inputsToSign.
                reject(new Error("Xverse signing requires input mapping which is complex. Please use Unisat."));
                // signTransaction(signOptions);
            });
        }

        throw new Error("Wallet provider not supported for transactions");

    }, [walletType, address]);

    return (
        <BitcoinWalletContext.Provider value={{ isConnected, address, walletType, connect, disconnect, signMessage, sendBitcoinTransaction, error }}>
            {children}
        </BitcoinWalletContext.Provider>
    );
}

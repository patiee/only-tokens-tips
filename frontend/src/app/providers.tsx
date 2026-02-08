"use client";

import "@mysten/dapp-kit/dist/index.css";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createNetworkConfig, SuiClientProvider, WalletProvider as SuiWalletProvider } from "@mysten/dapp-kit";


import { config } from "@/config/wagmi";
import { BitcoinWalletProvider } from "@/contexts/BitcoinWalletContext";

import dynamic from "next/dynamic";

// Dynamically import SolanaProvider to avoid SSR issues with wallet adapters
const SolanaProvider = dynamic(() => import("@/providers/SolanaProvider"), { ssr: false });

const networkConfig = {
    mainnet: { url: "https://fullnode.mainnet.sui.io", network: "mainnet" as const },
    testnet: { url: "https://fullnode.testnet.sui.io", network: "testnet" as const },
};

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <BitcoinWalletProvider>
                    <SolanaProvider>
                        <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
                            <SuiWalletProvider>
                                {children}
                            </SuiWalletProvider>
                        </SuiClientProvider>
                    </SolanaProvider>
                </BitcoinWalletProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

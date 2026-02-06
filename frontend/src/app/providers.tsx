"use client";

import "@rainbow-me/rainbowkit/styles.css";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { config } from "@/config/wagmi";

import dynamic from "next/dynamic";

// Dynamically import SolanaProvider to avoid SSR issues with wallet adapters
const SolanaProvider = dynamic(() => import("@/providers/SolanaProvider"), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <SolanaProvider>
                    <RainbowKitProvider>
                        {children}
                    </RainbowKitProvider>
                </SolanaProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

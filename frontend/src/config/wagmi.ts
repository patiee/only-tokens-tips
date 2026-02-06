import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, type Transport } from "wagmi";
import { evmChains } from "./generated-chains";
import { type Chain } from "viem";

const chains = evmChains
    .filter(c => c.id !== 1337) // Filter out Hyperliquid (conflicts with Localhost default)
    .map((c) => ({
        id: c.id,
        name: c.name,
        nativeCurrency: c.metamask.nativeCurrency,
        rpcUrls: {
            default: { http: c.metamask.rpcUrls },
            public: { http: c.metamask.rpcUrls },
        },
        blockExplorers: c.metamask.blockExplorerUrls?.length > 0 ? {
            default: { name: "Explorer", url: c.metamask.blockExplorerUrls[0] },
        } : undefined,
    })) as unknown as readonly [Chain, ...Chain[]];

const transports = evmChains.reduce((acc, c) => {
    // Use the first RPC url provided by LiFi/Metamask config
    if (c.metamask.rpcUrls.length > 0) {
        acc[c.id] = http(c.metamask.rpcUrls[0]);
    }
    return acc;
}, {} as Record<number, Transport>);

export const config = getDefaultConfig({
    appName: "Stream Tips",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
    chains: chains,
    transports: transports,
    ssr: true,
});

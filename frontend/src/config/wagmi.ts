
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, base, optimism } from "wagmi/chains";
import { http } from "wagmi";

export const config = getDefaultConfig({
    appName: "Only Tokens Tips",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
    chains: [mainnet, base, optimism],
    transports: {
        [mainnet.id]: http("https://eth.llamarpc.com"),
        [base.id]: http("https://mainnet.base.org"),
        [optimism.id]: http("https://mainnet.optimism.io"),
    },
    ssr: true,
});


import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, base, optimism } from "wagmi/chains";

export const config = getDefaultConfig({
    appName: "Only Tokens Tips",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
    chains: [mainnet, base, optimism],
    ssr: true,
});

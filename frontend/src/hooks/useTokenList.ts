import { useState, useEffect } from 'react';
import { ChainFamily, allChains } from '@/config/chains';

export interface Token {
    symbol: string;
    name: string;
    address: string;
    logo?: string;
    decimals: number;
}

export function useTokenList(chainId: number) {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const chain = allChains.find(c => c.id === chainId);
        if (!chain) return;

        setLoading(true);
        const native: Token = {
            symbol: chain.nativeToken.symbol,
            name: chain.nativeToken.name,
            address: chain.nativeToken.address, // Usually 0x0...0 or '111...111'
            decimals: chain.nativeToken.decimals,
            logo: chain.nativeToken.logoURI
        };

        const fetchTokens = async () => {
            try {
                let newTokens = [native];

                if (chain.family === ChainFamily.EVM) {
                    try {
                        const res = await fetch(`https://li.quest/v1/tokens?chains=${chainId}`);
                        const data = await res.json();
                        if (data.tokens && data.tokens[chainId]) {
                            const extra = data.tokens[chainId]
                                .filter((t: any) => t.address !== "0x0000000000000000000000000000000000000000")
                                .map((t: any) => ({
                                    symbol: t.symbol,
                                    name: t.name,
                                    address: t.address,
                                    logo: t.logoURI,
                                    decimals: t.decimals
                                }));
                            newTokens = [...newTokens, ...extra];
                        }
                    } catch (e) {
                        console.error("Failed to fetch LiFi tokens", e);
                    }
                } else if (chain.family === ChainFamily.SOLANA) {
                    try {
                        const res = await fetch('/api/jupiter/tokens');
                        if (res.ok) {
                            const data = await res.json();
                            // Limit to 100 top tokens for now
                            const solTokens = data.slice(0, 100).map((t: any) => ({
                                symbol: t.symbol,
                                name: t.name,
                                address: t.address,
                                logo: t.logoURI,
                                decimals: t.decimals
                            }));
                            // Ensure native SOL isn't duped if Jup returns it (Jup usually returns Wrapped SOL)
                            newTokens = [native, ...solTokens];
                        }
                    } catch (e) {
                        console.error("Failed to fetch Solana tokens", e);
                    }
                } else {
                    // BTC, SUI etc - just native for now
                }

                setTokens(newTokens);
            } catch (err: any) {
                setError(err.message);
                setTokens([native]);
            } finally {
                setLoading(false);
            }
        };

        fetchTokens();
    }, [chainId]);

    return { tokens, loading, error };
}

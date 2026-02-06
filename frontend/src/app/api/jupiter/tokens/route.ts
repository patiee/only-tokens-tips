import { NextResponse } from 'next/server';
import { SOLANA_FALLBACK_TOKENS } from '@/config/solana-tokens';

export async function GET() {
    try {
        // Attempt fetch with short timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch('https://token.jup.ag/strict', {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 3600 },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`Jupiter API returned ${res.status}, using fallback.`);
            return NextResponse.json(SOLANA_FALLBACK_TOKENS);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Failed to fetch Jupiter tokens, using fallback:', error);
        // Return fallback list instead of error
        return NextResponse.json(SOLANA_FALLBACK_TOKENS);
    }
}

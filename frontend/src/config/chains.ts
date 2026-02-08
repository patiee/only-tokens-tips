import { evmChains, ChainConfig } from './generated-chains';

export enum ChainFamily {
    EVM = 'EVM',
    BITCOIN = 'Bitcoin',
    SOLANA = 'Solana',
    SUI = 'Sui',
}

export interface CustomChainConfig extends Omit<ChainConfig, 'metamask'> {
    family: ChainFamily;
    metamask?: ChainConfig['metamask'];
}

export const nonEvmChains: CustomChainConfig[] = [
    {
        id: 20000000000001,
        name: 'Bitcoin',
        key: 'btc',
        logoURI: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
        family: ChainFamily.BITCOIN,
        nativeToken: {
            symbol: 'BTC',
            decimals: 8,
            name: 'Bitcoin',
            logoURI: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
            address: 'bitcoin'
        }
    },
    {
        id: 1151111081099710,
        name: 'Solana',
        key: 'sol',
        logoURI: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
        family: ChainFamily.SOLANA,
        nativeToken: {
            symbol: 'SOL',
            decimals: 9,
            name: 'Solana',
            logoURI: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
            address: '11111111111111111111111111111111'
        }
    },
    {
        id: 9270000000000000,
        name: 'Sui',
        key: 'sui',
        logoURI: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg',
        family: ChainFamily.SUI,
        nativeToken: {
            symbol: 'SUI',
            decimals: 9,
            name: 'Sui',
            logoURI: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg',
            address: '0x2::sui::SUI'
        }
    }
];

export const allChains: CustomChainConfig[] = [
    ...nonEvmChains,
    ...evmChains.map(c => ({ ...c, family: ChainFamily.EVM }))
];

export const chainFamilies = [
    ChainFamily.BITCOIN,
    ChainFamily.SOLANA,
    ChainFamily.SUI,
    ChainFamily.EVM
];

export function isValidAddress(address: string, family: ChainFamily): boolean {
    if (!address) return false;

    switch (family) {
        case ChainFamily.EVM:
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        case ChainFamily.SOLANA:
            return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
        case ChainFamily.BITCOIN:
            // Simplified Bitcoin address regex (Legacy, SegWit, Bech32)
            return /^(1|3|bc1)[a-zA-Z0-9]{25,39}$/.test(address);
        case ChainFamily.SUI:
            // Sui addresses are 32 bytes hex, prefixed with 0x (66 chars total) or shorter with leading zeros omitted? 
            // Standard is 66 chars usually, but let's allow 0x + hex
            return /^0x[a-fA-F0-9]{1,64}$/.test(address);
        default:
            return false;
    }
}

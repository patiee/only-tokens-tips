"use client";

import { CustomSolanaWalletModal } from "@/components/CustomSolanaWalletModal";
import { CustomEVMWalletModal } from "@/components/CustomEVMWalletModal";
import { CustomBitcoinWalletModal } from "@/components/CustomBitcoinWalletModal";
import { CustomSuiWalletModal } from "@/components/CustomSuiWalletModal";

interface WalletConnectionModalsProps {
    isSolanaOpen: boolean;
    onSolanaClose: () => void;
    isBitcoinOpen: boolean;
    onBitcoinClose: () => void;
    isSuiOpen: boolean;
    onSuiClose: () => void;
    isEVMOpen: boolean;
    onEVMClose: () => void;
}

export function WalletConnectionModals({
    isSolanaOpen,
    onSolanaClose,
    isBitcoinOpen,
    onBitcoinClose,
    isSuiOpen,
    onSuiClose,
    isEVMOpen,
    onEVMClose
}: WalletConnectionModalsProps) {
    return (
        <>
            <CustomSolanaWalletModal
                isOpen={isSolanaOpen}
                onClose={onSolanaClose}
            />
            <CustomBitcoinWalletModal
                isOpen={isBitcoinOpen}
                onClose={onBitcoinClose}
            />
            <CustomSuiWalletModal
                isOpen={isSuiOpen}
                onClose={onSuiClose}
            />
            <CustomEVMWalletModal
                isOpen={isEVMOpen}
                onClose={onEVMClose}
            />
        </>
    );
}

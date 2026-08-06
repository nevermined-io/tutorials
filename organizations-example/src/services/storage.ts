import type { WalletResult } from '../types/api';

const STORAGE_KEYS = {
    WALLET_RESULT: 'nevermined_wallet_result',
} as const;

/**
 * Save wallet result to localStorage
 * @param walletResult - Wallet result data to save
 */
export function saveWalletResult(walletResult: WalletResult): void {
    try {
        const serialized = JSON.stringify(walletResult);
        localStorage.setItem(STORAGE_KEYS.WALLET_RESULT, serialized);
        console.log('💾 Wallet result saved to localStorage:', walletResult);
    } catch (error) {
        console.error('❌ Error saving wallet result to localStorage:', error);
    }
}

/**
 * Get wallet result from localStorage
 * @returns WalletResult if found, null otherwise
 */
export function getWalletResult(): WalletResult | null {
    try {
        const serialized = localStorage.getItem(STORAGE_KEYS.WALLET_RESULT);
        if (!serialized) {
            return null;
        }

        const walletResult = JSON.parse(serialized) as WalletResult;
        console.log('📂 Wallet result retrieved from localStorage:', walletResult);
        return walletResult;
    } catch (error) {
        console.error('❌ Error retrieving wallet result from localStorage:', error);
        return null;
    }
}

/**
 * Clear wallet result from localStorage
 */
export function clearWalletResult(): void {
    try {
        localStorage.removeItem(STORAGE_KEYS.WALLET_RESULT);
        console.log('🗑️ Wallet result cleared from localStorage');
    } catch (error) {
        console.error('❌ Error clearing wallet result from localStorage:', error);
    }
}

/**
 * Check if wallet result exists in localStorage
 * @returns true if wallet result exists, false otherwise
 */
export function hasWalletResult(): boolean {
    return getWalletResult() !== null;
}

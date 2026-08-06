// Environment configuration
export const ENV = {
    CHECKOUT_BASE_URL: import.meta.env.VITE_CHECKOUT_BASE_URL || '',
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
    BUILDER_NVM_API_KEY: import.meta.env.VITE_BUILDER_NVM_API_KEY || '',
} as const;

export function getCheckoutUrl(agentId: string): string {
    return `${ENV.CHECKOUT_BASE_URL}/checkout/${agentId}`;
}

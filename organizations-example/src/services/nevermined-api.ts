import { ENV } from '@/config/environment';
import type {
    ApiConfig,
    ApiError,
    CreateAgentPlanRequest,
    CreateUserRequest,
    CreateUserResponse,
    RegisterAgentAndPlanDto,
    WalletResult
} from '../types/api';
import { saveWalletResult } from './storage';

// API Configuration
// const API_CONFIG: ApiConfig = {
//     baseUrl: 'http://localhost:3001',
//     bearerToken: 'sandbox-local:eyJhbGciOiJFUzI1NksifQ.eyJpc3MiOiIweDU4MzhCNTUxMmNGOWYxMkZFOWYyYmVjY0IyMGViNDcyMTFGOUIwYmMiLCJzdWIiOiIweDcwZThjRTc3NzI0Q2ZhMzA1MEIwYzUzNDJCZDNCZjdiYTZlRmM0M0UiLCJqdGkiOiIweDhhYTk0MDQxOTc3M2ZiNjA3YjQxMDAzOTQ5MTc3ZWRkYzI1ODU2MzczM2ExMWQxNTgzZGQ4OGQ3MjQ2MDc5NWYiLCJleHAiOjE3OTAzNDY0NzgsIm8xMXkiOiJzay1oZWxpY29uZS1tamZ6MzJhLXF4aXVpMnEteDV5YmNoeS11NnJjZXhpIn0.c3lwKLX1_Gnuh9IkvUQfnl1qGcyAMFGLmVwsg6mgcfUjtSXEeHaaUgQ_il0l962vDV9kq6DJXgI96Ozv-fq2ehs'
// };

/**
 * Creates a user by organization using Nevermined API
 * @param userData - User data to create
 * @returns Promise with the API response
 */
export async function createUserByOrganization(userData: CreateUserRequest): Promise<CreateUserResponse> {
    try {
        console.log('🚀 Making API call to create user:', userData);

        const response = await fetch(`${ENV.API_BASE_URL}/api/v1/organizations/account`, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${ENV.BUILDER_NVM_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        console.log('📡 API Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            const error: ApiError = {
                message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                status: response.status,
                details: errorData,
            };
            throw error;
        }

        const data = await response.json();
        console.log('✅ API Response data:', data);

        // Extract wallet result from data.walletResult
        let walletResult: WalletResult | undefined;

        if (data && data.walletResult && data.walletResult.hash && data.walletResult.userId && data.walletResult.userWallet) {
            console.log('📍 Found wallet data in data.walletResult');
            walletResult = {
                hash: data.walletResult.hash,
                userId: data.walletResult.userId,
                userWallet: data.walletResult.userWallet,
            };

            console.log('💾 Saving wallet result to localStorage:', walletResult);
            saveWalletResult(walletResult);
        } else {
            console.warn('⚠️ Could not extract wallet data from API response');
            console.log('🔍 Expected walletResult in response but found:', data.walletResult);
        }

        return {
            success: true,
            message: 'User created successfully',
            data,
            walletResult,
        };

    } catch (error) {
        console.error('❌ API Error:', error);

        if (error instanceof Error && 'status' in error) {
            // It's already an ApiError
            throw error;
        }

        // Handle network or other errors
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : 'Network error occurred',
            status: 0,
            details: error,
        };

        throw apiError;
    }
}

/**
 * Creates an agent and payment plan using Nevermined API
 * @param agentPlanData - Agent and plan data to create
 * @param walletResult - Wallet result containing the authorization hash
 * @returns Promise with the API response
 */
export async function createAgentAndPlan(agentPlanData: RegisterAgentAndPlanDto, walletResult: WalletResult): Promise<any> {
    try {
        console.log('🚀 Making API call to create agent and plan:', agentPlanData);

        const response = await fetch(`${ENV.API_BASE_URL}/api/v1/protocol/agents/plans`, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${walletResult.hash}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(agentPlanData),
        });

        console.log('🔑 Using authorization token from user hash:', walletResult.hash.slice(0, 50) + '...');

        console.log('📡 API Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            const error: ApiError = {
                message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                status: response.status,
                details: errorData,
            };
            throw error;
        }

        const data = await response.json();
        console.log('✅ Agent and Plan API Response data:', data);

        return data;

    } catch (error) {
        console.error('❌ Agent and Plan API Error:', error);

        if (error instanceof Error && 'status' in error) {
            // It's already an ApiError
            throw error;
        }

        // Handle network or other errors
        const apiError: ApiError = {
            message: error instanceof Error ? error.message : 'Network error occurred',
            status: 0,
            details: error,
        };

        throw apiError;
    }
}

/**
 * Helper function to generate test user data
 */
export function generateTestUserData(): CreateUserRequest {
    const timestamp = Date.now();
    return {
        uniqueExternalId: `test-user-${timestamp}`,
        email: `user-${timestamp}@example.com`,
    };
}

/**
 * Helper function to generate test agent and plan data
 * @param formData - Basic form data from user
 * @param walletResult - Wallet information from localStorage
 * @returns Complete RegisterAgentAndPlanDto object
 */
export function generateAgentAndPlanData(
    formData: CreateAgentPlanRequest,
    walletResult: WalletResult
): RegisterAgentAndPlanDto {
    const timestamp = Date.now();
    const agentName = formData.name || `Agent-${timestamp}`;
    const planName = `${agentName}-Plan`;

    return {
        plan: {
            metadataAttributes: {
                name: planName,
                description: formData.description || `Payment plan for ${agentName}`,
            },
            priceConfig: {
                priceType: formData.currency === 'USDC' ? 0 : 1,
                amounts: [(formData.price * 1000000).toString()],
                receivers: [walletResult.userWallet], // Use user's wallet as receiver
                tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Hardcoded token address
                contractAddress: '0x0000000000000000000000000000000000000000', // Zero address
            },
            creditsConfig: {
                creditsType: 1,
                redemptionType: 2,
                proofRequired: false,
                amount: '1000',
                minAmount: '1',
                maxAmount: '1',
                durationSecs: '0',
            },
            isTrialPlan: false,
            appId: '1',
        },
        agent: {
            metadataAttributes: {
                name: agentName,
                description: formData.description || `AI Agent: ${agentName}`,
            },
            agentApiAttributes: {
                endpoints: [
                    {
                        POST: `https://myagent.ai/api/v1/agents/${walletResult.userId}/tasks`,
                    },
                ],
                openEndpoints: ['https://myagent.ai/docs'],
                openApiUrl: 'https://myagent.ai/api-docs',
                authType: 'none',
            }
        },
    };
}

/**
 * Creates a Stripe account
 * @param userEmail - The email of the user
 * @param userCountryCode - The country code of the user
 * @param walletResult - The wallet result
 * @returns Promise with the API response
 */
export async function createStripeAccount({
    userEmail,
    userCountryCode,
    walletResult,
}: {
    userEmail: string;
    userCountryCode: string;
    walletResult: WalletResult;
}) {

    const response = await fetch(`${ENV.API_BASE_URL}/api/v1/stripe/account`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${walletResult.hash}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userEmail,
            userCountryCode,
            returnUrl: 'http://localhost:3002',
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to create Stripe account');
    }

    const data = await response.json();
    console.log('✅ Stripe account created:', data);

    return data;
}

/**
 * Gets a profile by user ID
 * @param hash - The hash of the user
 * @param userId - The user ID
 * @returns Promise with the API response
 */
export const getProfile = async (hash: string, userId: string) => {
    const response = await fetch(`${ENV.API_BASE_URL}/api/v1/metadata/profiles/${userId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${hash}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
        throw new Error('Failed to get profile');
    }

    const data = await response.json();
    console.log('✅ Profile:', data);

    return data;
  };


export async function getUserAgents(hash: string) {
    const response = await fetch(`${ENV.API_BASE_URL}/api/v1/protocol/agents`, {
        headers: {
            Authorization: `Bearer ${hash}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to get user agents');
    }

    const data = await response.json();
    console.log('✅ User agents:', data);

    return data;
}
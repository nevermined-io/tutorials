// API Types for Nevermined Organizations
export interface CreateUserRequest {
    uniqueExternalId: string;
    email: string;
    role?: string;
}

export interface WalletResult {
    hash: string;
    userId: string;
    userWallet: string;
}

export interface CreateUserResponse {
    success: boolean;
    message?: string;
    data?: any;
    walletResult?: WalletResult;
}

export interface CreateAgentPlanRequest {
    price: number;
    currency?: string;
    description?: string;
    name?: string;
}

// Agent and Plan Registration Types
export interface MetadataMainAttributesPlanDto {
    name: string;
    description: string;
}

export interface MetadataMainAttributesAgentDto {
    name: string;
    description: string;
}

export interface PricingConfigDto {
    priceType: number;
    amounts: string[];
    receivers: string[];
    tokenAddress: string;
    contractAddress: string;
}

export interface CreditsConfigDto {
    creditsType: number;
    redemptionType: number;
    proofRequired: boolean;
    amount: string;
    minAmount: string;
    maxAmount: string;
    durationSecs: string;
}

export interface RegisterPaymentPlanDto {
    metadataAttributes: MetadataMainAttributesPlanDto;
    priceConfig: PricingConfigDto;
    creditsConfig: CreditsConfigDto;
    nonce?: string; // bigint as string
    isTrialPlan?: boolean;
    appId?: string;
}

export interface AgentEndpoint {
    [method: string]: string; // e.g., { "POST": "https://myagent.ai/api/v1/agents/:agentId/tasks" }
}

export interface AgentAPIAttributesDto {
    endpoints: AgentEndpoint[];
    openEndpoints: string[];
    openApiUrl: string;
    authType: string;
}

export interface RegisterAgentDto {
    metadataAttributes: MetadataMainAttributesAgentDto;
    agentApiAttributes: AgentAPIAttributesDto;
    plans?: string[]; // bigint[] as string[]
}

export interface RegisterAgentAndPlanDto {
    plan: RegisterPaymentPlanDto;
    agent: RegisterAgentDto;
}


export interface ApiError {
    message: string;
    status: number;
    details?: any;
}

export interface ApiConfig {
    baseUrl: string;
    bearerToken: string;
}

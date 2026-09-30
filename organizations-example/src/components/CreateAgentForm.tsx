import { useState } from 'react';
import type { CreateAgentPlanRequest, WalletResult } from '../types/api';

interface CreateAgentFormProps {
    walletResult: WalletResult;
    onSubmit: (formData: CreateAgentPlanRequest) => Promise<void>;
    isLoading: boolean;
}

export function CreateAgentForm({ walletResult, onSubmit, isLoading }: CreateAgentFormProps) {
    const [price, setPrice] = useState<bigint>(0n);
    const [currency, setCurrency] = useState<string>('USD');
    const [credits, setCredits] = useState<bigint>(0n);
    const [description, setDescription] = useState<string>('');
    const [agentName, setAgentName] = useState<string>('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const numericPrice = parseFloat(price.toString());
        if (isNaN(numericPrice) || numericPrice <= 0) {
            alert('Please enter a valid price');
            return;
        }

        const formData: CreateAgentPlanRequest = {
            price: numericPrice,
            currency: currency,
            description: description.trim() || undefined,
            name: agentName.trim() || undefined,
        };

        await onSubmit(formData);
    };

    return (
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                Create Agent & Plan 🤖
            </h1>

            {/* Wallet Info */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Connected Wallet 💳</h3>
                <div className="text-sm text-blue-700 space-y-1">
                    <p><span className="font-medium">User ID:</span> {walletResult.userId}</p>
                    <p><span className="font-medium">Hash:</span> {walletResult.hash.slice(0, 20)}...</p>
                    <p><span className="font-medium">Wallet:</span> {walletResult.userWallet.slice(0, 20)}...</p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Agent Name Input */}
                <div>
                    <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-2">
                        Agent Name (Optional)
                    </label>
                    <input
                        type="text"
                        id="agentName"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="My AI Agent"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {/* Price Input */}
                <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                        Price *
                    </label>
                    <div className="flex">
                        <input
                            type="number"
                            id="price"
                            value={price.toString()}
                            onChange={(e) => setPrice(BigInt(e.target.value))}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="px-3 py-2 border-t border-r border-b border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                        >
                            <option value="USD">USD</option>
                            <option value="USDC">USDC</option>
                        </select>
                    </div>
                </div>
                {/* Credits Input */}
                <div>
                    <label htmlFor="credits" className="block text-sm font-medium text-gray-700 mb-2">
                        Credits *
                    </label>
                    <div className="flex">
                        <input
                            type="number"
                            id="credits"
                            value={credits.toString()}
                            onChange={(e) => setCredits(BigInt(e.target.value))}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>


                {/* Description Input */}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your agent and plan..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading || !price}
                    className={`w-full ${isLoading || !price
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 hover:scale-105'
                        } text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform`}
                >
                    {isLoading ? (
                        <>
                            <span className="inline-block animate-spin mr-2">⏳</span>
                            Creating...
                        </>
                    ) : (
                        'Create Agent & Plan 🚀'
                    )}
                </button>
            </form>
        </div>
    );
}

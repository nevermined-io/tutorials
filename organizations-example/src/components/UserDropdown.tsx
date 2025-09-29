import { useState } from 'react';
import type { WalletResult } from '../types/api';

interface UserDropdownProps {
    walletResult: WalletResult;
    onCleanLocalStorage: () => void;
}

export function UserDropdown({ walletResult, onCleanLocalStorage }: UserDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const handleCleanStorage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🗑️ Clean storage button clicked!'); // Debug log
        onCleanLocalStorage();
        setIsOpen(false);
    };

    return (
        <div className="fixed top-4 right-4 z-50">
            <div className="relative">
                {/* Dropdown Trigger */}
                <button
                    onClick={toggleDropdown}
                    className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                            {walletResult.userId.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <span className="text-sm text-gray-700 font-medium">
                        {walletResult.userId.length > 12
                            ? `${walletResult.userId.slice(0, 12)}...`
                            : walletResult.userId
                        }
                    </span>
                    <svg
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div
                        className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg animate-in slide-in-from-top-2 duration-200 z-[60]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 font-bold">
                                        {walletResult.userId.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">Connected User</p>
                                    <p className="text-sm text-gray-500">Nevermined Wallet</p>
                                </div>
                            </div>

                            {/* User Details */}
                            <div className="space-y-3 mb-4">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                        User ID
                                    </p>
                                    <p className="text-sm text-gray-900 font-mono break-all">
                                        {walletResult.userId}
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                        Hash
                                    </p>
                                    <p className="text-sm text-gray-900 font-mono break-all">
                                        {walletResult.hash.slice(0, 20)}...
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                        Wallet Address
                                    </p>
                                    <p className="text-sm text-gray-900 font-mono break-all">
                                        {walletResult.userWallet.slice(0, 20)}...
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="border-t border-gray-200 pt-4">
                                <button
                                    onClick={handleCleanStorage}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span>Clean localStorage</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Overlay to close dropdown when clicking outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[45]"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔄 Overlay clicked - closing dropdown');
                        setIsOpen(false);
                    }}
                />
            )}
        </div>
    );
}

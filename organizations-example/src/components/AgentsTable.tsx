import { useEffect, useState } from 'react'
import { getCheckoutUrl } from '../config/environment'

interface Agent {
    id: string
    metadata?: {
        main?: {
            name?: string
            description?: string
        }
        created?: string
    }
}

interface AgentsTableProps {
    userAgents: {
        agents: Agent[]
    } | null
}

export function AgentsTable({ userAgents }: AgentsTableProps) {
    // Pagination states
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [itemsPerPage] = useState<number>(5)

    // Reset to first page when agents change
    useEffect(() => {
        setCurrentPage(1)
    }, [userAgents])

    if (!userAgents || !userAgents.agents || userAgents.agents.length === 0) {
        return null
    }

    // Pagination calculations
    const totalAgents = userAgents.agents.length
    const totalPages = Math.ceil(totalAgents / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentAgents = userAgents.agents.slice(startIndex, endIndex)

    // Pagination handlers
    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    }

    const goToPreviousPage = () => {
        setCurrentPage(prev => Math.max(1, prev - 1))
    }

    const goToNextPage = () => {
        setCurrentPage(prev => Math.min(totalPages, prev + 1))
    }

    return (
        <div className="fixed top-20 left-6 right-6 z-10">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="mr-2">🤖</span>
                            My Agents ({totalAgents})
                        </div>
                        {totalPages > 1 && (
                            <div className="text-sm text-blue-100">
                                Page {currentPage} of {totalPages}
                            </div>
                        )}
                    </h2>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Agent ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Checkout URL
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {currentAgents.map((agent: Agent, index: number) => (
                                <tr key={agent.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-mono text-gray-900 truncate max-w-xs" title={agent.id}>
                                            {agent.id}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {agent.metadata?.main?.name || `Agent ${startIndex + index + 1}`}
                                        </div>
                                        <div className="text-sm text-gray-500 truncate max-w-xs">
                                            {agent.metadata?.main?.description || 'No description'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {getCheckoutUrl(agent.id)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm text-gray-700">
                                <span>
                                    Showing {startIndex + 1} to {Math.min(endIndex, totalAgents)} of {totalAgents} agents
                                </span>
                            </div>

                            <div className="flex items-center space-x-2">
                                {/* Previous Button */}
                                <button
                                    onClick={goToPreviousPage}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${currentPage === 1
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    ← Previous
                                </button>

                                {/* Page Numbers */}
                                <div className="flex items-center space-x-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            onClick={() => goToPage(pageNum)}
                                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pageNum === currentPage
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                </div>

                                {/* Next Button */}
                                <button
                                    onClick={goToNextPage}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${currentPage === totalPages
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

import { Link } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AgentsTable } from './components/AgentsTable'
import { CreateAgentForm } from './components/CreateAgentForm'
import StripeConnectionModal from './components/StripeConnectionModal'
import { UserDropdown } from './components/UserDropdown'
import { getCheckoutUrl } from './config/environment'
import { createAgentAndPlan, createUserByOrganization, generateAgentAndPlanData, getProfile, getUserAgents } from './services/nevermined-api'
import { clearWalletResult, getWalletResult } from './services/storage'
import type { ApiError, CreateAgentPlanRequest, WalletResult } from './types/api'

function App() {
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletResult, setWalletResult] = useState<WalletResult | null>(null)
  const [createdAgent, setCreatedAgent] = useState<any>(null)
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('')
  const [userCountryCode, setUserCountryCode] = useState<string>('')
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string>('')
  const [userAgents, setUserAgents] = useState<any>(null)

  // Check localStorage on component mount
  useEffect(() => {
    const savedWalletResult = getWalletResult()
    if (savedWalletResult) {
      setWalletResult(savedWalletResult)
    }
  }, [])

  const handleConnectNevermined = async () => {
    setIsLoading(true)
    setError(null)
    setMessage('')

    try {

      const userData = {
        uniqueExternalId: userId,
        email: userEmail,
      }

      // Make API call
      const response = await createUserByOrganization(userData)

      setMessage(`✅ Success! User created: ${userData.uniqueExternalId}`)
      console.log('✅ Success:', response)

      // Update wallet result state if available
      if (response.walletResult) {
        setWalletResult(response.walletResult)
      }

    } catch (err) {
      const apiError = err as ApiError
      const errorMessage = `❌ Error: ${apiError.message}`
      setError(errorMessage)
      console.error('❌ Connection failed:', apiError)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAgentPlan = async (formData: CreateAgentPlanRequest) => {
    setIsLoading(true)
    setError(null)
    setMessage('')

    try {
      if (!walletResult) {
        throw new Error('Wallet result not available')
      }

      console.log('🔄 Creating agent and plan with data:', formData)
      console.log('📋 Using wallet result:', walletResult)

      // Generate complete agent and plan data
      const agentPlanData = generateAgentAndPlanData(formData, walletResult)
      console.log('🏗️ Generated agent and plan data:', agentPlanData)

      // Make API call to create agent and plan
      const response = await createAgentAndPlan(agentPlanData, walletResult)

      // Extract agent data from response
      const agentId = response?.data?.agentId || response?.agentId;
      const planId = response?.data?.planId || response?.planId;

      // Store created agent data
      const agentData = {
        agentId,
        planId,
        price: formData.price,
        currency: formData.currency || 'USD',
        name: formData.name || `Agent-${Date.now()}`,
        checkoutUrl: agentId ? getCheckoutUrl(agentId) : null,
        createdAt: new Date().toISOString(),
      };

      setCreatedAgent(agentData)
      setMessage('success') // Simple success flag

      console.log('✅ Agent and Plan created:', response)
      console.log('🔗 Checkout URL:', agentData.checkoutUrl)

    } catch (err) {
      const apiError = err as ApiError
      const errorMessage = `❌ Error creating agent: ${apiError.message}`
      setError(errorMessage)
      console.error('❌ Agent creation failed:', apiError)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStripeConnection = () => {
    setShowStripeModal(true);
  };

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    return userEmail.trim() !== '' &&
      userCountryCode.trim() !== '' &&
      isValidEmail(userEmail);
  };

  useEffect(() => {
    if (walletResult) {
      getProfile(walletResult.hash, walletResult.userId).then(setProfile)
    }
  }, [walletResult])


  const handleDisconnect = () => {
    clearWalletResult()
    setWalletResult(null)
    setMessage('')
    setError(null)
    setCreatedAgent(null)
  }

  const handleCleanLocalStorage = () => {
    clearWalletResult()
    setWalletResult(null)
    setMessage('🗑️ localStorage cleaned successfully!')
    setError(null)
    setCreatedAgent(null)
    console.log('🗑️ localStorage has been cleaned')
  }
  useEffect(() => {
    if (walletResult) {
      getUserAgents(walletResult.hash).then(setUserAgents)
    }
    else {
      setUserAgents(null)
    }
  }, [walletResult])
  console.log('🔍 User agents:', userAgents)

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8 ${userAgents && userAgents.agents && userAgents.agents.length > 0 ? 'pt-48' : ''
      }`}>
      {walletResult && (
        <UserDropdown
          walletResult={walletResult}
          onCleanLocalStorage={handleCleanLocalStorage}
        />
      )}

      {/* User Agents Table */}
      {walletResult && <AgentsTable userAgents={userAgents} />}


      {profile?.sandbox?.isStripeEnabled && walletResult ? (
        // Show Create Agent Form when wallet is connected
        <div className="space-y-6">
          <CreateAgentForm
            walletResult={walletResult}
            onSubmit={handleCreateAgentPlan}
            isLoading={isLoading}
          />

          {/* Disconnect Button */}
          <div className="text-center">
            <button
              onClick={handleDisconnect}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Disconnect Wallet 🔌
            </button>
          </div>
        </div>
      ) : (
        // Show Connect Button when wallet is not connected
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Organizations Example 🏢
          </h1>

          {showStripeModal && walletResult && profile &&
            <>
              <StripeConnectionModal onClose={() => setShowStripeModal(false)} walletResult={walletResult} userEmail={userEmail} userCountryCode={userCountryCode} />
            </>
          }
          {walletResult && !profile?.sandbox?.isStripeEnabled &&
            <div className="space-y-4 w-full max-w-md">

              {/* Country Code Input */}
              <div>
                <label htmlFor="countryCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Country Code *
                </label>
                <input
                  id="countryCode"
                  type="text"
                  value={userCountryCode}
                  onChange={(e) => setUserCountryCode(e.target.value.toUpperCase())}
                  placeholder="e.g., US, ES, GB"
                  maxLength={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-purple-200 focus:outline-none focus:ring-2 transition-colors duration-200"
                />
                <p className="mt-1 text-xs text-gray-500">Enter 2-letter country code (ISO 3166-1 alpha-2)</p>
              </div>

              {/* Connect Stripe Button */}
              <button
                onClick={handleStripeConnection}
                disabled={!isFormValid()}
                className={`w-full py-3 px-8 rounded-lg font-semibold transition-all duration-200 shadow-md transform flex items-center justify-center space-x-2 ${isFormValid()
                  ? 'bg-purple-600 hover:bg-purple-700 hover:scale-105 hover:shadow-lg text-white'
                  : 'bg-gray-400 cursor-not-allowed text-gray-200'
                  }`}
              >
                <Link className="w-5 h-5" />
                <span>Connect Stripe 💳</span>
              </button>
            </div>
          }

          {!walletResult &&

            <div className="space-y-4 w-full max-w-md">
              {/* User ID Input */}
              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                  User ID *
                </label>
                <input
                  id="userId"
                  type="email"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your user ID"
                  className={`w-full px-4 py-3 rounded-lg border transition-colors duration-200 ${!userId
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:border-purple-500 focus:ring-purple-200'
                    } focus:outline-none focus:ring-2`}
                />
              </div>
              {/* Email Input */}
              <div>
                <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  id="userEmail"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className={`w-full px-4 py-3 rounded-lg border transition-colors duration-200 ${userEmail && !isValidEmail(userEmail)
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:border-purple-500 focus:ring-purple-200'
                    } focus:outline-none focus:ring-2`}
                />
                {userEmail && !isValidEmail(userEmail) && (
                  <p className="mt-1 text-sm text-red-600">Please enter a valid email address</p>
                )}
              </div>
              <button
                onClick={handleConnectNevermined}
                disabled={isLoading}
                className={`${isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
                  } text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform`}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Conectando...
                  </>
                ) : (
                  'Connect Nevermined 🚀'
                )}
              </button>
            </div>
          }
        </div>
      )}

      {/* Success Message */}
      {message === 'success' && createdAgent ? (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 max-w-lg w-full bg-white border border-green-400 rounded-lg shadow-xl p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🎉 Agent & Plan Created Successfully!
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span className="font-medium">Agent Name:</span>
                  <span className="text-gray-900">{createdAgent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Price:</span>
                  <span className="text-gray-900">{createdAgent.price} {createdAgent.currency}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <p className="font-medium text-gray-700 mb-1">Agent ID:</p>
                  <p className="font-mono text-xs text-gray-600 break-all bg-gray-50 p-2 rounded">
                    {createdAgent.agentId}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-700 mb-1">Plan ID:</p>
                  <p className="font-mono text-xs text-gray-600 break-all bg-gray-50 p-2 rounded">
                    {createdAgent.planId}
                  </p>
                </div>
              </div>
              {createdAgent.checkoutUrl && (
                <div className="mt-4 pt-3 border-t">
                  <a
                    href={createdAgent.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Go to Checkout
                  </a>
                </div>
              )}
            </div>
            <button
              onClick={() => { setMessage(''); setCreatedAgent(null) }}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : message && message !== 'success' ? (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 max-w-md w-full p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg shadow-lg">
          {message}
        </div>
      ) : null}

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 max-w-md w-full p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}

export default App

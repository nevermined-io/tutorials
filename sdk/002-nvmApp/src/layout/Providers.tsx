import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ReactNode } from 'react'
import { createClient, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { WagmiProvider, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'


const Providers = ({
  children,
}: {
  children: ReactNode
}) => {
   const wagmiConfig = createConfig({
    chains: [arbitrumSepolia],
    connectors: [injected()],
    client({ chain }) {
      return createClient({
        chain,
        transport: http(),
      })
    },
  })
  
  const queryClient = new QueryClient()

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default Providers

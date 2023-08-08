import { arbitrumGoerli } from '@wagmi/chains'
import { configureChains } from 'wagmi'
import { sequence } from '0xsequence'

export const chainConfig = configureChains(
  [arbitrumGoerli],
  [
    (chain) => {
      const network = sequence.network.findNetworkConfig(sequence.network.allNetworks, chain.id)
      if (!network) {
        throw new Error(`Could not find network config for chain ${chain.id}`)
      }

      return { chain, rpcUrls: { http: [network.rpcUrl] } }
    }
  ]
)

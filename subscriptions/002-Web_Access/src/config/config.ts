import { AuthToken, NeverminedOptions, zeroXTransformer } from '@nevermined-io/catalog'
import { Wagmi } from '@nevermined-io/providers'
import { arbitrum, arbitrumGoerli } from 'wagmi/chains'
import { ethers } from 'ethers'

// It is needed to add this env var in order to set the correct network for each deployment
export const networkId = process.env.NEXT_PUBLIC_NETWORK_ID || '421613'

export const web3ProviderUri = process.env.NEXT_PUBLIC_WEB3_PROVIDER_URI || 'https://goerli-rollup.arbitrum.io/rpc'

export const neverminedNodeAddress = process.env.NEXT_PUBLIC_NODE_ADDRESS || '0x5838B5512cF9f12FE9f2beccB20eb47211F9B0bc'

export const neverminedNodeUri = process.env.NEXT_PUBLIC_NODE_URI || 'https://node.goerli.nevermined.app'

export const marketplaceUri = process.env.NEXT_PUBLIC_MARKETPLACE_API || 'https://marketplace-api.arbitrum.nevermined.app'

export const acceptedChainId = Number.parseInt(process.env.NEXT_PUBLIC_NETWORK_ID || '421613', 10)

export const rootUri = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`
  }

  return 'http://localhost:3000'
}


const graphHttpUri = process.env.NEXT_PUBLIC_GRAPH_HTTP_URI || ''

export const erc20TokenAddress = process.env.NEXT_PUBLIC_ERC20_TOKEN_ADDRESS || '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'

export const ipfsGatewayUri = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URI || ''

export const acceptedChainIdHex = zeroXTransformer(acceptedChainId.toString(16), true)

export const appConfig: NeverminedOptions = {
    //@ts-ignore
  web3Provider: typeof window !== 'undefined' ? window.ethereum : new ethers.providers.JsonRpcProvider(neverminedNodeUri),
  web3ProviderUri,
  neverminedNodeAddress,
  neverminedNodeUri,
  verbose: true,
  graphHttpUri,
  marketplaceAuthToken:
    typeof window === 'undefined' ? '' : AuthToken.fetchMarketplaceApiTokenFromLocalStorage().token,
  marketplaceUri,
  artifactsFolder: `${rootUri()}${process.env.NEXT_PUBLIC_ARTIFACTS_FOLDER as string}`,
  // artifactsFolder: `http://localhost:3000/contracts/`,
}

export const chainsConfig: Wagmi.Chain[] = [
  
  arbitrum,
  arbitrumGoerli,
  {
    id: 1337,
    name: "Localhost development",
    network: "spree",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      public: {
        http: ["http://localhost:8545"]
      },
      default: {
        http: ["http://localhost:8545"]
      }
    },
    testnet: true
  },
]
import { NeverminedOptions, zeroXTransformer } from '@nevermined-io/sdk'
import * as process from 'process'

export const neverminedNodeAddress = process.env.NEXT_PUBLIC_NODE_ADDRESS || ''

export const web3ProviderUri = process.env.NEXT_PUBLIC_WEB3_PROVIDER_URI || ''

export const neverminedNodeUri = process.env.NEXT_PUBLIC_NODE_URI || ''

// It is needed to add this env var in order to set the correct network for each deployment
export const networkId = process.env.NEXT_PUBLIC_NETWORK_ID || '80001'

export const acceptedChainId = Number.parseInt(process.env.NEXT_PUBLIC_NETWORK_ID || '80001', 10)


export const rootUri = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`
  }

  return 'http://127.0.0.1:3000'
}

export const marketplaceUri = process.env.NEXT_PUBLIC_MARKETPLACE_API || ''

const graphHttpUri = process.env.NEXT_PUBLIC_GRAPH_HTTP_URI || ''

export const erc20TokenAddress = process.env.NEXT_PUBLIC_ERC20_TOKEN_ADDRESS || ''

export const filecoinUploadUri = '/api/v1/node/services/upload/filecoin'

// https://ipfs.github.io/public-gateway-checker/
export const ipfsGatewayUri = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URI || ''

export const widgetUri = process.env.NEXT_PUBLIC_WIDGET_URI || ''

export const acceptedChainIdHex = zeroXTransformer(acceptedChainId.toString(16), true)

export const appConfig: NeverminedOptions = {
  web3Provider: {},
  web3ProviderUri,
  neverminedNodeAddress,
  neverminedNodeUri,
  verbose: true,
  graphHttpUri,
  marketplaceUri,
  artifactsFolder: `${rootUri()}${process.env.NEXT_PUBLIC_ARTIFACTS_FOLDER as string}`,
}

export const getWalletRoute = 'https://ethereum.org/en/wallets/find-wallet/'

export const networkBlockDurationInMs = process.env.NEXT_PUBLIC_NETWORK_BLOCK_DURATION || 2100

export const oneBackend = process.env.NEXT_PUBLIC_ONE_BACKEND || ''

export const nft1155contractFactory =
  process.env.NEXT_PUBLIC_NFT_1155_CONTRACT_FACTORY || '0xDf03575547A6CB542B87311e1Fc9914Acad8ef26'

// TODO: we need to remove this variables when proxy pass cors is set correctly
export const gcloudBucket = process.env.NEXT_PUBLIC_GCLOUD_BUCKET || 'nvm-goerli-public'
export const gcloudEndpoint =
  process.env.NEXT_PUBLIC_GCLOUD_ENDPOINT || 'https://storage.googleapis.com'
export const gcloudProxy =
  process.env.NEXT_PUBLIC_GCLOUD_PROXY || 'https://static.goerli.nevermined.one'

export const addressScanUri = process.env.NEXT_PUBLIC_SCAN_URI || ''

export const serviceIntegrationProxy = process.env.NEXT_PUBLIC_SERVICE_INTEGRATION_PROXY as string

export const marketplaceAPITokenKey = process.env.NEXT_PUBLIC_LOCAL_STORAGE_KEY as string || 'marketplaceAPIToken'

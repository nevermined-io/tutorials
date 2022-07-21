import { Config } from '@nevermined-io/nevermined-sdk-js';
import Web3 from 'web3';

export const serviceUri =
  process.env.REACT_APP_SERVICE_URI ||
  'http://localhost:3445';
export const gatewayAddress =
  process.env.REACT_APP_GATEWAY_ADDRESS || '0xB82dc620BB4dE6712376055a5cfc0DF11112D442';
export const gatewayUri =
  process.env.REACT_APP_GATEWAY_URI || 'https://gateway.mumbai.public.nevermined.rocks/';
export const faucetUri =
  process.env.REACT_APPREACT_APP_FAUCET_URI_FAUCET_URI || 'https://faucet.mumbai.public.nevermined.rocks';
export const nodeUri =
  process.env.REACT_APP_NODE_URI || 'https://bold-little-glitter.matic-testnet.discover.quiknode.pro/d6ec12761cd7d33e88d1030ed9fa55ffe68d71c1';
export const acceptedChainId = process.env.REACT_APP_ACCEPTED_CHAIN_ID || '80001'; // for Mumbai
export const rootUri = process.env.REACT_APP_ROOT_URI || 'http://localhost:3445';
export const marketplaceUri = process.env.REACT_APP_MARKETPLACE_URI || 'https://marketplace-api.mumbai.public.nevermined.rocks';

export const appConfig: Config = {
  //@ts-ignore
  web3Provider: new Web3(window.ethereum),
  nodeUri,
  gatewayUri,
  faucetUri,
  verbose: true,
  gatewayAddress,
  secretStoreUri: '',
  graphHttpUri: '',
  marketplaceAuthToken: '',
  marketplaceUri,
  artifactsFolder: `${rootUri}/contracts`
};

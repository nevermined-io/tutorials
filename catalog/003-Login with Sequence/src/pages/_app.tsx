import '../index.css'
import Login from '../login'
import { Catalog } from '@nevermined-io/catalog'
import { appConfig } from '../config'
import { chainConfig } from '../ChainConfig'
import { SequenceConnector } from '@0xsequence/wagmi-connector'
import { WagmiConfig, createConfig } from 'wagmi'
import '@0xsequence/design-system/styles.css'

const connectors = [
  new SequenceConnector({
    chains: chainConfig.chains,
    options: {
      defaultNetwork: chainConfig.chains[0].id,

      connect: {
        app: 'Demo-app'
      }
    }
  })
]

const wagmiConfig = createConfig({
  autoConnect: false,
  connectors,
  publicClient: chainConfig.publicClient,
  webSocketPublicClient: chainConfig.webSocketPublicClient
})

const App = () => (
  <Catalog.NeverminedProvider config={appConfig}>
    <WagmiConfig config={wagmiConfig}>
      <Login />
    </WagmiConfig>
  </Catalog.NeverminedProvider>
)

export default App

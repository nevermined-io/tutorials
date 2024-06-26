import { deleteMarketplaceToken, fetchMarketplaceApiTokenFromLocalStorage, setMarketplaceApiTokenOnLocalStorage } from "@/utils/marketplace-api-token"
import { NVMAppEnvironments, NvmApp } from "@nevermined-io/sdk"
import { NextPage } from "next"
import { useEffect, useState } from "react"
import {
    useAccount,
    useConnect,
    useDisconnect,
} from 'wagmi'

const MainPage: NextPage = () => {
    const { address } = useAccount()
    const account = useAccount()

    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()

    const [nvmApp, setNvmApp] = useState<NvmApp>({} as NvmApp)
    const [isNvmAppLoading, setIsNvmAppLoading] = useState(true)
    const [isConnected, setIsConnected] = useState(false)


    useEffect(() => {
        const startNvmApp = async () => {
          const app = await NvmApp.getInstance(NVMAppEnvironments.Testing)
          setNvmApp(app)
          setIsNvmAppLoading(false)
        }
        void startNvmApp()
      }, [])



    useEffect(() => {
        if(isNvmAppLoading || account.isConnecting || account.isReconnecting ) return
        if (nvmApp && account.address) {
            void (async () => {
            console.log('Connecting to NvmApp')
              try{  
                const token = fetchMarketplaceApiTokenFromLocalStorage()

                const connectionResult = token ? await nvmApp?.connect(account.address, "welcome to nevermined", { ...nvmApp?.config, marketplaceAuthToken: token }) : await nvmApp?.connect(account.address, "welcome to nevermined")
                setMarketplaceApiTokenOnLocalStorage({ token: connectionResult.marketplaceAuthToken })
                console.log(connectionResult)
                console.log(nvmApp.isWeb3Connected())
                setIsConnected(nvmApp.isWeb3Connected())
              }
              catch(e){
                    console.log(e)
                }
            })()
        }
    }, [isNvmAppLoading, account.status])

    const fullDisconnect = async () => {
        if (nvmApp) {
            disconnect()
            await nvmApp.disconnect()
            deleteMarketplaceToken()
            setIsConnected(nvmApp.isWeb3Connected())
        }
    }


    if (isNvmAppLoading) return <div>Loading...</div>;

    return (
        <>
            <header>
                <h1>Nvm App</h1>
                {isConnected ? (
                    <div>
                        Connected to {address}
                        <button onClick={() => fullDisconnect()}>Disconnect</button>
                    </div>
                ) : (
                    <button onClick={() => connect({connector : connectors[0]})}>Connect Wallet</button>
                )}
            </header>
            <main>
                {nvmApp?.isWeb3Connected() ? 'Connected to NvmApp' : 'Not connected to NvmApp'}
            </main>
        </>
    )
  }
  
  export default MainPage
import { deleteMarketplaceToken, fetchMarketplaceApiTokenFromLocalStorage, setMarketplaceApiTokenOnLocalStorage } from "@/utils/marketplace-api-token"
import { DDO, NVMAppEnvironments, NvmApp } from "@nevermined-io/sdk"
import { NextPage } from "next"
import { useEffect, useState } from "react"
import {
    useAccount,
    useConnect,
    useDisconnect,
} from 'wagmi'
import { assetTypeFilter, isListedFilter } from "./queries"

const MainPage: NextPage = () => {
    const { address } = useAccount()
    const account = useAccount()

    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()

    const [nvmApp, setNvmApp] = useState<NvmApp>({} as NvmApp)
    const [isNvmAppLoading, setIsNvmAppLoading] = useState(true)
    const [isConnected, setIsConnected] = useState(false)
    const [assets, setAssets] = useState<DDO[]>()
    const [plans, setPlans] = useState<DDO[]>()

    const [menu, setMenu] = useState(1)


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

    // Filter assets
    useEffect(() => {
        if(nvmApp.search){
        const mustArray: unknown[] = [isListedFilter()]
        mustArray.push(assetTypeFilter('asset'))
        nvmApp.search.query({
            query: {
                bool: {
                    must: mustArray,
                  },
            },
            sort: {
                created: 'desc',
            }
        }).then((assets) => {
            console.log('assets', assets) 
            setAssets(assets.results.map((asset) => asset))
        })
    }
    }, [nvmApp.search])

    useEffect(() => {
        if(nvmApp.search){
        const mustArray: unknown[] = [isListedFilter()]
        mustArray.push(assetTypeFilter('subscription'))
        nvmApp.search.query({
            query: {
                bool: {
                    must: mustArray,
                  },
            },
            sort: {
                created: 'desc',
            }
        }).then((assets) => {
            console.log('assets', assets) 
            setPlans(assets.results.map((asset) => asset))
        })
    }
    }, [nvmApp.search])



    if (isNvmAppLoading) return <div>Loading...</div>;

    return (
        <>
            <header>
                <h1>Nvm App</h1>
                {isConnected  ? (
                    <div>
                        Connected to {address}
                        <button onClick={() => fullDisconnect()}>Disconnect</button>
                    </div>
                ) : (
                    <button onClick={() => connect({connector : connectors[0]})}>Connect Wallet</button>
                )}
                <button onClick={() => setMenu(1)}>Assets</button>
                <button onClick={() => setMenu(2)}>Publish Plan</button>
                <button onClick={() => setMenu(3)}>Subscriptions</button>
            </header>
            <main>
                {menu === 1 &&
                <>
                Latest 10 assets registered: 
                <table><tr><th>Did</th><th>Name</th><th>Date created</th></tr> 
                {
                  assets?.map((asset) => <tr><td key={asset.id}>{asset.id}</td><td>{asset.findServiceByType('metadata').attributes.main.name}</td><td>{asset.findServiceByType('metadata').attributes.main.dateCreated}</td></tr>)  
                }
                </table>


                </>
                }
                {menu === 2 &&
                <>
                <h2>Publish Plan</h2>
                <form>
                <label htmlFor="name">Name:</label>
                <input type="text" id="name" name="name" />
                <label htmlFor="description">Description:</label>
                <input type="text" id="description" name="description" />
                <label htmlFor="price">Price:</label>
                <input type="number" id="price" name="price" />
                <label htmlFor="tokenAddress">Token Address:</label>
                <input type="text" id="tokenAddress" name="tokenAddress" />
                <label htmlFor="amountOfCredits">Amount of Credits:</label>
                <input type="number" id="amountOfCredits" name="amountOfCredits" />

                {/* <button disabled={!isConnected} onClick={() => nvmApp.createCreditsSubscription()}>Publish Plan</button> */}
                </form>
                </>
                }
                {menu === 3 &&
                <>
                                Latest 10 subscriptions: 
                                <table><tr><th>Did</th><th>Name</th><th>Date created</th><th>Order</th></tr> 
                                {
                                  plans?.map((asset) => 
                                  <tr>
                                    <td key={asset.id}>{asset.id}</td>
                                    <td>{asset.findServiceByType('metadata').attributes.main.name}</td>
                                    <td>{asset.findServiceByType('metadata').attributes.main.dateCreated}</td>
                                    <td><button disabled={!isConnected} onClick={() => nvmApp.orderSubscription(asset.id, asset.findServiceByType('nft-sales').attributes.main.nftAttributes?.amount || 0n)}>Order</button></td>
                                 </tr>)  
                                }
                                </table> 
                </>
                
                }
                
            </main>
        </>
    )
  }
  
  export default MainPage
import { deleteMarketplaceToken, fetchMarketplaceApiTokenFromLocalStorage, setMarketplaceApiTokenOnLocalStorage } from "@/utils/marketplace-api-token"
import { AssetPrice, CreateProgressStep, DDO, MetaData, NETWORK_FEE_DENOMINATOR, NVMAppEnvironments, NvmApp, SubscribablePromise } from "@nevermined-io/sdk"
import { NextPage } from "next"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    useAccount,
    useConnect,
    useDisconnect,
} from 'wagmi'
import { assetTypeFilter, isListedFilter } from "../utils/queries"

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
    const publishingProgressEvent = useRef<(step: CreateProgressStep) => void>()


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

                const connectionResult = token ? await nvmApp?.connect(account.address, "Welcome to nevermined", { ...nvmApp?.config, marketplaceAuthToken: token }) : await nvmApp?.connect(account.address, "Welcome to nevermined")
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
            setAssets(assets.results.map((asset) => asset))
        })
    }
    }, [nvmApp.search, menu])

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
            setPlans(assets.results.map((asset) => asset))
        })
    }
    }, [nvmApp.search, menu])


    const executeWithProgressEvent = async <T,>(
        subscribableAction: () => SubscribablePromise<any, T>,
        onEvent?: (next: any) => void,
      ) => {
        let subscription: { unsubscribe: () => boolean } | undefined
      
        try {
          const subscribablePromise = subscribableAction()
          subscription = onEvent ? subscribablePromise.subscribe(onEvent) : undefined
          return await subscribablePromise
        } finally {
          subscription?.unsubscribe()
        }
      }

    const [asset, setAsset] = useState<any>()
    const [isPublishing, setIsPublishing] = useState(false)

    const createSubscription = useCallback( async () => {
        if (!address) return
        try {
        const assetRewardsMap = new Map([[address, BigInt(asset.price)]])
        const feeReceiver = await nvmApp.sdk.keeper.nvmConfig.getFeeReceiver()
        const assetPrice = new AssetPrice(assetRewardsMap).adjustToIncludeNetworkFees(
          feeReceiver,
          NETWORK_FEE_DENOMINATOR,
        )
        // Assuming token address USDC on sepolia
        assetPrice.setTokenAddress('0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d')
  
        const metadata = {
            main: {
                name: asset.name,
                dateCreated: new Date().toISOString().replace(/\.\d{3}/, ''),
                datePublished: new Date().toISOString().replace(/\.\d{3}/, ''),
                author: address,
                license: 'No License Specified',
                type: 'subscription',

            },
            additionalInformation: {
                description: asset.description,
                customData: {
                    subscriptionLimitType: 'credits',
                }
            }
        } as MetaData

        setIsPublishing(true)
        await executeWithProgressEvent(
            () => nvmApp.createCreditsSubscription(metadata, assetPrice, asset.credits),
            publishingProgressEvent.current,
          )
        setIsPublishing(false)
        
        }
        catch(e){
            console.log(e)
        }
    }
    ,[asset, address, nvmApp])




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
                  assets?.map((asset) => <tr key={asset.id}><td>{asset.id}</td><td>{asset.findServiceByType('metadata').attributes.main.name}</td><td>{asset.findServiceByType('metadata').attributes.main.dateCreated}</td></tr>)  
                }
                </table>


                </>
                }
                {menu === 2 &&
                <>
                <h2>Publish Plan</h2>
                {/* <form> */}
                <label htmlFor="name">Name:</label>
                <input type="text" id="name" name="name" required onChange={(e) => setAsset({...asset, name: e.target.value})}/>
                <label htmlFor="description">Description:</label>
                <input type="text" id="description" name="description" required onChange={(e) => setAsset({...asset, description: e.target.value})} />
                <label htmlFor="price">Price:</label>
                <input type="number" id="price" name="price" required onChange={(e) => setAsset({...asset, price: e.target.value})}/>
                {/* <label htmlFor="tokenAddress">Token Address:</label>
                <input type="text" id="tokenAddress" name="tokenAddress" /> */}
                <label htmlFor="amountOfCredits">Amount of Credits:</label>
                <input type="number" id="amountOfCredits" name="amountOfCredits"  required onChange={(e) => setAsset({...asset, credits: e.target.value})}/>

                <button disabled={!isConnected || !asset || !asset.name || !asset.price || !asset.credits || !asset.description || isPublishing} onClick={() => createSubscription()}>Publish Plan</button>
                {isPublishing && <p>Publishing...</p>}
                {/* </form> */}
                </>
                }
                {menu === 3 &&
                <>
                                Latest 10 subscriptions: 
                                <table>
                                    <tr>
                                        <th>Did</th>
                                        <th>Name</th>
                                        <th>Date created</th>
                                        <th>Price</th>
                                        <th>Credits</th>
                                        <th>Order</th>
                                    </tr> 
                                {
                                  plans?.map((asset) => 
                                  <tr key={asset.id}>
                                    <td>{asset.id}</td>
                                    <td>{asset.findServiceByType('metadata').attributes.main.name}</td>
                                    <td>{asset.findServiceByType('metadata').attributes.main.dateCreated}</td>
                                    {/* <td>{asset.findServiceByType('nft-sales').attributes.main.price}</td> */}
                                    {/* Converted price */}
                                    <td>{asset.findServiceByType('nft-sales').attributes.additionalInformation.priceHighestDenomination}</td>
                                    <td>{asset.findServiceByType('nft-sales').attributes.main.nftAttributes?.amount?.toString() || 0}</td>
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
import { deleteMarketplaceToken, fetchMarketplaceApiTokenFromLocalStorage, setMarketplaceApiTokenOnLocalStorage } from "@/utils/marketplace-api-token"
import { assetTypeFilter, isListedFilter } from "@/utils/queries"
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import { ButtonGroup, Grid, Stack, TextField } from "@mui/material"
import Box from '@mui/material/Box'
import Button from "@mui/material/Button"
import Paper from "@mui/material/Paper"
import Tab from '@mui/material/Tab'
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import { AssetPrice, CreateProgressStep, DDO, MetaData, NETWORK_FEE_DENOMINATOR, NVMAppEnvironments, NvmApp, SubscribablePromise } from "@nevermined-io/sdk"
import { NextPage } from "next"
import { useCallback, useEffect, useRef, useState } from "react"
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
    const [assets, setAssets] = useState<DDO[]>()
    const [plans, setPlans] = useState<DDO[]>()

    const [value, setValue] = useState('1')

    const handleChange = (event: React.SyntheticEvent, newValue: string) => {
      setValue(newValue)
    }
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
    }, [nvmApp.search, value])

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
    }, [nvmApp.search, value])


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
                <Grid container 
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                <Grid item>
                     <h2>Nvm App </h2>               
                </Grid>
                <Grid item>
                {isConnected  ? (
                    <div>
                        <ButtonGroup variant="outlined">
                            <Button variant="outlined">{address}</Button>
                            <Button variant="contained" onClick={() => fullDisconnect()}>Disconnect</Button>
                        </ButtonGroup>
                    </div>
                ) : (
                    <Button variant="contained" onClick={() => connect({connector : connectors[0]})}>Connect Wallet</Button>
                )}
                </Grid>
                </Grid>

            </header>
            <main>
                <Box sx={{ borderColor: 'divider' }}>
                    <TabContext value={value}>
                        <TabList onChange={handleChange} aria-label="lab API tabs example">
                                <Tab label='Assets' value="1"/>
                                <Tab label='Publish Plan' value="2"/>
                                <Tab label='Subscriptions' value="3"/>
                        </TabList>
                            <TabPanel value="1">
                                <h2>Latest 10 assets registered</h2>
                                <TableContainer component={Paper}>
                                    <Table sx={{ minWidth: 650 }} aria-label="simple table">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell variant="head">Did</TableCell>
                                                <TableCell variant="head">Name</TableCell>
                                                <TableCell variant="head" >Date created</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                        {assets?.map((asset) => 
                                            <TableRow hover key={asset.id}>
                                                <TableCell variant="body">{asset.id}</TableCell>
                                                <TableCell variant="body">{asset.findServiceByType('metadata').attributes.main.name}</TableCell>
                                                <TableCell variant="body">{asset.findServiceByType('metadata').attributes.main.dateCreated}</TableCell>
                                            </TableRow>)  
                                        }
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </TabPanel>
                            <TabPanel value="2">
                <h2>Publish Plan</h2>
                    <Stack spacing={{ sm: 2 }} direction="column">
                        <TextField type="text" label="Name" required onChange={(e) => setAsset({...asset, name: e.target.value})}/>
                        <TextField type="text" label="Description" required onChange={(e) => setAsset({...asset, description: e.target.value})}/>
                        <TextField type="number" label="Price" required onChange={(e) => setAsset({...asset, price: e.target.value})}/>
                        <TextField type="number" label="Amount of Credits" required onChange={(e) => setAsset({...asset, credits: e.target.value})}/>
                        <Button disabled={!isConnected || !asset || !asset.name || !asset.price || !asset.credits || !asset.description || isPublishing} onClick={() => createSubscription()}>Publish Plan</Button>
                    </Stack>
                {isPublishing && <p>Publishing...</p>}
                </TabPanel>
                <TabPanel value="3">
                                <h2>Latest 10 subscriptions</h2>
                             <TableContainer component={Paper}>
                                    <Table sx={{ minWidth: 650 }} aria-label="simple table">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell variant="head">Did</TableCell>
                                                <TableCell variant="head">Name</TableCell>
                                                <TableCell variant="head" >Date created</TableCell>
                                                <TableCell variant="head" >Price</TableCell>
                                                <TableCell variant="head" >Credits</TableCell>
                                                <TableCell variant="head" >Order</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                        {plans?.map((plan) => 
                                            <TableRow hover key={plan.id}>
                                                <TableCell variant="body">{plan.id}</TableCell>
                                                <TableCell variant="body">{plan.findServiceByType('metadata').attributes.main.name}</TableCell>
                                                <TableCell variant="body">{plan.findServiceByType('metadata').attributes.main.dateCreated}</TableCell>
                                                <TableCell variant="body">{plan.findServiceByType('nft-sales')?.attributes.additionalInformation.priceHighestDenomination }</TableCell>
                                                <TableCell variant="body">{plan.findServiceByType('nft-sales').attributes.main.nftAttributes?.amount?.toString() || 0}</TableCell>
                                                <TableCell variant="body"><Button disabled={!isConnected} onClick={() => nvmApp.orderSubscription(plan.id, plan.findServiceByType('nft-sales').attributes.main.nftAttributes?.amount || 0n)}>Order</Button></TableCell>
                                            </TableRow>)  
                                        }
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                        </TabPanel>
                    </TabContext>
                </Box>
            </main>
        </>
    )
  }
  
  export default MainPage
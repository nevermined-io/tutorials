import { acceptedChainId, appConfig } from '@/config/config'
import { Catalog } from '@nevermined-io/catalog'
import { useWallet } from '@nevermined-io/providers'


// This component is used to display the navbar and integrate the connection with your Metamask wallet.
export const NavBar = () => {

    const { isLoadingSDK } = Catalog.useNevermined()
    const { login, logout, walletAddress, getConnectors } = useWallet()
    
    // const web3 = new Web3(window.ethereum)
    appConfig.web3Provider = window.ethereum!


    return (
        <div className="navbar">
          <ul className="navbar-list">
            <li className="nav-li">
              <a className="nav-link" href="/">
                Home
              </a>
            </li>
            <li className="nav-li">
              <a className="nav-link" href="/publish">
                New
              </a>
            </li>
            <li className=" nav-right">
              <div className="nav-item">
                {!walletAddress ? (
                  <button onClick={() => login(getConnectors()[0])}>Login</button>
                ) : (
                  <button onClick={logout}>logout</button>
                )}
              </div>
            </li>
            {walletAddress ? (
              <>
                <li className="nav-right">
                  <text className="nav-item">
                    Chain Id: {acceptedChainId}
                  </text>
                </li>
                <li className="nav-right">
                  <a href={`/user/${walletAddress}`}>
                    <text className="nav-item">
                      {`${walletAddress.substr(0, 6)}...${walletAddress.substr(-4)}`}
                    </text>{' '}
                  </a>
                </li>                
              </>
            ) : (
              <></>
            )}
            <li className="nav-right">
              <text className="nav-item">
                <div>
                  {!isLoadingSDK ? (
                    <span className="logged-in"> ●</span>
                  ) : (
                    <span className="logged-out"> ●</span>
                  )}
                </div>
              </text>
            </li>
          </ul>
        </div>
      )
}
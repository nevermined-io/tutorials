'use client'

import React from 'react'
import { useAccount, useConnect, useWalletClient } from 'wagmi'
import { Box } from '@0xsequence/design-system'

const Login = () => {
  const { connect, connectors } = useConnect()
  const { isConnected } = useAccount()
  const { data } = useWalletClient()

  return (
    <div className="App">
      <header className="App-header">
        {isConnected ? (
          <>
            <div className="nav-item">{data?.getAddresses()}</div>
          </>
        ) : (
          <Box as="button" onClick={() => connect({ connector: connectors[0] })}>
            Connect
          </Box>
        )}
      </header>
    </div>
  )
}

export default Login

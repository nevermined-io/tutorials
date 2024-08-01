"use client";

import { Payments } from "@nevermined-io/payments";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const nvmRef = useRef(
    new Payments({ returnUrl: "http://localhost:8080", environment: "appStaging", appId: "test", version: "v1"})
  )
  
  const [payments, setPayments] = useState<Payments>(nvmRef.current)
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean>(false)
  const [subscriptionDid, setSubscriptionDid] = useState<string>("")
  const [serviceDid, setServiceDid] = useState<string>("")
  const [fileDid, setFileDid] = useState<string>("")

  const onLogin = () => {
    nvmRef.current.connect()
  }

  const onLogout = () => {
    nvmRef.current.logout()
    setPayments(nvmRef.current)
    setIsUserLoggedIn(payments.isLoggedIn)
  }

  useEffect(() => {
    nvmRef.current.init()
    setPayments(nvmRef.current)
  }, [])

  useEffect(() => {
    if (payments.isLoggedIn) {
      setIsUserLoggedIn(true)
    }
  }, [payments.isLoggedIn])


  async function createTimeSubscription() {
    if (payments.isLoggedIn) {
      console.log("creating subscription");
      const result = await payments.createTimeSubscription({
        name: "test subscription",
        description: "test",
        price: 10000000n,
        tokenAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        duration: 30,
        tags: ["test"]
      }
      )
      setSubscriptionDid(result.did)
      console.log(result)
    }
  }

  async function createService() {
    if (payments.isLoggedIn) {
      console.log("creating webservice");
      const result = await payments.createService({
        subscriptionDid: "did:nv:60a3b9f9854c711fbb077e7266d2bf3794051600db4ce4ec9a38eb6cfd321460", 
        name: "test webservice",
        description: "test",
        serviceChargeType: "fixed",
        authType: "none",
        amountOfCredits: 0,
        endpoints: [{ post: "https://chatgpt-plugin.nevermined.app/ask" }],
        openEndpoints: ["https://chatgpt-plugin.nevermined.app/openapi.json"],
        openApiUrl: "https://chatgpt-plugin.nevermined.app/openapi.json",
        tags: ["test"]
      })
      setServiceDid(result.did)
      console.log(result);
    }
  }

  async function createFile() {
    if (payments.isLoggedIn) {
      console.log("creating dataset");
      const result = await payments.createFile({
        subscriptionDid: "did:nv:60a3b9f9854c711fbb077e7266d2bf3794051600db4ce4ec9a38eb6cfd321460", 
        name: "test dataset",
        description: "test",
        amountOfCredits: 0,
        tags: ["test"], 
        assetType: 'model',
        files: [
          {
            index: 0,
            contentType: "text/markdown",
            url: "https://raw.githubusercontent.com/nevermined-io/tutorials/main/README.md",
          }]
      })
      setFileDid(result.did)
      console.log(result);
    }
  }

  async function getServiceToken(did: string) {
    if (payments.isLoggedIn) {
      console.log("getting service token");
      const result = await payments.getServiceToken(did)
      console.log(result)
    }
  }

  async function getDDO(did: string) {
    if (payments.isLoggedIn) {
      console.log("getting ddo");
      const result = await payments.getAssetDDO(did)
      console.log(result)
    }
  }

  async function getBalance(did: string) {
    if (payments.isLoggedIn) {
      console.log("getting balance");
      const result = await payments.getSubscriptionBalance(did, '0xA3222ba5a382ccEECdA8984ffcc0d1c9fE9Af783')
      console.log(result)
    }
  }

  // TODO: uncomment when the methods are available
  async function orderSubscription(did: string) {
    if (payments.isLoggedIn) {
      console.log("ordering subscription");
      const result = await payments.orderSubscription(did)
      console.log(result)
    }
  }

  // async function downloadFile(did: string) {
  //   if (payments.isLoggedIn) {
  //     console.log("downloading file");
  //     const result = await payments.downloadFiles(did)
  //     console.log(result)
  //   }
  // }

  const onSubscritionGoToDetails = (did: string) => {
    payments.getSubscriptionDetails(did)
  }

  const onServiceGoToDetails = (did: string) => {
    payments.getServiceDetails(did)
  }

  const onFileGoToDetails = (did: string) => {
    payments.getFileDetails(did)
  }


  return (
    <main>
      <div>
        {JSON.stringify(payments)}
        {!isUserLoggedIn && <button onClick={onLogin}>{"Log in"}</button>}
        {isUserLoggedIn && <button onClick={onLogout}>{"Log out"}</button>}

        <div>
          <button disabled={!isUserLoggedIn} onClick={createTimeSubscription}>Create Time Subscription</button>
          <button disabled={!isUserLoggedIn} onClick={createService}>Create Webservice</button>
          <button disabled={!isUserLoggedIn} onClick={createFile}>Create Dataset</button>
          <button disabled={!isUserLoggedIn} onClick={() => getDDO('did:nv:60a3b9f9854c711fbb077e7266d2bf3794051600db4ce4ec9a38eb6cfd321460')}>GET DDO</button>
          <button disabled={!isUserLoggedIn} onClick={() => getBalance('did:nv:60a3b9f9854c711fbb077e7266d2bf3794051600db4ce4ec9a38eb6cfd321460')}>GET Balance</button>
          <button disabled={!isUserLoggedIn} onClick={() => orderSubscription('did:nv:debe46f1c0f3e36c853a9f093717c46eaa94df9b302731b9d06e7e07e5fd0c8b')}>Order</button>
        {/*  
          <button disabled={!isUserLoggedIn} onClick={() => downloadFile('did:nv:d65e2726b37510d231a86183d0de5d9281830381b579315c64e1eea7ee3e416f')}>Download file</button>  
        */}
        </div>
        {isUserLoggedIn && serviceDid &&  <button disabled={!isUserLoggedIn} onClick={() => getServiceToken(serviceDid)}>Get Service Token</button>}
        {isUserLoggedIn && <div>User is logged in with app ID {payments.appId} and version {payments.version}</div>}
        {isUserLoggedIn && subscriptionDid && <div>Subscription DID: <button onClick={() => onSubscritionGoToDetails(subscriptionDid)}>{subscriptionDid}</button> </div>}
        {isUserLoggedIn && serviceDid && <div>Service DID: <button onClick={() => onServiceGoToDetails(serviceDid)}>{serviceDid}</button> </div>}
        {isUserLoggedIn && fileDid && <div>File DID: <button onClick={() => onFileGoToDetails(fileDid)}>{fileDid}</button> </div>}
      </div>
    </main>
  )
}

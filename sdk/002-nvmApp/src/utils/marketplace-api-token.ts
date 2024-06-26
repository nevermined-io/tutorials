import { marketplaceAPITokenKey } from '@/config'
import { Nevermined, Logger, NvmAccount } from '@nevermined-io/sdk'
import { decodeJwt } from 'jose'

/**
 * Get Marketplace API token to local storage
 *
 *
 * @return Auth token object which generated from Marketplace API
 */
export const fetchMarketplaceApiTokenFromLocalStorage = () => {
  if (!window?.localStorage) {
    Logger.warn('Fetching Marketplace Api token: Window object is not ready or missing')
    return ''
  }

  return localStorage.getItem(`${marketplaceAPITokenKey}`)
}

export const setMarketplaceApiTokenOnLocalStorage = ({
  token,
}: {
  token: string
}) => {
  if (!window?.localStorage) {
    Logger.warn('Set Marketplace Api token: Window object is not ready or missing')
    return ''
  }

  return localStorage.setItem(`${marketplaceAPITokenKey}`, token)
}

export const deleteMarketplaceToken = () => {
  try {
    const keysToRemove = Object.keys(localStorage).filter((key) =>
      key.endsWith(marketplaceAPITokenKey),
    )

    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch (error: any) {
    Logger.error('Error deleting marketplaceToken', error as string)
  }
}

/**
 * Generate new Marketplace API token
 *
 * @param address account address of the wallet
 * @param chainId the network id
 * @param message Optional message to be included. Usually to be displayed in metamask
 * @param sdk Instance of SDK object
 *
 * @return Auth token object which generated from Marketplace API
 */
export const newMarketplaceApiToken = async ({
  neverminedAccount,
  message,
  sdk,
}: {
  neverminedAccount: NvmAccount
  message?: string
  sdk: Nevermined
}) => {
  if (!window?.localStorage) {
    Logger.warn('Setting Marketplace Api token: Window object is not ready or it is missed')
    return false
  }

  try {
    const credential = await sdk.utils.jwt.generateClientAssertion(neverminedAccount, message)
    const token = await sdk.services.marketplace.login(credential)

    setMarketplaceApiTokenOnLocalStorage({ token })
    // eslint-disable-next-line consistent-return
    return true
  } catch (error: any) {
    Logger.error(error as string)
    return false
  }
}

/**
 * @param address account address of the wallet
 * @param chainId the network Id
 * Check if Marketplace API Token is valid
 * @return Return `true` if token is valid
 */
export const isTokenValid = () => {
  const token = fetchMarketplaceApiTokenFromLocalStorage()

  if (token) {
    const decodedToken = decodeJwt(token)

    if (!decodedToken) {
      return false
    }

    const expiry = decodedToken.exp
    if (expiry) {
      const now = new Date()
      return now.getTime() < Number(expiry) * 1000
    }
  }

  return false
}

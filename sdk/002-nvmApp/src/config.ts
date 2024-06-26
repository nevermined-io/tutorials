import * as process from 'process'

export const marketplaceAPITokenKey = process.env.NEXT_PUBLIC_LOCAL_STORAGE_KEY as string || 'marketplaceAPIToken'

/**
 * Offline guards. No network, no credentials, no rows written.
 *
 * Run it before a demo, or in CI: it proves the door that keeps this tutorial
 * off live money is still shut, and that the API base is still derived from the
 * key rather than guessed.
 */
import { apiBaseFor, assertNotLive, assertNotLiveApi, payerOf } from './lib/config.mjs'

let failures = 0
const check = (label, fn) => {
  try {
    fn()
    console.log(`ok    ${label}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${label}: ${error.message}`)
  }
}
const refuses = (label, fn) => {
  let threw = false
  try {
    fn()
  } catch {
    threw = true
  }
  if (threw) console.log(`ok    ${label}`)
  else {
    failures += 1
    console.log(`FAIL  ${label}: nothing was thrown`)
  }
}

refuses('a live key is refused', () => assertNotLive('subscriber', 'live:abc.def.ghi'))
refuses('a live-staging key is refused', () =>
  assertNotLive('subscriber', 'live-staging:abc.def.ghi'),
)
check('a sandbox key is accepted', () => assertNotLive('subscriber', 'sandbox:abc.def.ghi'))
check('a sandbox-staging key is accepted', () =>
  assertNotLive('subscriber', 'sandbox-staging:abc.def.ghi'),
)

refuses('a live API base is refused', () => assertNotLiveApi('https://api.live.nevermined.app'))
refuses('a staging live API base is refused', () =>
  assertNotLiveApi('https://api.live.nevermined.dev'),
)
check('the sandbox API base is accepted', () =>
  assertNotLiveApi('https://api.sandbox.nevermined.app'),
)

check('apiBaseFor derives the sandbox API from the key prefix', () => {
  const got = apiBaseFor('sandbox:abc.def.ghi')
  if (got !== 'https://api.sandbox.nevermined.app') throw new Error(`got "${got}"`)
})
check('apiBaseFor derives the staging sandbox API from the key prefix', () => {
  const got = apiBaseFor('sandbox-staging:abc.def.ghi')
  if (got !== 'https://api.sandbox.nevermined.dev') throw new Error(`got "${got}"`)
})
check('apiBaseFor returns "" for an unknown prefix rather than a wrong host', () => {
  if (apiBaseFor('nvm:abc.def.ghi') !== '') throw new Error('expected an empty string')
})

check('payerOf reads `from` out of an access token', () => {
  const token = Buffer.from(
    JSON.stringify({
      payload: { authorization: { from: '0x232589dA7dfD0B1b64408f93fcf6967717041225' } },
    }),
  ).toString('base64url')
  const got = payerOf(`${token}#some-delegation-id`)
  if (got !== '0x232589dA7dfD0B1b64408f93fcf6967717041225') throw new Error(`got "${got}"`)
})
check('payerOf returns "" rather than throwing on garbage', () => {
  if (payerOf('not-a-token') !== '') throw new Error('expected an empty string')
})

console.log(failures === 0 ? '\nselfcheck PASSED' : `\nselfcheck FAILED (${failures})`)
process.exit(failures === 0 ? 0 : 1)

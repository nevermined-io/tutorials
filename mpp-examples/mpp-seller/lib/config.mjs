/**
 * Shared configuration + safety guards for the MPP seller tutorial.
 *
 * Two accounts are needed: a BUILDER (publishes the plan and the agent) and a
 * SUBSCRIBER (buys the plan and calls the agent). Their API keys come from `.env`
 * — or, if you prefer to keep secrets out of the project directory entirely, from
 * a JSON file (`~/.nvm-mpp-demo.json` by default, override with `DEMO_FILE`).
 * Environment variables win over the file.
 */
import 'dotenv/config'
import { Environments, getEnvironmentFromApiKey } from '@nevermined-io/payments'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(dirname(fileURLToPath(import.meta.url)))
const DEFAULT_CREDENTIALS_FILE = join(homedir(), '.nvm-mpp-demo.json')
export const STATE_FILE = join(HERE, '.demo-state.json')

/**
 * The API this key targets, derived from its own prefix — `sandbox:` and
 * `live:` name the deployment as well as the network tier, so nothing needs to
 * be configured by hand. Returns `''` for an unrecognised prefix.
 */
export function apiBaseFor(apiKey) {
  const environment = getEnvironmentFromApiKey(apiKey)
  return environment ? Environments[environment].backend.replace(/\/$/, '') : ''
}

/**
 * Refuses a live-money API key, whatever the deployment.
 *
 * This tutorial publishes real rows and creates a real spend mandate. On
 * `sandbox` that costs nothing; on `live` it is real money.
 */
export function assertNotLive(label, apiKey) {
  const prefix = apiKey.includes(':') ? apiKey.slice(0, apiKey.indexOf(':')).toLowerCase() : ''
  if (prefix.startsWith('live')) {
    throw new Error(`refusing to use a live API key for the ${label} (prefix "${prefix}")`)
  }
}

/**
 * Refuses a live API base.
 *
 * Separate from the key check on purpose: `NVM_API_BASE` overrides the base the
 * key would have chosen, so a sandbox key pointed at a live host would slip past
 * a key-prefix check alone.
 */
export function assertNotLiveApi(apiBase) {
  const host = new URL(apiBase).host
  if (host.startsWith('api.live.')) {
    throw new Error(`refusing to run against a live API (${host}). This tutorial spends credits.`)
  }
}

export function loadConfig({ requireSubscriber = true, requireBuilder = true } = {}) {
  const file = process.env.DEMO_FILE || DEFAULT_CREDENTIALS_FILE
  let fromFile = {}
  try {
    fromFile = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`cannot read ${file}: ${error.message}`)
  }

  const cfg = {
    builderApiKey: process.env.BUILDER_NVM_API_KEY || fromFile.builderApiKey,
    subscriberApiKey: process.env.SUBSCRIBER_NVM_API_KEY || fromFile.subscriberApiKey,
    port: Number(process.env.PORT || 8790),
    credits: Number(process.env.CREDITS || 1),
    creditsGranted: Number(process.env.CREDITS_GRANTED || 20),
    delegationLimitCents: Number(process.env.DELEGATION_LIMIT_CENTS || 5000),
    delegationDurationSecs: Number(process.env.DELEGATION_DURATION_SECS || 3600),
    credentialsFile: file,
  }
  cfg.agentUrl = process.env.AGENT_URL || `http://localhost:${cfg.port}/ask`

  if (requireBuilder) {
    if (!cfg.builderApiKey) throw new Error('no BUILDER_NVM_API_KEY (see .env.example)')
    assertNotLive('builder', cfg.builderApiKey)
  }
  if (requireSubscriber) {
    if (!cfg.subscriberApiKey) throw new Error('no SUBSCRIBER_NVM_API_KEY (see .env.example)')
    assertNotLive('subscriber', cfg.subscriberApiKey)
  }
  if (
    requireBuilder &&
    requireSubscriber &&
    cfg.builderApiKey === cfg.subscriberApiKey &&
    process.env.ALLOW_SAME_ACCOUNT !== 'yes'
  ) {
    throw new Error(
      'the builder and subscriber keys are identical — this tutorial needs two accounts',
    )
  }

  const derived = apiBaseFor(cfg.builderApiKey || cfg.subscriberApiKey)
  cfg.apiBase = process.env.NVM_API_BASE || fromFile.apiBase || derived
  if (!cfg.apiBase) {
    throw new Error('cannot derive the API base from the key prefix — set NVM_API_BASE')
  }
  assertNotLiveApi(cfg.apiBase)
  return cfg
}

/** The `sub` claim of an API key: the account it acts as. */
export function accountOf(apiKey) {
  const jwt = apiKey.includes(':') ? apiKey.slice(apiKey.indexOf(':') + 1) : apiKey
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
  return payload.sub
}

export function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export function writeState(state) {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
}

/**
 * The address an access token spends FROM — its `from`.
 *
 * This is NOT the account address in the API key's `sub`: it is the SPEND
 * account, the wallet that signs the payment authorisation. Credits are held
 * and burned against the account address, so a balance read for this one
 * normally reports zero and never moves.
 *
 * The token is base64 JSON whose signed message nests `from` under
 * `payload.authorization`; matched by pattern rather than by path so a change in
 * nesting does not silently return `undefined`.
 */
export function payerOf(accessToken) {
  try {
    const decoded = Buffer.from(String(accessToken).split('#')[0], 'base64url').toString('utf8')
    return JSON.stringify(JSON.parse(decoded)).match(/"from":"(0x[0-9a-fA-F]{40})"/)?.[1] ?? ''
  } catch {
    return ''
  }
}

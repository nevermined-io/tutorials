# Transcript — a real run

A real, unedited run on 2026-09-04, with two different accounts:

| Role    | Account                                                                       |
| ------- | ----------------------------------------------------------------------------- |
| builder | `0x965cD93B409925561097D2a4DEdb41201d4ABd83`                                  |
| buyer   | `0x4D32d8309834D064320e94F397A9CCa4524642E4`                                  |
| payer   | `0x232589dA7dfD0B1b64408f93fcf6967717041225` (the buyer's spend account)      |

Two disclosures, so you can reproduce it exactly:

- It ran against Nevermined's **staging** sandbox (`api.sandbox.nevermined.dev`) rather
  than `api.sandbox.nevermined.app`, because that is where these two demo accounts live.
  Nothing else differs — the base is derived from the key prefix either way.
- One line was removed: a `[DEPRECATED] The 'environment' option is deprecated` warning
  the SDK prints against itself (`@nevermined-io/payments@1.11.2`).

Note the plan and the agent already existed, so `provision.mjs` reused them instead of
publishing a fresh pair. The buyer's balance is high (148) because earlier runs each
ordered the plan again; a first run starts at 20.

```console
$ ./demo.sh --selfcheck
ok    a live key is refused
ok    a live-staging key is refused
ok    a sandbox key is accepted
ok    a sandbox-staging key is accepted
ok    a live API base is refused
ok    a staging live API base is refused
ok    the sandbox API base is accepted
ok    apiBaseFor derives the sandbox API from the key prefix
ok    apiBaseFor derives the staging sandbox API from the key prefix
ok    apiBaseFor returns "" for an unknown prefix rather than a wrong host
ok    payerOf reads `from` out of an access token
ok    payerOf returns "" rather than throwing on garbage

selfcheck PASSED
```

```console
$ ./demo.sh
already provisioned — plan 101018499129044618397360749625192985104713681889541479347454694985352374072453, agent 89246144218570505213637054440434091129811904955181072043019996665797105053507
re-run with FORCE_PROVISION=yes to publish a fresh pair

== who ===========================================================
buyer      0x4D32d8309834D064320e94F397A9CCa4524642E4
builder    0x965cD93B409925561097D2a4DEdb41201d4ABd83
plan       101018499129044618397360749625192985104713681889541479347454694985352374072453
agent      89246144218570505213637054440434091129811904955181072043019996665797105053507 @ http://localhost:8790/ask

== budget - the buyer creates a spend-capped delegation ==========
delegation 3021033a-0417-435f-b38c-c27cf539d7dd (cap 5000c, 3600s)
payer      0x232589dA7dfD0B1b64408f93fcf6967717041225 (the address that signs the payment)

== order - the buyer purchases the plan ==========================
ordered    success=true tx=0x815b98a645368c298a...
balance    account 0x4D32d8309834D064320e94F397A9CCa4524642E4 -> 148 credits
           payer   0x232589dA7dfD0B1b64408f93fcf6967717041225 -> 0 credits
           NOTE: credits live on the ACCOUNT address; the PAYER only signs the payment

== act 1 - the raw MPP wire ======================================
request 1  402 Payment Required
challenge  Payment id="vPO1TjGoTGhQiV2N9gSeSHrmAeCK0Pnt0UMHYy7oibs", realm="api.san...
           plan=101018499129044618397360... credits=1 bound-to-body=true
credential Payment eyJjaGFsbGVuZ2UiOnsiaWQiOiJ2UE8xVGpHb1RHaFFpVjJOOWdTZVNIcm1BZUNL...
request 2  200 OK
receipt    {"method":"nevermined","reference":"vPO1TjGoTGhQiV2N9gSeSHrmAeCK0Pnt0UMHYy7oibs","status":"success","timestamp":"2026-09-04T10:49:20.072Z"}
body       {"answer":"You asked \"What is the Machine Payments Protocol?\". This agent is a dummy: it only proves the payment happened.","agentId":"89246144218570505213637054440434091129811904955181072043019996665797105053507","servedAt":"2026-09-04T10:49:19.432Z"}

== act 2 - the same call through payments.mpp.fetch ==============
status     200
accounting paid=true settled=true credentialsPresented=1 creditsPresented=1
receipt    {"method":"nevermined","reference":"IWW1txFcW1S5EnDUs-_HKqvOX48V9dIpbt6MBpiCdd4","status":"success","timestamp":"2026-09-04T10:49:22.054Z"}
body       {"answer":"You asked \"What is the Machine Payments Protocol?\". This agent is a dummy: it only proves the payment happened.","agentId":"89246144218570505213637054440434091129811904955181072043019996665797105053507","servedAt":"2026-09-04T10:49:21.511Z"}

== act 3 - the negatives =========================================
replay     402 Payment Required  (the act-1 credential presented a second time)
body-swap  402 Payment Required  (same credential, different body)

== act 4 - the ledger ============================================
payer      0 -> 0 credits
account    148 -> 146 credits
burned     2 credit(s) this run, 14 total for this plan
delegation revoked (200)


--- seller log ------------------------------------------------------
[seller] account  0x965cD93B409925561097D2a4DEdb41201d4ABd83
[seller] plan     101018499129044618397360749625192985104713681889541479347454694985352374072453
[seller] agent    89246144218570505213637054440434091129811904955181072043019996665797105053507
[seller] listening on http://localhost:8790/ask (POST, 1 credit(s))
[seller] <- GET /health  (no credential)
[seller] <- GET /health  (no credential)
[seller] <- POST /ask  (no credential)
[seller] <- POST /ask  Authorization: Payment …
[seller] -> answering "What is the Machine Payments Protocol?"
[seller] settled 1 credit(s) against plan 101018499129044618397360749625192985104713681889541479347454694985352374072453
[seller] <- POST /ask  (no credential)
[seller] <- POST /ask  Authorization: Payment …
[seller] -> answering "What is the Machine Payments Protocol?"
[seller] settled 1 credit(s) against plan 101018499129044618397360749625192985104713681889541479347454694985352374072453
[seller] <- POST /ask  Authorization: Payment …
[seller] <- POST /ask  Authorization: Payment …
```

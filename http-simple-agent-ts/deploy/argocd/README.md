# ArgoCD deploy manifests — weather-x402-agent

Reference manifests for deploying the `http-simple-agent-ts` weather x402/MPP
service to the `agents` namespace. **This directory is a reference only** —
these files are not consumed by ArgoCD from here. A human must copy them into
the separate `argocd` repo and open a PR there.

## Where each file goes

| This directory | Target in `nevermined-io/argocd` |
|---|---|
| `weather-x402-agent.yaml` | `eu/dev/argocd-apps/agents/weather-x402-agent.yaml` |
| `weather-x402-agent-staging.yaml` | `eu/dev/argocd-apps/agents/weather-x402-agent-staging.yaml` |

Modeled on `eu/dev/argocd-apps/agents/demo-finance-agent.yaml` and the shared
chart `helm-charts/agent/v1.0.0/`.

## Chart env-key finding (REQUIRED reading before deploying)

`helm-charts/agent/v1.0.0/templates/deployment.yaml` renders the container's
`env:` block as a **fixed, hardcoded list** of `- name: X / value:
{{ .Values.env.X }}` lines — there is no generic `env.*` passthrough. Verified
by rendering the chart with `--set env.PLAN_ID_CREDITS=...` etc.: the values
land in `.Values` but **do not appear anywhere in the rendered Deployment**,
because the template has no line for them.

- **`NVM_API_KEY` needs no chart change.** The chart already has a
  `- name: NVM_API_KEY / value: {{ .Values.env.NVM_API_KEY }}` line, so the
  `helm.parameters` entry `env.NVM_API_KEY: gcp:secretmanager:...` in both
  manifests here renders straight through and is resolved at container start
  by the `secrets-init` init container/wrapper (the same mechanism the
  template uses for `secrets.openaiApiKey` → `OPENAI_API_KEY` on
  demo-finance-agent — any env value matching the `gcp:secretmanager:...`
  form is fetched and substituted before `initCommand` runs, regardless of
  which `.Values` path it came from). Confirmed in the `helm template` output
  below.
- **`PLAN_ID_CREDITS`, `PLAN_ID_TIME`, `PLAN_ID_PAYG` need a chart patch.**
  These three names don't exist anywhere in `templates/deployment.yaml`, so
  no `helm.parameters` value can make them appear as container env vars.
  **Required precondition before merging either Application manifest**: add
  three lines to `helm-charts/agent/v1.0.0/templates/deployment.yaml`, in the
  `env:` block of the container spec (next to the existing `NVM_PLAN_ID` /
  `PLAN_ID` lines is a natural spot):

  ```yaml
          - name: PLAN_ID_CREDITS
            value: "{{ .Values.env.PLAN_ID_CREDITS }}"
          - name: PLAN_ID_TIME
            value: "{{ .Values.env.PLAN_ID_TIME }}"
          - name: PLAN_ID_PAYG
            value: "{{ .Values.env.PLAN_ID_PAYG }}"
  ```

  This is additive only — it doesn't touch any existing line, so it's safe
  for the other apps using this chart version. Ship it as its own tiny PR (or
  as the first commit of the same PR that adds the two Application files),
  merged *before* the Applications sync, otherwise the pods will start with
  empty plan IDs and `agent.ts`'s startup check
  (`if (!NVM_API_KEY || !PLAN_ID_CREDITS || !PLAN_ID_TIME || !PLAN_ID_PAYG)`)
  will crash-loop the container.

## `replicaCount: "1"` — required, not just default

`values.yaml` already defaults `replicaCount: 1`, and it *is* a settable Helm
param (`{{ .Values.replicaCount }}` is used directly in `deployment.yaml`
when `autoscaling.enabled` is false, which is also the default). Both
manifests set it explicitly anyway for visibility: **do not raise it and do
not enable `autoscaling`**. The MPP single-use-token guard lives inside
`paymentMiddleware` (`@nevermined-io/payments/express`) — the
`inFlightMppCredentials` / `spentMppCredentials` in-process, in-memory sets,
not anything in `agent.ts` — so a second replica (or HPA scale-out) would let
the same MPP credential be redeemed twice, defeating the guard. (The SDK's own
comment on `spentMppCredentials` says the same: it does not span processes or
horizontally-scaled instances.)

## Startup: probes must tolerate a ~15–20s boot

The image takes ~15–20s to start (the payments SDK import is heavy) before
`GET /health` responds. Ensure the pod's readiness/liveness probe allows for
this — a startup probe, or a `readinessProbe` with enough `initialDelaySeconds`
/ `failureThreshold`. A liveness probe that fires sooner will kill the pod
mid-boot and crash-loop it.

## Viewer API keys in access logs (showcase Connect flow)

The tutorials showcase's "Connect with Nevermined" flow returns the viewer's
API key to the site as a **query param** (`?nvm_api_key=…`, the App's
`/auth/cli` shape), so it lands in the showcase server's (and any proxy/CDN's)
access logs on the redirect's request line. If you deploy the showcase, either
scrub that param at the edge, or track the App-side fix to return the key in
the URL **fragment** (`#…`, never sent to the server — the showcase capture
code already reads both).

## `helm template` render summary (validated locally, no cluster contact)

```
cd ~/Projects/Nevermined/argocd/helm-charts/agent/v1.0.0
helm template weather-x402-agent . -n agents \
  --set image.repository=europe-west3-docker.pkg.dev/nevermined-eu-dev/nevermined-io/tutorials-weather-x402 \
  --set image.tag=sha-testsha \
  --set image.pullPolicy=Always \
  --set service.hostname=weather-x402-agent.nevermined.app \
  --set service.ports.port=3000 \
  --set service.ports.targetPort=3000 \
  --set service.ports.containerPort=3000 \
  --set replicaCount=1 \
  --set initCommand="yarn start" \
  --set ingress.rateLimitEnabled=true \
  --set env.NVM_API_KEY="gcp:secretmanager:projects/112425687177/secrets/tutorials-weather-nvm-api-key"
```

Rendered (helm v3.10.1), no template errors, four resources:

- **ServiceAccount** `weather-x402-agent`, namespace `agents`, GKE Workload
  Identity annotation present.
- **Service** `weather-x402-agent`, namespace `agents`, `ClusterIP`, port
  `3000` → targetPort `3000`.
- **Deployment** `weather-x402-agent`, namespace `agents`, `replicas: 1`,
  image `europe-west3-docker.pkg.dev/nevermined-eu-dev/nevermined-io/tutorials-weather-x402:sha-testsha`,
  `imagePullPolicy: Always`, command wrapped by `/secrets/secrets-init`,
  `initCommand` = `yarn start`. Rendered env block (fixed list — this is what
  confirms finding (b) above):
  ```
  - name: NVM_API_KEY
    value: gcp:secretmanager:projects/112425687177/secrets/tutorials-weather-nvm-api-key
  - name: OPENAI_API_KEY
    value:
  - name: AGENT_DID
    value:
  ... (unrelated fixed keys for other agents, all empty here) ...
  - name: BASE_URL
    value: https://weather-x402-agent.nevermined.app
  ```
  `PLAN_ID_CREDITS` / `PLAN_ID_TIME` / `PLAN_ID_PAYG` are **absent** from this
  list, confirming the chart patch above is required.
- **Ingress** `weather-x402-agent`, host `weather-x402-agent.nevermined.app`,
  rate-limit annotations present (`rateLimitEnabled=true`), TLS via
  `letsencrypt-prod` cluster issuer, backend service port `3000`.

`helm` was available locally (`v3.10.1`); no cluster contact was made — this
is template rendering only.

## Human deploy steps (gated — not run by the agent that authored this)

1. **Patch the chart** (see above): add the three `PLAN_ID_*` env lines to
   `helm-charts/agent/v1.0.0/templates/deployment.yaml` in the `argocd` repo.
   Bump the chart's `Chart.yaml` `version`/`appVersion` if that repo's
   convention expects it for template-only changes (check recent chart
   commits for precedent).
2. **Create the GCP Secret Manager secret** referenced by both manifests:
   `projects/112425687177/secrets/tutorials-weather-nvm-api-key`, containing
   the builder's `NVM_API_KEY` (the same key created in Task 4 /
   `register-plans.ts`). Grant the GKE node/Workload Identity service account
   (`112425687177-compute@developer.gserviceaccount.com`, per the rendered
   ServiceAccount annotation above) `roles/secretmanager.secretAccessor` on
   it, matching how `openai-api-key` is already granted for
   demo-finance-agent.
   - Prod and staging manifests point at the **same** secret path here
     (single sandbox builder key). Split into a second secret first if the
     two environments should not share credentials/spending.
3. **Run `yarn register-plans`** in `http-simple-agent-ts/` against the
   target environment to obtain the three real plan IDs, then replace
   `REPLACE_WITH_PLAN_ID` for `env.PLAN_ID_CREDITS` / `PLAN_ID_TIME` /
   `PLAN_ID_PAYG` in both manifests (staging can reuse the same plan IDs or
   register its own — decide based on whether staging spend should be
   isolated).
4. **Replace the image tag.** After the first CI build on `main` (see
   `.github/workflows/weather-x402-image.yml`), copy the printed `sha-<short>`
   tag into `image.tag` in both manifests, replacing
   `sha-REPLACE_AFTER_FIRST_CI_BUILD`.
5. **Copy the two Application files** from this directory into
   `eu/dev/argocd-apps/agents/` in the `argocd` repo (paths in the table
   above), alongside the chart patch from step 1, in one PR.
6. **Commit, push, open the PR** in the `argocd` repo, get it reviewed, merge
   to `main`.
7. **ArgoCD auto-syncs** the `agents` namespace (`syncPolicy.automated` with
   `prune`/`selfHeal`) — no manual `kubectl apply` needed once merged.
8. **Verify the deployment is live**:
   ```bash
   curl -fsS https://weather-x402-agent.nevermined.app/health
   kubectl -n agents get deploy weather-x402-agent
   ```
   Expect `{"ok":true}` and `1/1` ready. Then re-run Task 5's `smoke.ts` with
   `SERVER_URL=https://weather-x402-agent.nevermined.app` so both protocols
   pay against the live service. Repeat steps 3, 4 and 8 (with the `-staging`
   names/hostname) for the staging Application.

None of the above (chart patch, secret creation, plan registration against a
real deployment target, `argocd` repo commit/push/PR, `kubectl`) was
performed by the agent that authored these files — this task is gated to
author + validate only.

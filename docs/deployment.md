# Independent deployment to wix.fyi/loop/

Production URL: https://wix.fyi/loop/.

## Infrastructure lives in wix.fyi CDK

The wix.fyi CDK app owns the infrastructure in two stacks:

- `cdk/lib/phosphor-loop-stack.ts` (`PhosphorLoopStack`) owns the app bucket,
  origin access identity, and GitHub deployment role. Future session storage,
  APIs, and other Phosphor services belong here.
- `cdk/lib/host-stack.ts` (`HostStack`) owns the shared domain, distribution,
  `/loop` routing/cache policy, and the app role's distribution invalidation grant.
  The website depends on the app stack; the app stack has no dependency back.

Together they provide:

- Private bucket `wix-fyi-phosphor-loop-097029023067`, separate from the personal
  site's `www.wix.fyi` bucket. It is encrypted, blocks public access, requires SSL,
  and is retained if removed from the stack.
- CloudFront `/loop` and `/loop/*` behaviors pointing at that bucket through an
  origin access identity. The existing domain, certificate, and distribution are
  reused. Other URLs retain the original website origin.
- A viewer-request function redirects `/loop` to `/loop/`, strips `/loop` from
  requests to S3, and serves bucket-root `index.html` for `/loop/`. Thus files in
  the bucket have normal root keys like `index.html`, `js/app.js`, and `sw.js`.
- IAM role `wix-fyi-phosphor-loop-deploy`, trusting GitHub OIDC only for
  `wickz80/phosphor-loop-min` on `main`, using its immutable OIDC subject:
  `repo:wickz80@32722332/phosphor-loop-min@1424659759:ref:refs/heads/main`.
  It can modify objects in this dedicated
  bucket and invalidate/wait for the shared distribution. It has no write access
  to the personal site's bucket. CloudFront invalidation permission is scoped to
  the distribution; the workflow requests only `/loop` and `/loop/*`.

No console-only routing, bucket, or role configuration is needed. The existing
account-wide GitHub OIDC provider is reused, as with the main site's deployment.
Stack outputs expose the bucket name, role ARN, and distribution ID. The website
workflow runs infrastructure/routing tests before deploying CDK.

The parent site's Gatsby deployment continues writing only its own bucket. Its
sync excludes the reserved `loop` namespace there as an extra boundary, but the
app assets are in a completely separate bucket. App code and workers use relative
URLs, so the public `/loop/` prefix works despite bucket-root storage.

## This repo owns publishing

`.github/workflows/deploy.yml` runs on every push to `main`, plus manual runs on
`main`. Runs are serialized. It:

1. Tests and packages only browser assets, stamping first-party asset URLs and
   the service-worker cache with the commit SHA.
2. Uses GitHub OIDC for temporary AWS credentials. No AWS access keys or GitHub
   secrets are stored.
3. Uploads assets before `index.html` and `sw.js`, pruning obsolete files in the
   dedicated app bucket. It never syncs the personal site's bucket.
4. Invalidates `/loop` and `/loop/*`, waits for completion, and verifies the page.

Public identifiers are in `deploy/production.json`. If CDK changes those outputs,
update that file before the next app deploy. Normal pushes do not run CDK or
rebuild Gatsby. The service worker controls `/loop/` only, and its cache cleanup
is restricted to caches named for that scope. It leaves the rest of the domain's
caches alone.

## Reproducing infrastructure changes

In the wix.fyi repository, build Gatsby so the root site's CDK deployment asset
exists, then use the usual CDK deployment process:

```sh
npm ci
npm run build
cd cdk
npm ci
npm test -- --runInBand
npx cdk diff PhosphorLoopStack HostStack
npx cdk deploy PhosphorLoopStack HostStack
```

Use the existing account `097029023067` in `us-east-1`. Adding a GitHub environment
to the app workflow changes its OIDC subject and requires a CDK trust-policy
update. There is no separate one-off IAM bootstrap template for this app.

## Verification

- `node --experimental-strip-types --test tools/deploy/package.test.ts sw.test.ts`: runtime packaging, revision stamps,
  relative URLs, and service-worker cache isolation.
- `TEST_BASE_PATH=/loop/ npm run test:minimal`: startup, audio workers, mappings,
  saved settings, and controls under the public prefix.
- `python3 tests/check.py`: standing pre-push renderer check.
- `node tests/deployed.mjs https://wix.fyi/loop/`: live rendering, synthetic shared
  audio/pitch analysis, Smooth mode, and scoped service-worker registration.

The CDK routing tests cover `/loop` redirects, prefix stripping, private origin
selection, preservation of unrelated website routes, retained/private bucket
configuration, and the app role's bucket boundary. To roll back the app, revert
on `main`; infrastructure stays managed by the wix.fyi CDK app.

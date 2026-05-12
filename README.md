# Local Tourism

Static Next.js site on S3 + CloudFront, with a small custom admin (Cognito + API Gateway + Lambda + DynamoDB) for editing trip packages. Audience: Brazil (region `sa-east-1`).

## Layout

```
web/      Next.js 16 (static export) — public site + /admin
infra/    AWS CDK (TypeScript) — S3, CloudFront, DynamoDB, Cognito, API Gateway, Lambda
infra/lambda/packages   Lambda handler for /packages and /uploads
.github/workflows/deploy.yml   GitHub Actions: cdk deploy → next build → s3 sync → CF invalidation
```

## One-time setup

### 1. AWS bootstrap

```bash
cd infra
npm install
npx cdk bootstrap aws://<ACCOUNT_ID>/sa-east-1
```

### 2. GitHub OIDC role

Create an IAM role in your AWS account that trusts `token.actions.githubusercontent.com` for the repo `mmamedel/local-tourism`. Grant it `AdministratorAccess` (or scope it down to CloudFormation, CDK assets, S3, CloudFront, DynamoDB, Cognito, API Gateway, Lambda, IAM PassRole). Set its ARN as a GitHub secret named `AWS_DEPLOY_ROLE_ARN`.

### 3. First deploy

Push to `main` — the workflow will:
1. `cdk deploy` to create all infra
2. Capture stack outputs (API URL, Cognito IDs, CloudFront domain, bucket name)
3. Build Next.js with those outputs baked in as `NEXT_PUBLIC_*`
4. Sync `web/out` to S3
5. Invalidate CloudFront

### 4. Create the admin user

After the first deploy, look up the `UserPoolId` in the workflow logs or CloudFormation outputs, then:

```bash
aws cognito-idp admin-create-user \
  --region sa-east-1 \
  --user-pool-id <UserPoolId> \
  --username admin \
  --user-attributes Name=email,Value=client@example.com Name=email_verified,Value=true \
  --temporary-password 'ChangeMe!2026'

# Set a permanent password (avoids NEW_PASSWORD_REQUIRED challenge)
aws cognito-idp admin-set-user-password \
  --region sa-east-1 \
  --user-pool-id <UserPoolId> \
  --username admin \
  --password '<strong-password>' \
  --permanent
```

The client then logs in at `https://<cloudfront-domain>/admin/login/`.

## Local dev

```bash
cd web
cp .env.local.example .env.local
# fill in values from a deployed stack
npm install
npm run dev
```

## Adding the custom domain later

When the client provides DNS:

1. In `infra/lib/infra-stack.ts`, add an ACM certificate (must be in `us-east-1`) and pass `domainNames` + `certificate` to the `Distribution`.
2. Re-deploy.
3. Give the client the ACM DNS-validation CNAME and the CloudFront domain (target of an `ALIAS`/`CNAME` record from their DNS provider).

## Costs (rough, low-traffic brochure site)

- S3 + CloudFront: pennies/month
- DynamoDB on-demand: pennies/month
- Lambda + API Gateway: free tier covers it
- Cognito: free for &lt; 50,000 MAUs

Expect well under $5/month at typical traffic.

#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { LocalTourismStack } from "../lib/infra-stack";
import { GitHubOidcStack } from "../lib/oidc-stack";

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;

new GitHubOidcStack(app, "GitHubOidcStack", {
  env: { account, region: "sa-east-1" },
  repo: "mmamedel/local-tourism",
});

// Site bucket + DynamoDB + API + Lambda + Cognito live in sa-east-1 (closer to Brazil).
// CloudFront is global, but the cert it consumes must be in us-east-1 — CDK handles
// the cross-region cert via DnsValidatedCertificate / CertificateManager construct
// once a domain is wired up. For now we deploy without a custom domain.
new LocalTourismStack(app, "LocalTourismStack", {
  env: { account, region: "sa-east-1" },
  crossRegionReferences: true,
});

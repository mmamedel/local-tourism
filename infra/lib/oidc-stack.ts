import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface OidcStackProps extends cdk.StackProps {
  /** GitHub "owner/repo" — only this repo can assume the role. */
  repo: string;
}

export class GitHubOidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OidcStackProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, "GitHubOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const role = new iam.Role(this, "GitHubDeployRole", {
      roleName: "github-actions-local-tourism-deploy",
      assumedBy: new iam.FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": `repo:${props.repo}:*`,
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Permission to assume the CDK bootstrap roles (which hold the actual deploy perms).
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    // Permissions for `aws s3 sync` and `aws cloudfront create-invalidation` (post-deploy steps).
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ],
        resources: [
          `arn:aws:s3:::localtourismstack-sitebucket*`,
          `arn:aws:s3:::localtourismstack-sitebucket*/*`,
        ],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: ["*"],
      }),
    );

    new cdk.CfnOutput(this, "RoleArn", { value: role.roleArn });
  }
}

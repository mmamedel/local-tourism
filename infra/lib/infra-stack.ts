import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as path from "node:path";

export class LocalTourismStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---------- DynamoDB ----------
    const table = new dynamodb.Table(this, "PackagesTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });
    table.addGlobalSecondaryIndex({
      indexName: "by-slug",
      partitionKey: { name: "slug", type: dynamodb.AttributeType.STRING },
    });

    // ---------- S3 buckets ----------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const imagesBucket = new s3.Bucket(this, "ImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // ---------- Cognito ----------
    const userPool = new cognito.UserPool(this, "AdminUserPool", {
      selfSignUpEnabled: false,
      signInAliases: { username: true, email: true },
      passwordPolicy: {
        minLength: 10,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient("AdminClient", {
      authFlows: { userPassword: true },
      generateSecret: false,
    });

    // ---------- Lambda ----------
    const fn = new lambda.Function(this, "PackagesFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda", "packages")),
      environment: {
        TABLE_NAME: table.tableName,
        IMAGES_BUCKET: imagesBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
    });
    table.grantReadWriteData(fn);
    imagesBucket.grantPut(fn);
    imagesBucket.grantRead(fn);

    // ---------- API Gateway (HTTP API) ----------
    const httpApi = new apigw.HttpApi(this, "Api", {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.POST,
          apigw.CorsHttpMethod.PUT,
          apigw.CorsHttpMethod.DELETE,
          apigw.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["content-type", "authorization"],
      },
    });

    const integration = new integrations.HttpLambdaIntegration("PackagesInt", fn);

    const jwt = new authorizers.HttpJwtAuthorizer(
      "CognitoJwt",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    // Public routes
    httpApi.addRoutes({ path: "/packages", methods: [apigw.HttpMethod.GET], integration });
    httpApi.addRoutes({
      path: "/packages/{slug}",
      methods: [apigw.HttpMethod.GET],
      integration,
    });

    // Admin routes (JWT-protected)
    httpApi.addRoutes({
      path: "/packages",
      methods: [apigw.HttpMethod.POST],
      integration,
      authorizer: jwt,
    });
    httpApi.addRoutes({
      path: "/packages/{id}",
      methods: [apigw.HttpMethod.PUT, apigw.HttpMethod.DELETE],
      integration,
      authorizer: jwt,
    });
    httpApi.addRoutes({
      path: "/packages/by-id/{id}",
      methods: [apigw.HttpMethod.GET],
      integration,
      authorizer: jwt,
    });
    httpApi.addRoutes({
      path: "/uploads",
      methods: [apigw.HttpMethod.POST],
      integration,
      authorizer: jwt,
    });

    // ---------- CloudFront ----------
    // /images/* path is rewritten to strip the prefix before hitting S3,
    // so uploaded keys can live at the bucket root.
    const imageRewriteFn = new cloudfront.Function(this, "ImagePathRewrite", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var req = event.request;
  if (req.uri.indexOf('/images/') === 0) {
    req.uri = req.uri.substring('/images'.length);
  }
  return req;
}
`),
    });

    // Resolve directory paths to /index.html (S3 OAC doesn't do this automatically
    // like S3 website hosting does).
    const indexRewriteFn = new cloudfront.Function(this, "IndexRewrite", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri.endsWith('/')) {
    req.uri = uri + 'index.html';
  } else if (!uri.includes('.')) {
    req.uri = uri + '/index.html';
  }
  return req;
}
`),
    });

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { eventType: cloudfront.FunctionEventType.VIEWER_REQUEST, function: indexRewriteFn },
        ],
      },
      additionalBehaviors: {
        "/images/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(imagesBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          functionAssociations: [
            { eventType: cloudfront.FunctionEventType.VIEWER_REQUEST, function: imageRewriteFn },
          ],
        },
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: "/404.html" },
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: "/404.html" },
      ],
    });

    // ---------- Outputs ----------
    new cdk.CfnOutput(this, "SiteBucketName", { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, "ImagesBucketName", { value: imagesBucket.bucketName });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "DistributionDomain", {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "Region", { value: this.region });
  }
}

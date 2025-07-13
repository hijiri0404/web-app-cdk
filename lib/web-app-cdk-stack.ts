// AWS CDKの基本モジュールをインポート
import * as cdk from 'aws-cdk-lib';
// CDKでコンストラクトを作成するためのベースクラスをインポート
import { Construct } from 'constructs';
// Amazon Cognito（ユーザー認証サービス）のモジュールをインポート
import * as cognito from 'aws-cdk-lib/aws-cognito';
// AWS Lambda（サーバーレス関数）のモジュールをインポート
import * as lambda from 'aws-cdk-lib/aws-lambda';
// Amazon API Gateway（REST API作成サービス）のモジュールをインポート
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
// Amazon DynamoDB（NoSQLデータベース）のモジュールをインポート
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// Amazon S3（オブジェクトストレージ）のモジュールをインポート
import * as s3 from 'aws-cdk-lib/aws-s3';
// S3へのファイルデプロイメント機能をインポート（将来のフロントエンドデプロイで使用予定）
// import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
// Amazon CloudFront（CDNサービス）のモジュールをインポート
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
// CloudFrontで使用するオリジン設定のモジュールをインポート
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
// Amazon Route53（DNSサービス）のモジュールをインポート
import * as route53 from 'aws-cdk-lib/aws-route53';
// AWS Certificate Manager（SSL証明書管理）のモジュールをインポート
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
// Route53のターゲット設定（AレコードやCNAMEレコードの設定先）をインポート
import * as targets from 'aws-cdk-lib/aws-route53-targets';
// AWS IAM（アクセス権限管理）のモジュールをインポート
import * as iam from 'aws-cdk-lib/aws-iam';
// AWS Solutions Constructsから認証付きAPI構成パターンをインポート
import { CognitoToApiGatewayToLambda } from '@aws-solutions-constructs/aws-cognito-apigateway-lambda';
// AWS Solutions ConstructsからLambda-DynamoDB連携パターンをインポート
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
// CDK Nag（セキュリティベストプラクティスチェック）のモジュールをインポート
import { NagSuppressions } from 'cdk-nag';

// CDKスタックを定義するクラス（WebアプリケーションのAWSリソースをまとめて管理）
export class WebAppCdkStack extends cdk.Stack {
  // コンストラクタ：スタックの初期化時に実行される関数
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // 親クラス（cdk.Stack）のコンストラクタを呼び出し、基本設定を行う
    super(scope, id, props);

    // ドメイン設定：cdk.jsonファイルから設定値を取得、なければデフォルト値を使用
    const domainName = this.node.tryGetContext('domainName') || 'your-domain.com';
    // Route53のホストゾーンID（DNS管理に必要）をcdk.jsonから取得
    const hostedZoneId = this.node.tryGetContext('hostedZoneId');

    // 既存のRoute53ホストゾーンをインポート（事前にRoute53でドメインを購入・設定済み前提）
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId, // Route53で管理されているホストゾーンのID
      zoneName: domainName, // 管理対象のドメイン名
    });

    // SSL Certificate for CloudFront (must be in us-east-1)
    const certificate = new acm.Certificate(this, 'WebAppCertificate', {
      domainName: domainName,
      subjectAlternativeNames: [`www.${domainName}`, `api.${domainName}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Tasks API Lambda function
    const tasksLambda = new lambda.Function(this, 'TasksApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/tasks-api'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // DynamoDB table using AWS Solutions Construct
    const lambdaToDynamoDB = new LambdaToDynamoDB(this, 'TasksLambdaToDynamoDB', {
      existingLambdaObj: tasksLambda,
      dynamoTableProps: {
        tableName: 'TasksTable',
        partitionKey: {
          name: 'id',
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: 'userId',
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        encryption: dynamodb.TableEncryption.AWS_MANAGED,
        pointInTimeRecoverySpecification: {
          pointInTimeRecoveryEnabled: true,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
      },
    });

    // Add table name to Lambda environment
    tasksLambda.addEnvironment('TABLE_NAME', lambdaToDynamoDB.dynamoTable.tableName);

    // Cognito + API Gateway + Lambda using AWS Solutions Construct
    const cognitoApiLambda = new CognitoToApiGatewayToLambda(this, 'CognitoApiLambda', {
      existingLambdaObj: tasksLambda,
      apiGatewayProps: {
        restApiName: 'TasksApi',
        description: 'API for task management application',
        proxy: false, // プロキシを無効にして個別のリソース/メソッドを追加可能にする
        defaultCorsPreflightOptions: {
          allowOrigins: apigateway.Cors.ALL_ORIGINS,
          allowMethods: apigateway.Cors.ALL_METHODS,
          allowHeaders: ['Content-Type', 'Authorization'],
        },
      },
      cognitoUserPoolProps: {
        selfSignUpEnabled: true,
        signInAliases: {
          email: true,
        },
        standardAttributes: {
          email: {
            required: true,
            mutable: true,
          },
          givenName: {
            required: true,
            mutable: true,
          },
          familyName: {
            required: true,
            mutable: true,
          },
        },
        passwordPolicy: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: true,
        },
        accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
      },
      cognitoUserPoolClientProps: {
        authFlows: {
          userSrp: true,
          userPassword: false,
        },
        generateSecret: false,
      },
    });

    // Add API routes
    const api = cognitoApiLambda.apiGateway;
    const tasksResource = api.root.addResource('tasks');
    tasksResource.addMethod('GET');
    tasksResource.addMethod('POST');

    const taskResource = tasksResource.addResource('{id}');
    taskResource.addMethod('GET');
    taskResource.addMethod('PUT');
    taskResource.addMethod('DELETE');

    // S3 bucket for frontend hosting
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${domainName}-website`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Origin Access Control for CloudFront
    const originAccessControl = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      description: 'OAC for website bucket',
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket, {
          originAccessControl,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        },
      },
      domainNames: [domainName, `www.${domainName}`],
      certificate: certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Grant CloudFront access to S3 bucket
    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipal',
        actions: ['s3:GetObject'],
        resources: [websiteBucket.arnForObjects('*')],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      })
    );

    // Route 53 records
    new route53.ARecord(this, 'WebsiteARecord', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    new route53.ARecord(this, 'WebsiteWWWARecord', {
      zone: hostedZone,
      recordName: `www.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    // Custom domain for API Gateway
    const apiDomainName = new apigateway.DomainName(this, 'ApiDomainName', {
      domainName: `api.${domainName}`,
      certificate: certificate,
      endpointType: apigateway.EndpointType.EDGE,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    });

    apiDomainName.addBasePathMapping(api, {
      basePath: 'v1',
    });

    new route53.ARecord(this, 'ApiARecord', {
      zone: hostedZone,
      recordName: `api.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayDomain(apiDomainName)
      ),
    });

    // CDK Nag suppressions for demo environment
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWS managed policies are acceptable for this demo application',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are acceptable for this demo application',
      },
      {
        id: 'AwsSolutions-APIG2',
        reason: 'Request validation is not required for this demo API',
      },
      {
        id: 'AwsSolutions-APIG3',
        reason: 'WAF is not required for this demo API',
      },
      {
        id: 'AwsSolutions-COG2',
        reason: 'MFA is not required for this demo application',
      },
      {
        id: 'AwsSolutions-COG3',
        reason: 'Advanced security features are not required for this demo',
      },
    ]);

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${domainName}`,
      description: 'Website URL',
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: `https://api.${domainName}/v1`,
      description: 'API URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: cognitoApiLambda.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: cognitoApiLambda.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 Bucket Name for website files',
    });
  }
}

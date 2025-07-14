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

    // CloudFront用SSL証明書をインポート（us-east-1リージョンで事前作成済み）
    const cloudfrontCertificate = acm.Certificate.fromCertificateArn(
      this, 
      'CloudFrontCertificate', 
      'arn:aws:acm:us-east-1:471112657080:certificate/7b22bf76-43a0-4c6d-9d25-8c1402945f92'
    );

    // API Gateway用SSL証明書（us-east-1リージョンで作成 - API Gateway要件）
    const apiGatewayCertificate = new acm.Certificate(this, 'ApiGatewayCertificate', {
      domainName: `api.${domainName}`, // APIサブドメイン（例：api.hijiri0404.link）
      validation: acm.CertificateValidation.fromDns(hostedZone), // DNS検証でSSL証明書を自動検証
      transparencyLoggingEnabled: true,
    });

    // タスク管理API用のLambda関数を定義
    const tasksLambda = new lambda.Function(this, 'TasksApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Node.js 20.x ランタイムを指定
      handler: 'index.handler', // Lambda関数のエントリーポイント（index.jsのhandler関数）
      code: lambda.Code.fromAsset('lambda/tasks-api'), // Lambda関数のソースコードのパス
      timeout: cdk.Duration.seconds(30), // Lambda関数のタイムアウト時間（30秒）
      environment: { // Lambda関数の環境変数を設定
        NODE_OPTIONS: '--enable-source-maps', // TypeScriptのソースマップを有効化（デバッグに有用）
      },
    });

    // AWS Solutions ConstructsのLambda-DynamoDB連携パターンを使用してDynamoDBテーブルを作成
    const lambdaToDynamoDB = new LambdaToDynamoDB(this, 'TasksLambdaToDynamoDB', {
      existingLambdaObj: tasksLambda, // 既存のLambda関数を指定（上で作成したtasksLambda）
      dynamoTableProps: { // DynamoDBテーブルの詳細設定
        tableName: 'TasksTable', // テーブル名を指定
        partitionKey: { // パーティションキー（プライマリキーの一部）
          name: 'id', // キー名：タスクの一意識別子
          type: dynamodb.AttributeType.STRING, // データ型：文字列
        },
        sortKey: { // ソートキー（プライマリキーの一部、複合キー構成）
          name: 'userId', // キー名：ユーザーID
          type: dynamodb.AttributeType.STRING, // データ型：文字列
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 従量課金モード（使用量に応じた課金）
        encryption: dynamodb.TableEncryption.AWS_MANAGED, // AWS管理のキーで暗号化（追加料金なし）
        pointInTimeRecoverySpecification: { // ポイントインタイム復旧の設定
          pointInTimeRecoveryEnabled: true, // ポイントインタイム復旧を有効化（過去35日間のデータ復旧可能）
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY, // デモ用途のため、スタック削除時にテーブルも削除
      },
    });

    // Lambda関数の環境変数にDynamoDBテーブル名を設定（Lambda関数内でテーブルにアクセスするため）
    tasksLambda.addEnvironment('TABLE_NAME', lambdaToDynamoDB.dynamoTable.tableName);

    // AWS Solutions ConstructsのCognito + API Gateway + Lambda連携パターンを使用
    const cognitoApiLambda = new CognitoToApiGatewayToLambda(this, 'CognitoApiLambda', {
      existingLambdaObj: tasksLambda, // 既存のLambda関数を指定
      apiGatewayProps: { // API Gatewayの詳細設定
        restApiName: 'TasksApi', // REST APIの名前
        description: 'API for task management application', // APIの説明
        proxy: false, // プロキシを無効にして個別のリソース/メソッドを追加可能にする
        defaultCorsPreflightOptions: { // CORS（Cross-Origin Resource Sharing）設定
          allowOrigins: apigateway.Cors.ALL_ORIGINS, // 全てのオリジンからのアクセスを許可
          allowMethods: apigateway.Cors.ALL_METHODS, // 全てのHTTPメソッドを許可
          allowHeaders: ['Content-Type', 'Authorization'], // 許可するHTTPヘッダーを指定
        },
      },
      cognitoUserPoolProps: { // Amazon Cognitoユーザープールの詳細設定
        selfSignUpEnabled: true, // ユーザーの自己登録を許可
        signInAliases: { // サインイン時の識別子設定
          email: true, // メールアドレスでのサインインを有効化
        },
        standardAttributes: { // ユーザープロファイルの標準属性設定
          email: { // メールアドレス属性
            required: true, // 必須項目として設定
            mutable: true, // 後から変更可能
          },
          givenName: { // 名前（名）属性
            required: true, // 必須項目として設定
            mutable: true, // 後から変更可能
          },
          familyName: { // 名前（姓）属性
            required: true, // 必須項目として設定
            mutable: true, // 後から変更可能
          },
        },
        passwordPolicy: { // パスワードポリシーの設定
          minLength: 8, // 最小文字数：8文字
          requireLowercase: true, // 小文字を必須
          requireUppercase: true, // 大文字を必須
          requireDigits: true, // 数字を必須
          requireSymbols: true, // 記号を必須
        },
        accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, // アカウント復旧はメールのみ
        removalPolicy: cdk.RemovalPolicy.DESTROY, // デモ用途のため、スタック削除時にユーザープールも削除
      },
      cognitoUserPoolClientProps: { // Cognitoユーザープールクライアントの設定
        authFlows: { // 認証フローの設定
          userSrp: true, // SRP（Secure Remote Password）認証を有効化（安全な認証方式）
          userPassword: false, // パスワード直接送信認証を無効化（セキュリティ強化）
        },
        generateSecret: false, // クライアントシークレットを生成しない（フロントエンドアプリ用設定）
      },
    });

    // API Gatewayのルート設定を追加
    const api = cognitoApiLambda.apiGateway; // Solutions Constructsで作成されたAPI Gatewayインスタンスを取得
    const tasksResource = api.root.addResource('tasks'); // '/tasks'リソースを追加（全タスク操作用）
    tasksResource.addMethod('GET'); // GET /tasks - 全タスク一覧取得
    tasksResource.addMethod('POST'); // POST /tasks - 新規タスク作成

    const taskResource = tasksResource.addResource('{id}'); // '/tasks/{id}'リソースを追加（個別タスク操作用、{id}はパスパラメータ）
    taskResource.addMethod('GET'); // GET /tasks/{id} - 指定タスクの詳細取得
    taskResource.addMethod('PUT'); // PUT /tasks/{id} - 指定タスクの更新
    taskResource.addMethod('DELETE'); // DELETE /tasks/{id} - 指定タスクの削除

    // 重要：全てのAPIリソースとメソッド定義完了後にCognito User Poolsオーソライザーを追加
    // Solutions Constructsの警告解決と公式ドキュメント要件に従った実装
    cognitoApiLambda.addAuthorizers();

    // フロントエンド用S3バケットを作成（Webサイトのファイルを格納）
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${domainName}-website`, // バケット名：ドメイン名-website形式
      removalPolicy: cdk.RemovalPolicy.DESTROY, // デモ用途のため、スタック削除時にバケットも削除
      autoDeleteObjects: true, // バケット削除時に中身のオブジェクトも自動削除
      publicReadAccess: false, // パブリック読み取りアクセスを禁止（CloudFront経由でのみアクセス可能）
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // 全てのパブリックアクセスをブロック（セキュリティ強化）
      encryption: s3.BucketEncryption.S3_MANAGED, // S3管理暗号化を有効化（追加料金なし）
      enforceSSL: true, // HTTPS接続を強制（HTTP接続を拒否）
    });

    // CloudFront用のOrigin Access Control（OAC）を作成（S3へのセキュアなアクセス制御）
    const originAccessControl = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      description: 'OAC for website bucket', // OACの説明：Webサイトバケットへのアクセス制御用
    });

    // CloudFrontディストリビューション（CDN）を作成（世界中にWebサイトを高速配信）
    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: { // デフォルトの配信動作設定（全てのパスに適用される基本設定）
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket, { // S3バケットをオリジンとしてOAC経由でアクセス
          originAccessControl, // 上で作成したOACを使用
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // HTTPリクエストを自動的にHTTPSにリダイレクト
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS, // 許可するHTTPメソッド（読み取り専用）
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS, // キャッシュ対象のHTTPメソッド
        compress: true, // gzip圧縮を有効化（転送量削減、表示速度向上）
      },
      additionalBehaviors: { // 特定パス用の追加配信動作設定
        '/api/*': { // '/api/'で始まる全てのパスに適用される設定（API呼び出し用）
          origin: new origins.RestApiOrigin(api), // API GatewayをオリジンとしてAPIリクエストを転送
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // API呼び出しもHTTPS強制
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // 全HTTPメソッドを許可（GET、POST、PUT、DELETE等）
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS, // 安全なメソッドのみキャッシュ
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // APIレスポンスはキャッシュしない（動的コンテンツのため）
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN, // CORS対応のリクエストポリシー
        },
      },
      domainNames: [domainName, `www.${domainName}`], // カスタムドメイン名を設定（メインドメインとwwwサブドメイン）
      certificate: cloudfrontCertificate, // CloudFront用SSL証明書を使用
      defaultRootObject: 'index.html', // ルートアクセス時のデフォルトファイル
      errorResponses: [ // エラーページのカスタム設定（SPA用設定）
        {
          httpStatus: 404, // 404エラー（ページが見つからない）
          responseHttpStatus: 200, // 200 OKとしてレスポンス
          responsePagePath: '/index.html', // index.htmlを返す（SPAのルーティング対応）
        },
        {
          httpStatus: 403, // 403エラー（アクセス拒否）
          responseHttpStatus: 200, // 200 OKとしてレスポンス
          responsePagePath: '/index.html', // index.htmlを返す（SPAのルーティング対応）
        },
      ],
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3, // HTTP/2とHTTP/3を有効化（高速化）
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // 料金クラス：最も安い設定（北米・欧州のみ）
      // デプロイ時間短縮のための設定
      enabled: true, // ディストリビューションを有効化
      comment: 'Task Management Web App Distribution', // 管理用コメント
    });

    // CloudFrontにS3バケットへのアクセス権限を付与（セキュアな権限設定）
    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipal', // ポリシーステートメントの識別子
        actions: ['s3:GetObject'], // S3オブジェクトの読み取り権限のみ許可
        resources: [websiteBucket.arnForObjects('*')], // バケット内の全オブジェクトを対象
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')], // CloudFrontサービスプリンシパルを指定
        conditions: { // 条件付きアクセス（特定のディストリビューションからのみ許可）
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`, // このディストリビューションIDからのアクセスのみ許可
          },
        },
      })
    );

    // Route53 DNSレコードの設定（ドメイン名とCloudFrontを紐付け）
    new route53.ARecord(this, 'WebsiteARecord', {
      zone: hostedZone, // 既存のRoute53ホストゾーンを指定
      recordName: domainName, // メインドメイン名のAレコード
      target: route53.RecordTarget.fromAlias( // エイリアスレコードとして設定（CloudFrontへの参照）
        new targets.CloudFrontTarget(distribution) // CloudFrontディストリビューションをターゲットに設定
      ),
    });

    new route53.ARecord(this, 'WebsiteWWWARecord', {
      zone: hostedZone, // 既存のRoute53ホストゾーンを指定
      recordName: `www.${domainName}`, // wwwサブドメインのAレコード
      target: route53.RecordTarget.fromAlias( // エイリアスレコードとして設定
        new targets.CloudFrontTarget(distribution) // 同じCloudFrontディストリビューションをターゲットに設定
      ),
    });

    // API Gateway用のカスタムドメイン設定
    const apiDomainName = new apigateway.DomainName(this, 'ApiDomainName', {
      domainName: `api.${domainName}`, // APIサブドメイン（例：api.hijiri0404.link）
      certificate: apiGatewayCertificate, // API Gateway用SSL証明書を使用
      endpointType: apigateway.EndpointType.REGIONAL, // リージョナルエンドポイント（現在のリージョンの証明書を使用可能）
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2, // TLS 1.2以上のセキュリティポリシーを強制
    });

    apiDomainName.addBasePathMapping(api, { // API Gatewayとカスタムドメインのマッピング設定
      basePath: 'v1', // APIのベースパス（api.domain.com/v1/tasksでアクセス可能）
    });

    new route53.ARecord(this, 'ApiARecord', {
      zone: hostedZone, // 既存のRoute53ホストゾーンを指定
      recordName: `api.${domainName}`, // APIサブドメインのAレコード
      target: route53.RecordTarget.fromAlias( // エイリアスレコードとして設定
        new targets.ApiGatewayDomain(apiDomainName) // API Gatewayカスタムドメインをターゲットに設定
      ),
    });

    // CDK Nagセキュリティチェックの抑制設定（デモ環境用の例外設定）
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4', // AWS管理ポリシー使用の警告を抑制
        reason: 'AWS managed policies are acceptable for this demo application', // デモアプリケーションではAWS管理ポリシーを許可
      },
      {
        id: 'AwsSolutions-IAM5', // ワイルドカード権限の警告を抑制
        reason: 'Wildcard permissions are acceptable for this demo application', // デモアプリケーションではワイルドカード権限を許可
      },
      {
        id: 'AwsSolutions-APIG2', // APIリクエスト検証の警告を抑制
        reason: 'Request validation is not required for this demo API', // デモAPIではリクエスト検証を省略
      },
      {
        id: 'AwsSolutions-APIG3', // WAF設定の警告を抑制
        reason: 'WAF is not required for this demo API', // デモAPIではWAF（Web Application Firewall）を省略
      },
      {
        id: 'AwsSolutions-COG2', // Cognito MFA設定の警告を抑制
        reason: 'MFA is not required for this demo application', // デモアプリケーションでは多要素認証（MFA）を省略
      },
      {
        id: 'AwsSolutions-COG3', // Cognitoセキュリティ機能の警告を抑制
        reason: 'Advanced security features are not required for this demo', // デモでは高度なセキュリティ機能を省略
      },
    ]);

    // CloudFormationスタックの出力値設定（デプロイ後に表示される重要な情報）
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${domainName}`, // WebサイトのURL（HTTPS形式）
      description: 'Website URL', // 出力値の説明
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: `https://api.${domainName}/v1`, // API エンドポイントのURL（HTTPS形式、v1パス付き）
      description: 'API URL', // 出力値の説明
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: cognitoApiLambda.userPool.userPoolId, // Cognitoユーザープールの一意ID（フロントエンド設定で使用）
      description: 'Cognito User Pool ID', // 出力値の説明
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: cognitoApiLambda.userPoolClient.userPoolClientId, // Cognitoユーザープールクライアントの一意ID（フロントエンド設定で使用）
      description: 'Cognito User Pool Client ID', // 出力値の説明
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId, // CloudFrontディストリビューションの一意ID（キャッシュクリア等で使用）
      description: 'CloudFront Distribution ID', // 出力値の説明
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: websiteBucket.bucketName, // S3バケット名（ファイルアップロードで使用）
      description: 'S3 Bucket Name for website files', // 出力値の説明
    });
  }
}

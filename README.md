# 🚀 タスク管理WebアプリケーションCDK

![AWS](https://img.shields.io/badge/AWS-CDK-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9-blue)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

AWS CDKを使用したサーバーレスタスク管理Webアプリケーションのインフラストラクチャコードです。

## 📋 目次

- [🏗️ アーキテクチャ概要](#️-アーキテクチャ概要)
- [🎯 機能](#-機能)
- [📁 プロジェクト構成](#-プロジェクト構成)
- [🚀 クイックスタート](#-クイックスタート)
- [⚙️ 詳細セットアップ](#️-詳細セットアップ)
- [🧪 テスト](#-テスト)
- [🚢 デプロイ](#-デプロイ)
- [🔧 運用・管理](#-運用管理)
- [🆘 トラブルシューティング](#-トラブルシューティング)
- [❓ FAQ](#-faq)

## 🏗️ アーキテクチャ概要

### 使用AWSサービス

| サービス | 用途 | 特徴 |
|---------|------|------|
| **Amazon Cognito** | ユーザー認証・認可 | セキュアな認証、MFA対応 |
| **Amazon API Gateway** | REST API | 自動スケーリング、CORS対応 |
| **AWS Lambda** | バックエンドロジック | サーバーレス、コスト効率 |
| **Amazon DynamoDB** | NoSQLデータベース | 高速、暗号化、バックアップ |
| **Amazon S3** | 静的Webサイトホスティング | 高可用性、低コスト |
| **Amazon CloudFront** | CDN | グローバル配信、HTTPS |
| **Amazon Route53** | DNS管理 | カスタムドメイン対応 |

### アーキテクチャ図

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Browser   │────│ CloudFront  │────│     S3      │
│             │    │    (CDN)    │    │  (Frontend) │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐    ┌─────────────┐
                   │API Gateway  │────│   Lambda    │
                   │ (/api/*)    │    │ (Tasks API) │
                   └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │   Cognito   │    │  DynamoDB   │
                   │ (User Auth) │    │ (Tasks DB)  │
                   └─────────────┘    └─────────────┘
```

## 🎯 機能

### ✅ 認証機能
- ユーザー登録・ログイン
- パスワードリセット
- セッション管理
- JWT トークン認証

### ✅ タスク管理機能
- タスクの作成・編集・削除
- ステータス管理（pending/in_progress/completed）
- 優先度設定（high/medium/low）
- ユーザー個別のタスク管理

### ✅ インフラ機能
- HTTPSによる暗号化通信
- 自動スケーリング
- 高可用性設計
- グローバル配信（CloudFront）

## 📁 プロジェクト構成

```
web-app-cdk/
├── lib/
│   └── web-app-cdk-stack.ts       # メインCDKスタック
├── lambda/
│   └── tasks-api/
│       ├── index.ts               # タスクAPI Lambda関数
│       ├── package.json           # Lambda依存関係
│       └── tsconfig.json          # TypeScript設定
├── test/
│   └── web-app-cdk.test.ts        # ユニットテスト
├── bin/
│   └── web-app-cdk.ts            # CDKアプリエントリーポイント
├── cdk.json                       # CDK設定
├── package.json                   # プロジェクト依存関係
├── tsconfig.json                  # TypeScript設定
└── README.md                      # このファイル
```

## 🚀 クイックスタート

### 前提条件

- **Node.js** 20.x 以上
- **AWS CLI** 2.x （設定済み）
- **AWS CDK** 2.x
- **Route53で管理されているドメイン**
- **⚠️ CloudFront用SSL証明書をus-east-1で事前作成**

### SSL証明書の事前作成（必須）

⚠️ **重要**: デプロイ前に、CloudFront用SSL証明書をus-east-1リージョンで作成する必要があります。

```bash
# 1. us-east-1リージョンでSSL証明書を作成
aws acm request-certificate \
  --domain-name "your-domain.com" \
  --subject-alternative-names "www.your-domain.com" \
  --validation-method DNS \
  --region us-east-1

# 2. 証明書ARNを記録（例: arn:aws:acm:us-east-1:123456789012:certificate/abcd1234-...）

# 3. DNS検証レコードを取得
aws acm describe-certificate \
  --certificate-arn "your-certificate-arn" \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
  --output table

# 4. 表示されたDNS検証レコードをRoute53に手動追加

# 5. 証明書が発行されるまで待機（通常5-10分）
aws acm describe-certificate \
  --certificate-arn "your-certificate-arn" \
  --region us-east-1 \
  --query 'Certificate.Status'

# 6. lib/web-app-cdk-stack.ts の証明書ARNを更新
# 　　const cloudfrontCertificate = acm.Certificate.fromCertificateArn(...)
```

### 3分でセットアップ

```bash
# 1. リポジトリクローン（または既存プロジェクト）
cd web-app-cdk

# 2. 依存関係インストール
npm install

# 3. CDK初回設定（初回のみ）
cdk bootstrap

# 4. ドメイン設定
# cdk.json の domainName と hostedZoneId を更新

# 5. SSL証明書ARNの設定
# lib/web-app-cdk-stack.ts で証明書ARNを更新

# 6. デプロイ
cdk deploy
```

## ⚙️ 詳細セットアップ

### 環境要件

```bash
# Node.js バージョン確認
node --version  # v20.x.x

# AWS CLI 設定確認
aws sts get-caller-identity

# CDK インストール
npm install -g aws-cdk
cdk --version  # 2.x.x
```

### ドメイン設定

#### 1. Route53ホストゾーンID取得

```bash
aws route53 list-hosted-zones-by-name --dns-name hijiri0404.link
```

#### 2. cdk.json 更新

```json
{
  "context": {
    "domainName": "hijiri0404.link",
    "hostedZoneId": "Z1D633PJN98FT9"
  }
}
```

### Lambda関数の依存関係インストール

```bash
cd lambda/tasks-api
npm install
cd ../..
```

## 🧪 テスト

### ユニットテスト実行

```bash
# 全テスト実行
npm test

# カバレッジ付きテスト
npm run test -- --coverage

# 特定テストのみ実行
npm test -- --testNamePattern="Lambda Functions"
```

### CDK構文チェック

```bash
# TypeScriptコンパイル
npm run build

# CloudFormationテンプレート生成
cdk synth

# デプロイ前のdiff確認
cdk diff
```

### セキュリティテスト

```bash
# CDK Nagセキュリティスキャン
npx cdk-nag

# CloudFormation Lintチェック
npm install -g cfn-lint
cfn-lint cdk.out/*.template.json
```

## 🚢 デプロイ

### 開発環境デプロイ

```bash
# 開発環境への初回デプロイ
cdk deploy --require-approval never

# 特定の変更のみデプロイ
cdk deploy --hotswap
```

### 本番環境デプロイ

```bash
# 本番環境用プロファイル使用
AWS_PROFILE=production cdk deploy

# 確認付きデプロイ
cdk deploy --require-approval always
```

### デプロイ時間の目安

- **初回デプロイ**: 20-25分（CloudFrontディストリビューション作成含む）
- **更新デプロイ**: 10-15分
- **SSL証明書検証**: 5-10分（DNS伝播次第）

### デプロイ後の確認

```bash
# スタック情報確認
aws cloudformation describe-stacks --stack-name WebAppCdkStack

# 作成されたリソース確認
aws cloudformation list-stack-resources --stack-name WebAppCdkStack
```

## 🔧 運用・管理

### 監視・ログ

```bash
# Lambda関数のログ確認
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda"

# CloudWatch メトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=WebAppCdkStack-TasksApiFunction \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Average
```

### バックアップ・復旧

```bash
# DynamoDBテーブルのバックアップ作成
aws dynamodb create-backup \
  --table-name TasksTable \
  --backup-name tasks-backup-$(date +%Y%m%d)

# バックアップからの復元
aws dynamodb restore-table-from-backup \
  --target-table-name TasksTable-Restored \
  --backup-arn arn:aws:dynamodb:region:account:table/TasksTable/backup/01234567890123-abc123456
```

### スケーリング設定

```bash
# DynamoDB Auto Scaling 設定確認
aws application-autoscaling describe-scalable-targets \
  --service-namespace dynamodb

# Lambda同時実行数制限確認
aws lambda get-account-settings
```

## 🆘 トラブルシューティング

### よくある問題と解決方法

#### 🔴 デプロイエラー: "HostedZone not found"

**原因**: Route53ホストゾーンIDが正しくない

**解決策**:
```bash
# 正しいホストゾーンID確認
aws route53 list-hosted-zones-by-name --dns-name your-domain.com

# cdk.json の hostedZoneId を更新
```

#### 🔴 Lambda関数エラー: "TABLE_NAME is not defined"

**原因**: 環境変数が正しく設定されていない

**解決策**:
```bash
# Lambda関数の環境変数確認
aws lambda get-function-configuration --function-name WebAppCdkStack-TasksApiFunction

# CDKスタックの再デプロイ
cdk deploy
```

#### 🔴 CORS エラー: "Access-Control-Allow-Origin"

**原因**: API GatewayのCORS設定が不適切

**解決策**:
```typescript
// lib/web-app-cdk-stack.ts で CORS 設定確認
defaultCorsPreflightOptions: {
  allowOrigins: apigateway.Cors.ALL_ORIGINS,
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: ['Content-Type', 'Authorization'],
}
```

#### 🔴 SSL証明書エラー: "Certificate must be in 'us-east-1'"

**原因**: CloudFrontは必ずus-east-1リージョンの証明書が必要

**解決策**:
1. us-east-1で証明書を事前作成
2. 証明書ARNをCDKコードに直接指定
3. DNS検証レコードをRoute53に追加

```bash
# us-east-1で証明書作成
aws acm request-certificate --domain-name "your-domain.com" --region us-east-1

# lib/web-app-cdk-stack.ts で証明書ARNを指定
const cloudfrontCertificate = acm.Certificate.fromCertificateArn(
  this, 'CloudFrontCertificate', 'arn:aws:acm:us-east-1:...'
);
```

#### 🔴 SSL証明書エラー: "Certificate validation failed"

**原因**: DNSの伝播が完了していない

**解決策**:
```bash
# DNS伝播状況確認
dig hijiri0404.link

# 数分待ってから再デプロイ
cdk deploy
```

#### 🔴 API認証エラー: "Invalid authorizer ID specified"

**原因**: Solutions Constructsで`addAuthorizers()`の呼び出しタイミングが不適切

**解決策**:
```typescript
// lib/web-app-cdk-stack.ts で正しい順序を確認
const cognitoApiLambda = new CognitoToApiGatewayToLambda(...);

// 先にすべてのAPIリソース・メソッドを定義
const api = cognitoApiLambda.apiGateway;
const tasksResource = api.root.addResource('tasks');
tasksResource.addMethod('GET');
// ... 他のメソッド定義

// 最後にCognito認証を適用
cognitoApiLambda.addAuthorizers(); // ← 必ず最後に実行
```

## 🔧 アーキテクチャの詳細説明

### API Gateway エンドポイントタイプの選択

本プロジェクトでは**Regionalエンドポイント**を使用しています。各タイプの違いを理解しておくことが重要です：

| エンドポイントタイプ | 証明書リージョン要件 | CloudFront使用 | 用途 | レイテンシ |
|-------------------|-----------------|---------------|------|-----------|
| **Edge-Optimized** | us-east-1必須 | 自動使用 | グローバル | 低（世界中） |
| **Regional** | 任意のリージョン | 使用しない | 特定地域 | 低（そのリージョン） |
| **Private** | 任意のリージョン | 使用しない | VPC内部 | 低（VPC内） |

#### なぜRegionalを選択したか

```typescript
// lib/web-app-cdk-stack.ts
const apiDomainName = new apigateway.DomainName(this, 'ApiDomainName', {
  domainName: `api.${domainName}`,
  certificate: apiGatewayCertificate, // ap-northeast-1の証明書でOK
  endpointType: apigateway.EndpointType.REGIONAL, // Regional設定
  securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
});
```

**選択理由**:
1. **シンプルな設定**: 証明書もAPI Gatewayも同じリージョン（ap-northeast-1）
2. **日本向けアプリ**: 主要ユーザーが日本のため十分なパフォーマンス
3. **メンテナンス性**: クロスリージョン設定の複雑さを回避
4. **コスト効率**: CloudFrontの追加料金なし

**グローバル展開時の変更点**:
Edge-Optimizedに変更する場合は、API Gateway用証明書もus-east-1で作成する必要があります。

### SSL証明書の管理戦略

```
CloudFront用証明書 (us-east-1)
├── hijiri0404.link
└── www.hijiri0404.link

API Gateway用証明書 (ap-northeast-1)  
└── api.hijiri0404.link
```

この分離により、各サービスの制約に適切に対応しています。

### ログ調査方法

```bash
# API Gateway のアクセスログ
aws logs filter-log-events \
  --log-group-name API-Gateway-Execution-Logs_xxxxx \
  --start-time $(date -d '1 hour ago' +%s)000

# Lambda関数のエラーログ
aws logs filter-log-events \
  --log-group-name /aws/lambda/WebAppCdkStack-TasksApiFunction \
  --filter-pattern "ERROR"
```

## ❓ FAQ

### Q: デプロイにはどのくらい時間がかかりますか？

**A**: 初回デプロイは約15-20分、更新デプロイは5-10分程度です。CloudFrontの配布に時間がかかります。

### Q: コストはどのくらいかかりますか？

**A**: 主要コスト要素：
- **Route53**: $0.50/月（ホストゾーン）
- **CloudFront**: $0.085/GB（データ転送）
- **Lambda**: $0.0000166/リクエスト + 実行時間
- **DynamoDB**: オンデマンド課金
- **S3**: $0.023/GB/月

小規模利用なら月額 $5-10 程度です。

### Q: 本番環境での推奨設定は？

**A**: 以下の設定を推奨します：
- **MFA有効化**: Cognito でMFA設定
- **WAF追加**: API Gateway前にWAF配置
- **監視強化**: CloudWatch Alarms設定
- **バックアップ自動化**: DynamoDB継続的バックアップ

### Q: 複数環境（dev/staging/prod）の管理方法は？

**A**: CDK Contextを使用：

```bash
# 開発環境
cdk deploy --context environment=dev

# 本番環境  
cdk deploy --context environment=prod
```

```typescript
// CDK内で環境分岐
const environment = this.node.tryGetContext('environment') || 'dev';
const config = {
  dev: { instanceType: 't3.micro' },
  prod: { instanceType: 't3.medium' }
}[environment];
```

### Q: フロントエンドのデプロイ方法は？

**A**: S3バケットに直接アップロード：

```bash
# React/Vue.jsビルド
npm run build

# S3にアップロード
aws s3 sync dist/ s3://hijiri0404.link-website/

# CloudFrontキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id E1234567890123 \
  --paths "/*"
```

### Q: データベースのマイグレーション方法は？

**A**: DynamoDBのスキーマ変更：

```bash
# バックアップ作成
aws dynamodb create-backup --table-name TasksTable

# 新しいテーブル作成（CDKで）
cdk deploy

# データ移行（AWS Data Pipeline等使用）
```

---

## 📞 サポート

### 🐛 バグ報告
Issues タブからバグ報告をお願いします。

### 💡 機能要望
Discussions タブで機能要望をお聞かせください。

### 📚 関連ドキュメント
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [AWS Solutions Constructs](https://docs.aws.amazon.com/solutions/latest/constructs/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

**🎉 Happy Coding! 本プロジェクトでモダンなサーバーレスアプリケーションを構築しましょう！**

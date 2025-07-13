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

### 1分でセットアップ

```bash
# 1. リポジトリクローン（または既存プロジェクト）
cd web-app-cdk

# 2. 依存関係インストール
npm install

# 3. CDK初回設定（初回のみ）
cdk bootstrap

# 4. ドメイン設定
# cdk.json の domainName と hostedZoneId を更新

# 5. デプロイ
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

#### 🔴 SSL証明書エラー: "Certificate validation failed"

**原因**: DNSの伝播が完了していない

**解決策**:
```bash
# DNS伝播状況確認
dig hijiri0404.link

# 数分待ってから再デプロイ
cdk deploy
```

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

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as WebAppCdk from '../lib/web-app-cdk-stack';

describe('WebAppCdkStack', () => {
  let app: cdk.App;
  let stack: WebAppCdk.WebAppCdkStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App({
      context: {
        domainName: 'test-domain.com',
        hostedZoneId: 'Z1D633PJN98FT9',
      },
    });
    stack = new WebAppCdk.WebAppCdkStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  describe('Lambda Functions', () => {
    test('Tasks API Lambda function is created with correct properties', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
        Handler: 'index.handler',
        Timeout: 30,
      });
    });

    test('Lambda function has required environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            TABLE_NAME: Match.anyValue(),
            NODE_OPTIONS: '--enable-source-maps',
          },
        },
      });
    });
  });

  describe('DynamoDB Table', () => {
    test('DynamoDB table is created with correct configuration', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S',
          },
          {
            AttributeName: 'userId',
            AttributeType: 'S',
          },
        ],
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'userId',
            KeyType: 'RANGE',
          },
        ],
        SSESpecification: {
          SSEEnabled: true,
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });
  });

  describe('API Gateway', () => {
    test('API Gateway is created', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'TasksApi',
        Description: 'API for task management application',
      });
    });

    test('CORS is configured correctly', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS',
      });
    });

    test('Required API resources are created', () => {
      template.resourceCountIs('AWS::ApiGateway::Resource', Match.anyValue());
      template.resourceCountIs('AWS::ApiGateway::Method', Match.anyValue());
    });
  });

  describe('Cognito User Pool', () => {
    test('User Pool is created with correct policies', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireLowercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
            RequireUppercase: true,
          },
        },
        UsernameAttributes: ['email'],
      });
    });

    test('User Pool Client is configured correctly', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: ['USER_SRP_AUTH'],
        GenerateSecret: false,
      });
    });
  });

  describe('S3 Bucket', () => {
    test('S3 bucket is created with security settings', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });
  });

  describe('CloudFront Distribution', () => {
    test('CloudFront distribution is created', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Enabled: true,
          HttpVersion: 'http2and3',
          PriceClass: 'PriceClass_100',
          ViewerProtocolPolicy: 'redirect-to-https',
        },
      });
    });

    test('Distribution has correct behaviors', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
              ViewerProtocolPolicy: 'redirect-to-https',
            }),
          ]),
        },
      });
    });
  });

  describe('Route 53 Records', () => {
    test('A records are created for domain and www subdomain', () => {
      template.resourceCountIs('AWS::Route53::RecordSet', 3); // domain, www, api
    });
  });

  describe('SSL Certificate', () => {
    test('ACM certificate is created with correct domains', () => {
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'test-domain.com',
        SubjectAlternativeNames: ['www.test-domain.com', 'api.test-domain.com'],
      });
    });
  });

  describe('IAM Permissions', () => {
    test('Lambda has DynamoDB permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
                'dynamodb:ConditionCheckItem',
                'dynamodb:BatchWriteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('Stack Outputs', () => {
    test('Required outputs are defined', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs)).toEqual(
        expect.arrayContaining([
          'WebsiteURL',
          'ApiURL',
          'UserPoolId',
          'UserPoolClientId',
          'CloudFrontDistributionId',
          'S3BucketName',
        ])
      );
    });
  });

  describe('Security', () => {
    test('S3 bucket blocks public access', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('API Gateway has authorization', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        AuthorizationType: 'COGNITO_USER_POOLS',
      });
    });
  });
});

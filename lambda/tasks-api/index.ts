// AWS Lambdaの型定義をインポート（API GatewayからのイベントとレスポンスのTypeScript型）
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// AWS SDK v3のDynamoDBクライアントをインポート（最新のSDK）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
// DynamoDBのドキュメントクライアントと各種コマンドをインポート（JSON形式でデータ操作可能）
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// DynamoDBクライアントを初期化（リージョンはLambda環境から自動取得）
const client = new DynamoDBClient({});
// ドキュメントクライアントを作成（JSON形式でのデータ操作を可能にする）
const ddbDocClient = DynamoDBDocumentClient.from(client);

// タスクオブジェクトの型定義（TypeScriptで型安全性を確保）
interface Task {
  id: string; // タスクの一意識別子
  title: string; // タスクのタイトル（必須）
  description?: string; // タスクの詳細説明（オプショナル、?マークで任意項目を表す）
  status: 'pending' | 'in_progress' | 'completed'; // タスクの状態（3つの値のみ許可するユニオン型）
  priority: 'high' | 'medium' | 'low'; // タスクの優先度（3つの値のみ許可）
  userId: string; // タスクを所有するユーザーのID（Cognitoから取得）
  createdAt: string; // タスク作成日時（ISO 8601形式の文字列）
  updatedAt: string; // タスク最終更新日時（ISO 8601形式の文字列）
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  try {
    const method = event.httpMethod;
    const path = event.path;
    const tableName = process.env.TABLE_NAME;

    if (!tableName) {
      throw new Error('TABLE_NAME environment variable is not set');
    }

    // Get user ID from Cognito claims
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // HTTPメソッドに応じて処理を分岐
    switch (method) {
    case 'GET': // GETリクエストの処理（データ取得）
      if (path.includes('/tasks/') && event.pathParameters?.id) {
        // 単一タスクの取得処理（パスに{id}が含まれる場合）
        const taskId = event.pathParameters.id; // URLパラメータからタスクIDを取得
        const result = await ddbDocClient.send(new GetCommand({
          TableName: tableName, // 対象のDynamoDBテーブル
          Key: { id: taskId, userId } // 複合キー（パーティションキー: id, ソートキー: userId）
        }));

        // 指定されたタスクが見つからない場合は404エラーを返す
        if (!result.Item) {
          return {
            statusCode: 404, // HTTP 404 Not Found
            headers,
            body: JSON.stringify({ error: 'Task not found' })
          };
        }

        // タスクが見つかった場合はデータを返す
        return {
          statusCode: 200, // HTTP 200 OK
          headers,
          body: JSON.stringify(result.Item) // タスクデータをJSON形式で返す
        };
      } else {
        // 全タスク一覧の取得処理（/tasksへのGETリクエスト）
        const result = await ddbDocClient.send(new ScanCommand({
          TableName: tableName, // 対象のDynamoDBテーブル
          FilterExpression: 'userId = :userId', // ユーザーIDでフィルタリング
          ExpressionAttributeValues: {
            ':userId': userId // フィルタで使用するユーザーID値
          }
        }));

        // 取得したタスク一覧を返す
        return {
          statusCode: 200, // HTTP 200 OK
          headers,
          body: JSON.stringify(result.Items || []) // タスク配列をJSON形式で返す（空配列も考慮）
        };
      }

    case 'POST': { // POSTリクエストの処理（新規タスク作成）
      // リクエストボディからタスクデータを取得（JSON文字列をオブジェクトに変換）
      const newTask = JSON.parse(event.body || '{}') as Partial<Task>;
      // 新しいタスクオブジェクトを作成（必須フィールドにデフォルト値を設定）
      const task: Task = {
        id: generateId(), // 一意のIDを生成（現在時刻＋ランダム文字列）
        title: newTask.title || '', // タイトル（空文字列をデフォルト値とする）
        description: newTask.description, // 説明（undefinedも許可）
        status: newTask.status || 'pending', // ステータス（デフォルトは'pending'）
        priority: newTask.priority || 'medium', // 優先度（デフォルトは'medium'）
        userId, // 認証されたユーザーのID
        createdAt: new Date().toISOString(), // 作成日時（ISO 8601形式）
        updatedAt: new Date().toISOString() // 更新日時（ISO 8601形式）
      };

      // DynamoDBにタスクを保存
      await ddbDocClient.send(new PutCommand({
        TableName: tableName, // 対象のDynamoDBテーブル
        Item: task // 保存するタスクオブジェクト
      }));

      // 作成成功のレスポンスを返す
      return {
        statusCode: 201, // HTTP 201 Created（新規作成成功）
        headers,
        body: JSON.stringify(task) // 作成されたタスクデータを返す
      };
    }

    case 'PUT': { // PUTリクエストの処理（既存タスクの更新）
      // URLパラメータからタスクIDが取得できない場合はエラー
      if (!event.pathParameters?.id) {
        return {
          statusCode: 400, // HTTP 400 Bad Request
          headers,
          body: JSON.stringify({ error: 'Task ID is required' })
        };
      }

      const taskId = event.pathParameters.id; // URLパラメータからタスクIDを取得
      const updates = JSON.parse(event.body || '{}'); // リクエストボディから更新データを取得

      // DynamoDB UpdateExpressionの構築用配列とオブジェクト
      const updateExpression: string[] = []; // 更新式の配列
      const expressionAttributeValues: Record<string, unknown> = {}; // 更新値を格納するオブジェクト
      const expressionAttributeNames: Record<string, string> = {}; // 属性名のエイリアスを格納するオブジェクト

      // 各フィールドが更新対象に含まれているかチェックし、UPDATE式を動的構築
      if (updates.title !== undefined) {
        updateExpression.push('#title = :title'); // titleフィールドの更新式
        expressionAttributeNames['#title'] = 'title'; // 予約語対策のエイリアス
        expressionAttributeValues[':title'] = updates.title; // 更新する値
      }
      if (updates.description !== undefined) {
        updateExpression.push('description = :description'); // descriptionフィールドの更新式
        expressionAttributeValues[':description'] = updates.description; // 更新する値
      }
      if (updates.status !== undefined) {
        updateExpression.push('#status = :status'); // statusフィールドの更新式
        expressionAttributeNames['#status'] = 'status'; // 予約語対策のエイリアス
        expressionAttributeValues[':status'] = updates.status; // 更新する値
      }
      if (updates.priority !== undefined) {
        updateExpression.push('priority = :priority'); // priorityフィールドの更新式
        expressionAttributeValues[':priority'] = updates.priority; // 更新する値
      }

      // 更新日時は常に現在時刻に更新
      updateExpression.push('updatedAt = :updatedAt');
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      // DynamoDBのUpdateCommandを実行
      await ddbDocClient.send(new UpdateCommand({
        TableName: tableName, // 対象のDynamoDBテーブル
        Key: { id: taskId, userId }, // 更新対象の複合キー
        UpdateExpression: 'SET ' + updateExpression.join(', '), // 更新式をカンマ区切りで結合
        ExpressionAttributeValues: expressionAttributeValues, // 更新値のマッピング
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined, // エイリアスが存在する場合のみ設定
        ConditionExpression: 'attribute_exists(id)' // 更新対象のレコードが存在することを確認
      }));

      // 更新成功のレスポンスを返す
      return {
        statusCode: 200, // HTTP 200 OK
        headers,
        body: JSON.stringify({ message: 'Task updated successfully' })
      };
    }

    case 'DELETE': { // DELETEリクエストの処理（タスクの削除）
      // URLパラメータからタスクIDが取得できない場合はエラー
      if (!event.pathParameters?.id) {
        return {
          statusCode: 400, // HTTP 400 Bad Request
          headers,
          body: JSON.stringify({ error: 'Task ID is required' })
        };
      }

      const deleteTaskId = event.pathParameters.id; // URLパラメータからタスクIDを取得
      // DynamoDBからタスクを削除
      await ddbDocClient.send(new DeleteCommand({
        TableName: tableName, // 対象のDynamoDBテーブル
        Key: { id: deleteTaskId, userId }, // 削除対象の複合キー
        ConditionExpression: 'attribute_exists(id)' // 削除対象のレコードが存在することを確認
      }));

      // 削除成功のレスポンスを返す
      return {
        statusCode: 200, // HTTP 200 OK
        headers,
        body: JSON.stringify({ message: 'Task deleted successfully' })
      };
    }

    case 'OPTIONS': // OPTIONSリクエストの処理（CORS preflight対応）
      return {
        statusCode: 200, // HTTP 200 OK
        headers, // CORS対応ヘッダーを返す
        body: '' // ボディは空文字列
      };

    default: // サポートされていないHTTPメソッドの場合
      return {
        statusCode: 405, // HTTP 405 Method Not Allowed
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
  } catch (error) {
    // エラーハンドリング：予期しないエラーが発生した場合の処理
    console.error('Error:', error); // CloudWatch Logsにエラー詳細を出力
    return {
      statusCode: 500, // HTTP 500 Internal Server Error
      headers,
      body: JSON.stringify({ error: 'Internal server error' }) // 詳細なエラー情報は隠し、一般的なエラーメッセージを返す
    };
  }
};

// 一意のIDを生成する関数：現在時刻（ミリ秒）＋ランダム文字列
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  // Date.now(): 現在時刻のタイムスタンプ（ミリ秒）を文字列に変換
  // Math.random().toString(36).substr(2, 9): 0-1の乱数を36進数に変換し、先頭2文字を除いた9文字を取得
}

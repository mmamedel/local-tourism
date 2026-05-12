// Single Lambda handling all /packages and /uploads routes.
// API Gateway HTTP API handles JWT validation for admin routes via a Cognito authorizer.
// Public GET routes use a separate API Gateway route with no authorizer.

import { randomUUID } from "node:crypto";
import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const TABLE = process.env.TABLE_NAME;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET;
const REGION = process.env.AWS_REGION;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...CORS },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  const rawPath = event.rawPath ?? event.path ?? "";
  const path = rawPath.replace(/\/+$/, "") || "/";

  if (method === "OPTIONS") return reply(200, "");

  try {
    // Public: list published packages
    if (method === "GET" && path === "/packages") {
      const out = await ddb.send(new ScanCommand({ TableName: TABLE }));
      return reply(200, out.Items ?? []);
    }

    // Public: get by slug
    if (method === "GET" && path.startsWith("/packages/") && !path.startsWith("/packages/by-id/")) {
      const slug = decodeURIComponent(path.slice("/packages/".length));
      const out = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: "by-slug",
          KeyConditionExpression: "slug = :s",
          ExpressionAttributeValues: { ":s": slug },
        }),
      );
      const item = out.Items?.[0];
      if (!item) return reply(404, { error: "not_found" });
      return reply(200, item);
    }

    // Admin: get by id
    if (method === "GET" && path.startsWith("/packages/by-id/")) {
      const id = decodeURIComponent(path.slice("/packages/by-id/".length));
      const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
      if (!out.Item) return reply(404, { error: "not_found" });
      return reply(200, out.Item);
    }

    // Admin: create
    if (method === "POST" && path === "/packages") {
      const body = JSON.parse(event.body ?? "{}");
      const id = randomUUID();
      const item = {
        ...body,
        id,
        updatedAt: new Date().toISOString(),
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return reply(201, item);
    }

    // Admin: update
    if (method === "PUT" && path.startsWith("/packages/")) {
      const id = decodeURIComponent(path.slice("/packages/".length));
      const body = JSON.parse(event.body ?? "{}");
      const item = { ...body, id, updatedAt: new Date().toISOString() };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return reply(200, item);
    }

    // Admin: delete
    if (method === "DELETE" && path.startsWith("/packages/")) {
      const id = decodeURIComponent(path.slice("/packages/".length));
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
      return reply(204, "");
    }

    // Admin: request presigned upload URL
    if (method === "POST" && path === "/uploads") {
      const { contentType } = JSON.parse(event.body ?? "{}");
      if (!contentType || !contentType.startsWith("image/")) {
        return reply(400, { error: "invalid_content_type" });
      }
      const ext = contentType.split("/")[1].split("+")[0];
      const key = `${randomUUID()}.${ext}`;
      const command = new PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: key,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
      return reply(200, { uploadUrl, key });
    }

    return reply(404, { error: "route_not_found", path, method });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "internal", message: String(err?.message ?? err) });
  }
};

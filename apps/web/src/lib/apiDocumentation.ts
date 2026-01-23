import { z } from "zod";

export interface ApiRoute {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  requestSchema?: z.ZodType;
  responseSchema?: z.ZodType;
  tags?: string[];
}

export interface ApiDocumentation {
  title: string;
  version: string;
  description: string;
  routes: ApiRoute[];
}

export function createApiDoc(options: {
  title: string;
  version: string;
  description: string;
  routes: ApiRoute[];
}): ApiDocumentation {
  return options;
}

export function generateOpenApiSpec(doc: ApiDocumentation): string {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of doc.routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }

    const operation: Record<string, unknown> = {
      summary: route.description,
      tags: route.tags || ["default"],
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: route.responseSchema
                ? { type: "object", properties: {} }
                : undefined,
            },
          },
        },
        "400": {
          description: "Bad Request",
        },
        "401": {
          description: "Unauthorized",
        },
        "500": {
          description: "Internal Server Error",
        },
      },
    };

    if (route.requestSchema) {
      operation["requestBody"] = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {},
            },
          },
        },
      };
    }

    const methodLower = route.method.toLowerCase();
    (paths[route.path] as Record<string, unknown>)[methodLower] = operation;
  }

  const spec = {
    openapi: "3.0.0",
    info: {
      title: doc.title,
      version: doc.version,
      description: doc.description,
    },
    paths,
  };

  return JSON.stringify(spec, null, 2);
}

export function generateMarkdownDoc(doc: ApiDocumentation): string {
  let md = `# ${doc.title}\n\n`;
  md += `**Version**: ${doc.version}\n\n`;
  md += `${doc.description}\n\n`;
  md += `---\n\n`;
  md += `## 目录\n\n`;
  md += doc.routes
    .map((route) => `- [${route.method} ${route.path}](#${route.method.toLowerCase()}-${route.path.replace(/\//g, "-").replace(/\{|\}/g, "")})`)
    .join("\n");
  md += `\n\n---\n\n`;

  for (const route of doc.routes) {
    const anchor = `${route.method.toLowerCase()}-${route.path.replace(/\//g, "-").replace(/\{|\}/g, "")}`;
    md += `### ${route.method} ${route.path}\n\n`;
    md += `**描述**: ${route.description}\n\n`;
    if (route.tags && route.tags.length > 0) {
      md += `**标签**: ${route.tags.join(", ")}\n\n`;
    }
    if (route.requestSchema) {
      md += `**请求参数**:\n\n`;
      md += `| 参数 | 类型 | 必填 | 描述 |\n`;
      md += `|------|------|------|------|\n`;
      md += `| - | - | - | - |\n\n`;
    }
    md += `**响应示例**:\n\n`;
    md += `\`\`\`json\n`;
    md += `{\n`;
    md += `  "success": true,\n`;
    md += `  "data": {}\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
    md += `---\n\n`;
  }

  return md;
}

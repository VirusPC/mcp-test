import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Create server instance
 * Remind the core concepts of MCP 
 * https://modelcontextprotocol.io/docs/concepts/architecture
 * 1. Resourcses: Expose data and content from your servers to LLMs
 * 2. Prompts: Enable LLMs to perform actions through your server
 * 3. Tools: Create reusable prompt templates and workflows
 * 4. Sampling: Let your servers request completions from LLMs
 * 5. Roots: Understanding roots in MCP
 * 6. Transport: Learn about MCP’s communication mechanisms
 */
export const server = new McpServer({
  name: "weather",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});



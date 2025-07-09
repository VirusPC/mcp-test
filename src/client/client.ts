import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";
import OpenAI from "openai";
import { ChatCompletionMessageParam, ChatCompletionTool, FunctionDefinition } from "openai/resources";

dotenv.config();

// const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// if (!ANTHROPIC_API_KEY) {
//   throw new Error("ANTHROPIC_API_KEY is not set");
// }
const MODEL = 'anthropic/claude-3-7-sonnet';
const apiKey = process.env.OPENAI_API_KEY;
console.log(`Your API key is: ${apiKey}`);

export class MCPClient {
  private mcp: Client;
  // private anthropic: Anthropic;
  private openai: OpenAI;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];

  constructor() {
    // this.anthropic = new Anthropic({
    //   apiKey: apiKey,
    //   baseURL: 'https://openrouter.ai/api/v1'
    // });
    this.openai = new OpenAI({
      apiKey: apiKey, //process.env.DASHSCOPE_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1'
    });
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
  }

  /**
   * 
   * @param serverScriptPath 
   */
  async connectToServer(serverScriptPath: string) {
    try {
      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      if (!isJs && !isPy) {
        throw new Error("Server script must be a .js or .py file");
      }
      const command = isPy
        ? process.platform === "win32"
          ? "python"
          : "python3"
        : process.execPath;

      this.transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
      });
      await this.mcp.connect(this.transport);

      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  async processQuery(query: string) {
    // const messages: MessageParam[] = [
    const messages: ChatCompletionMessageParam[] = [
      {role: 'system', 'content': 'You are a weather assistant.'},
      {
        role: "user",
        content: query,
      },
    ];
    debugger;

    // const response = await this.anthropic.messages.create({
    //   model: "openai/gpt-4o-mini",
    //   max_tokens: 1000,
    //   messages,
    //   tools: this.tools,
    // });


    // 将MCP工具转换为OpenAI工具
    const openaiTools: ChatCompletionTool[] = this.tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      } as FunctionDefinition
    }));
    const response = await this.openai.chat.completions.create({
      model: MODEL, //"openai/gpt-4o-mini",
      store: true,
      max_tokens: 1000,
      tools: openaiTools,
      messages,
      n: 1,
    });


    const finalText = [];
    // for (const choice of response.choices) {
    const choice = response.choices[0];// 取第一个choice
    if (choice.message.content) {
      finalText.push(choice.message.content);
    }
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        const result = await this.mcp.callTool({
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments), // 需要parse
        });

        // const result  = {
        //   "content":
        //     [
        //       {
        //         "type": "text",
        //         "text": "Failed to retrieve grid point data for coordinates: 39.9042, 116.4074. This location may not be supported by the NWS API (only US locations are supported)."
        //       }
        //     ]
        // }
        finalText.push(JSON.stringify(result));
      }
    }
    // }

    // const contents = response.choices.map(choice => choice.message.content)
    // finalText = contents;

    // console.log(JSON.stringify(response, null, 6));

    // for (const content of contents) {
    //   if (content.type === "text") {
    //     finalText.push(content.text);
    //   } else if (content.type === "tool_use") {
    //     const toolName = content.name;
    //     const toolArgs = content.input as { [x: string]: unknown } | undefined;

    //     const result = await this.mcp.callTool({
    //       name: toolName,
    //       arguments: toolArgs,
    //     });
    //     finalText.push(
    //       `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
    //     );

    //     messages.push({
    //       role: "user",
    //       content: result.content as string,
    //     });

    //     const response = await this.anthropic.messages.create({
    //       model: "claude-3-5-sonnet-20241022",
    //       max_tokens: 1000,
    //       messages,
    //     });

    //     finalText.push(
    //       response.content[0].type === "text" ? response.content[0].text : ""
    //     );
    //   }
    // }

    return finalText.join("\n");
  }
  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery(message);
        console.log("\n" + response);
      }
    } catch (e) {
      console.error(e);
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    await this.mcp.close();
  }
}
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "fs/promises";

// Create an MCP server
const server = new McpServer({
  name: "Demo",
  version: "1.0.0"
});

// Add an addition tool with description
server.tool(
  "add",
  "Adds two numbers together",
  { a: z.number().describe("First number"), b: z.number().describe("Second number") },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a subtraction tool
server.tool(
  "subtract",
  "Subtracts the second number from the first number",
  { a: z.number().describe("First number"), b: z.number().describe("Second number") },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a - b) }]
  })
);

// Add a multiplication tool
server.tool(
  "multiply",
  "Multiplies two numbers together",
  { a: z.number().describe("First number"), b: z.number().describe("Second number") },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a * b) }]
  })
);

// Add a file resource that reads the file contents
// The list function allows the inspector to discover available resources
server.resource(
  "file",
  new ResourceTemplate("file:///{path}", {
    list: async () => {
      // Return some example file paths that can be accessed
      // In a real scenario, you might scan a directory
      return {
        resources: [
          {
            uri: "file:///Users/thomasmather/Downloads/calc-server/package.json",
            name: "package.json",
            description: "Package configuration file",
            mimeType: "application/json"
          },
          {
            uri: "file:///Users/thomasmather/Downloads/calc-server/tsconfig.json",
            name: "tsconfig.json",
            description: "TypeScript configuration file",
            mimeType: "application/json"
          }
        ]
      };
    }
  }),
  async (uri: URL, variables: Record<string, unknown>) => {
    let text: string;
    try {
      // Use URI pathname directly - this is the most reliable way for file:// URIs
      // file:///Users/... -> uri.pathname = /Users/...
      let filePath = decodeURIComponent(uri.pathname);
      
      // If pathname is empty or we got path from template variables, try that
      if (!filePath && variables.path) {
        const path = variables.path;
        filePath = Array.isArray(path) ? path.join('/') : String(path);
        // Ensure absolute path
        if (!filePath.startsWith('/')) {
          filePath = '/' + filePath;
        }
      }
      
      // Debug: log the path being used (to stderr so it doesn't interfere with protocol)
      console.error(`Reading file: ${filePath} (from URI: ${uri.href})`);
      
      text = await readFile(filePath, "utf8");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`File read error for ${uri.href}: ${errorMsg}`);
      text = `Error reading file: ${errorMsg}`;
    }
    return {
      contents: [{
        uri: uri.href,
        text,
        mimeType: "text/plain"
      }]
    };
  }
);

// Add a simple text resource that returns "hello world"
server.resource(
  "hello",
  "text://hello-world",
  {
    description: "A simple text resource that returns 'hello world'",
    mimeType: "text/plain"
  },
  async (uri: URL) => {
    return {
      contents: [{
        uri: uri.href,
        text: "hello world",
        mimeType: "text/plain"
      }]
    };
  }
);

server.prompt(
  "review-code",
  "Generates a prompt to review code for best practices and potential issues",
  { code: z.string().describe("The code to review") },
  ({ code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review this code:\n\n${code}`
      }
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    // Use stderr for errors to avoid interfering with stdio protocol
    console.error("Failed to start MCP server:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

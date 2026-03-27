import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCalendarTools } from "./tools/calendars.js";
import { registerEventTools } from "./tools/events.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "apple-calendar",
    version: "0.1.0",
  });

  registerCalendarTools(server);
  registerEventTools(server);

  return server;
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runAppleScript } from "../applescript.js";
import { success, withErrorHandling } from "../helpers.js";

export function registerCalendarTools(server: McpServer) {
  server.tool(
    "calendar_get_calendars",
    "List all calendars",
    {},
    withErrorHandling(async () => {
      const script = `
tell application "Calendar"
  set output to ""
  repeat with cal in every calendar
    set output to output & (name of cal) & "\n"
  end repeat
  return output
end tell`;
      const raw = await runAppleScript(script);
      if (!raw) return success([]);
      return success(raw.split("\n").filter(Boolean));
    }),
  );
}

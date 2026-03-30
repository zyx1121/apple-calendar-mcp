import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runAppleScript, escapeForAppleScript } from "../applescript.js";
import { success, error, withErrorHandling } from "../helpers.js";

// Generates AppleScript that sets a date variable by components (locale-independent)
function asDateVar(varName: string, iso: string, timeOfDay = 0): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return `set ${varName} to current date
  set year of ${varName} to ${d.getFullYear()}
  set month of ${varName} to ${d.getMonth() + 1}
  set day of ${varName} to ${d.getDate()}
  set time of ${varName} to ${timeOfDay}`;
}

interface CalEvent {
  uid: string;
  title: string;
  calendar: string;
  start: string;
  end: string;
  allday: boolean;
  location: string;
  recurrence: string;
}

function parseEvents(raw: string): CalEvent[] {
  if (!raw) return [];
  const events: CalEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 6) continue;
    events.push({
      uid: parts[0],
      title: parts[1],
      calendar: parts[2],
      start: parts[3],
      end: parts[4],
      allday: parts[5] === "true",
      location: parts[6] || "",
      recurrence: parts[7] || "",
    });
  }
  return events;
}

export function registerEventTools(server: McpServer) {
  server.tool(
    "calendar_list_events",
    "List calendar events within a date range",
    {
      date_from: z.string().describe("ISO 8601 date, e.g. '2026-03-27'"),
      date_to: z.string().optional().describe("ISO 8601 date (default: same as date_from)"),
      calendar: z.string().optional().describe("Calendar name filter (omit for all)"),
    },
    withErrorHandling(async ({ date_from, date_to, calendar }) => {
      const calFilter = calendar ? `whose name is "${escapeForAppleScript(calendar)}"` : "";

      const script = `
tell application "Calendar"
  ${asDateVar("rangeStart", date_from, 0)}
  ${asDateVar("rangeEnd", date_to || date_from, 86399)}
  set output to ""
  repeat with cal in (every calendar${calFilter ? " " + calFilter : ""})
    try
      set evts to (every event of cal whose start date >= rangeStart and start date <= rangeEnd)
      repeat with e in evts
        set loc to ""
        try
          if location of e is not missing value then set loc to location of e
        end try
        set rec to ""
        try
          if recurrence of e is not missing value then set rec to recurrence of e
        end try
        set output to output & (uid of e) & "\\t" & (summary of e) & "\\t" & (name of cal) & "\\t" & (start date of e as string) & "\\t" & (end date of e as string) & "\\t" & (allday event of e) & "\\t" & loc & "\\t" & rec & "\\n"
      end repeat
    end try
  end repeat
  return output
end tell`;

      const raw = await runAppleScript(script);
      return success(parseEvents(raw));
    }),
  );

  server.tool(
    "calendar_get_event",
    "Get full details of a calendar event by UID",
    {
      uid: z.string().describe("Event UID"),
    },
    withErrorHandling(async ({ uid }) => {
      const esc = escapeForAppleScript;
      const script = `
tell application "Calendar"
  repeat with cal in every calendar
    try
      set e to first event of cal whose uid is "${esc(uid)}"
      set loc to ""
      try
        if location of e is not missing value then set loc to location of e
      end try
      set desc to ""
      try
        if description of e is not missing value then set desc to description of e
      end try
      set rec to ""
      try
        if recurrence of e is not missing value then set rec to recurrence of e
      end try
      set attendeeInfo to ""
      try
        set attendeeList to every attendee of e
        repeat with a in attendeeList
          set aName to ""
          try
            set aName to display name of a
          end try
          set aEmail to ""
          try
            set aEmail to address of a
          end try
          set aStatus to "unknown"
          try
            set aStatus to participation status of a as string
          end try
          set attendeeInfo to attendeeInfo & aName & "|||" & aEmail & "|||" & aStatus & ";;;"
        end repeat
      end try
      return (uid of e) & "\\t" & (summary of e) & "\\t" & (name of cal) & "\\t" & (start date of e as string) & "\\t" & (end date of e as string) & "\\t" & (allday event of e) & "\\t" & loc & "\\t" & desc & "\\t" & rec & "\\t" & attendeeInfo
    end try
  end repeat
  return ""
end tell`;

      const raw = await runAppleScript(script);
      if (!raw) return error(`Event ${uid} not found.`);
      const p = raw.split("\t");
      const attendees = (p[9] || "").split(";;;").filter(Boolean).map((a) => {
        const [name, email, status] = a.split("|||");
        return { name: name || "", email: email || "", status: status || "unknown" };
      });
      return success({
        uid: p[0], title: p[1], calendar: p[2],
        start: p[3], end: p[4], allday: p[5] === "true",
        location: p[6] || "", description: p[7] || "",
        recurrence: p[8] || "", attendees,
      });
    }),
  );

  server.tool(
    "calendar_search_events",
    "Search events by keyword within a date range",
    {
      query: z.string().min(1).describe("Search keyword"),
      date_from: z.string().optional().describe("ISO 8601 start date (default: today)"),
      date_to: z.string().optional().describe("ISO 8601 end date (default: 30 days from date_from)"),
      calendar: z.string().optional().describe("Calendar name filter"),
    },
    withErrorHandling(async ({ query, date_from, date_to, calendar }) => {
      const fromIso = date_from || new Date().toISOString().slice(0, 10);
      const toIso = date_to || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const esc = escapeForAppleScript;
      const calFilter = calendar ? ` whose name is "${esc(calendar)}"` : "";

      const script = `
tell application "Calendar"
  ${asDateVar("rangeStart", fromIso, 0)}
  ${asDateVar("rangeEnd", toIso, 86399)}
  set output to ""
  repeat with cal in (every calendar${calFilter})
    try
      set evts to (every event of cal whose start date >= rangeStart and start date <= rangeEnd and summary contains "${esc(query)}")
      repeat with e in evts
        set loc to ""
        try
          if location of e is not missing value then set loc to location of e
        end try
        set rec to ""
        try
          if recurrence of e is not missing value then set rec to recurrence of e
        end try
        set output to output & (uid of e) & "\\t" & (summary of e) & "\\t" & (name of cal) & "\\t" & (start date of e as string) & "\\t" & (end date of e as string) & "\\t" & (allday event of e) & "\\t" & loc & "\\t" & rec & "\\n"
      end repeat
    end try
  end repeat
  return output
end tell`;

      const raw = await runAppleScript(script);
      return success(parseEvents(raw));
    }),
  );

  server.tool(
    "calendar_create_event",
    "Create a new calendar event",
    {
      title: z.string().describe("Event title"),
      calendar: z.string().describe("Calendar name to add event to"),
      start: z.string().describe("ISO 8601 datetime, e.g. '2026-03-28T10:00:00'"),
      end: z.string().describe("ISO 8601 datetime, e.g. '2026-03-28T11:00:00'"),
      location: z.string().optional().describe("Event location"),
      description: z.string().optional().describe("Event notes/description"),
      allday: z.coerce.boolean().default(false).describe("All-day event"),
      recurrence: z.string().optional().describe("iCalendar RRULE string, e.g. 'FREQ=WEEKLY;INTERVAL=1', 'FREQ=WEEKLY;BYDAY=MO,WE,FR', 'FREQ=DAILY;COUNT=10'"),
    },
    withErrorHandling(async ({ title, calendar, start, end, location, description, allday, recurrence }) => {
      const esc = escapeForAppleScript;
      const locationLine = location ? `\n  set location of newEvent to "${esc(location)}"` : "";
      const descLine = description ? `\n  set description of newEvent to "${esc(description)}"` : "";
      const recLine = recurrence ? `\n  set recurrence of newEvent to "${esc(recurrence)}"` : "";

      const script = `
tell application "Calendar"
  ${asDateVar("evtStart", start)}
  ${asDateVar("evtEnd", end)}
  set cal to first calendar whose name is "${esc(calendar)}"
  set newEvent to make new event at end of events of cal with properties {summary: "${esc(title)}", start date: evtStart, end date: evtEnd, allday event: ${allday}}${locationLine}${descLine}${recLine}
  return uid of newEvent
end tell`;

      const uid = await runAppleScript(script);
      return success({ uid, title, calendar, start, end, created: true });
    }),
  );

  server.tool(
    "calendar_update_event",
    "Update an existing calendar event",
    {
      uid: z.string().describe("Event UID"),
      title: z.string().optional().describe("New title"),
      start: z.string().optional().describe("New start datetime (ISO 8601)"),
      end: z.string().optional().describe("New end datetime (ISO 8601)"),
      location: z.string().optional().describe("New location"),
      description: z.string().optional().describe("New description"),
      recurrence: z.string().optional().describe("iCalendar RRULE string, e.g. 'FREQ=WEEKLY;INTERVAL=1', 'FREQ=WEEKLY;BYDAY=MO,WE,FR', 'FREQ=DAILY;COUNT=10'"),
    },
    withErrorHandling(async ({ uid, title, start, end, location, description, recurrence }) => {
      const esc = escapeForAppleScript;
      const updates: string[] = [];
      const dateSetup: string[] = [];
      if (title) updates.push(`set summary of e to "${esc(title)}"`);
      if (start) { dateSetup.push(asDateVar("newStart", start)); updates.push(`set start date of e to newStart`); }
      if (end) { dateSetup.push(asDateVar("newEnd", end)); updates.push(`set end date of e to newEnd`); }
      if (location !== undefined) updates.push(`set location of e to "${esc(location)}"`);
      if (description !== undefined) updates.push(`set description of e to "${esc(description)}"`);
      if (recurrence !== undefined) updates.push(`set recurrence of e to "${esc(recurrence)}"`);

      if (updates.length === 0) return error("No fields to update.");

      const script = `
tell application "Calendar"
  ${dateSetup.join("\n  ")}
  set foundEvent to missing value
  repeat with cal in every calendar
    try
      set e to first event of cal whose uid is "${esc(uid)}"
      ${updates.join("\n      ")}
      set foundEvent to e
      exit repeat
    end try
  end repeat
  if foundEvent is missing value then return "not found"
  return "updated"
end tell`;

      const result = await runAppleScript(script);
      if (result !== "updated") return error(`Event ${uid} not found.`);
      return success({ uid, updated: true });
    }),
  );

  server.tool(
    "calendar_delete_event",
    "Delete a calendar event",
    {
      uid: z.string().describe("Event UID"),
    },
    withErrorHandling(async ({ uid }) => {
      const esc = escapeForAppleScript;
      const script = `
tell application "Calendar"
  repeat with cal in every calendar
    try
      set e to first event of cal whose uid is "${esc(uid)}"
      delete e
      return "ok"
    end try
  end repeat
  return "not found"
end tell`;

      const result = await runAppleScript(script);
      if (result === "not found") return error(`Event ${uid} not found.`);
      return success({ uid, deleted: true });
    }),
  );
}

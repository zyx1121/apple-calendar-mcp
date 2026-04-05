```
 ██████╗ █████╗ ██╗     ███████╗███╗   ██╗██████╗  █████╗ ██████╗ 
██╔════╝██╔══██╗██║     ██╔════╝████╗  ██║██╔══██╗██╔══██╗██╔══██╗
██║     ███████║██║     █████╗  ██╔██╗ ██║██║  ██║███████║██████╔╝
██║     ██╔══██║██║     ██╔══╝  ██║╚██╗██║██║  ██║██╔══██║██╔══██╗
╚██████╗██║  ██║███████╗███████╗██║ ╚████║██████╔╝██║  ██║██║  ██║
 ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
                                                                  
```

# @zyx1121/apple-calendar-mcp

MCP server for Apple Calendar — create, search, and manage events via Claude Code.

## Install

```bash
claude mcp add apple-calendar -- npx @zyx1121/apple-calendar-mcp
```

## Prerequisites

- macOS with Calendar.app configured
- Node.js >= 18
- First run will prompt for Automation permission (System Settings > Privacy & Security > Automation)

## Tools

| Tool | Description |
|------|-------------|
| `calendar_get_calendars` | List all calendars with their accounts |
| `calendar_list_events` | List events in a date range (returns recurrence info) |
| `calendar_get_event` | Get full event details including attendees and recurrence |
| `calendar_search_events` | Search events by keyword |
| `calendar_create_event` | Create an event (with optional recurrence) |
| `calendar_update_event` | Update an event (with optional recurrence) |
| `calendar_delete_event` | Delete an event |

### Recurring events

`calendar_create_event` and `calendar_update_event` accept a `recurrence` parameter using iCalendar RRULE format:

```
"FREQ=DAILY;COUNT=10"
"FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
"FREQ=MONTHLY;UNTIL=20261231T000000Z"
```

### Attendees

`calendar_get_event` returns an `attendees` array with name, email, and participation status. Attendees are read-only (AppleScript limitation).

## Examples

```
"Show my calendars"              → calendar_get_calendars
"This week's events"             → calendar_list_events { from_date: "2026-03-30", to_date: "2026-04-05" }
"Get event details"              → calendar_get_event { event_id: "ABC-123", calendar: "Work" }
"Create weekly meeting"          → calendar_create_event { calendar: "Work", title: "Standup", start_date: "2026-03-31T10:00:00", end_date: "2026-03-31T10:30:00", recurrence: "FREQ=WEEKLY;COUNT=12" }
"Search for lunch"               → calendar_search_events { query: "lunch" }
"Delete event"                   → calendar_delete_event { event_id: "ABC-123", calendar: "Work" }
```

## Limitations

- macOS only (uses AppleScript via `osascript`)
- Calendar.app must be running
- Attendees are read-only

## License

MIT

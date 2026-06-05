/\*\*

- Timesheets Tools for Jobber MCP Server
- Updated for Jobber GraphQL API 2025 schema (timeSheetEntries, finalDuration, EncodedId) \*/

import { z } from 'zod'; import { JobberClient } from '../clients/jobber.js'; import type { TimeEntry } from '../types/jobber.js';

export const timesheetsTools = { list_time_entries: { description: 'List time entries with optional filtering', inputSchema: z.object({ userId: z.string().optional(), visitId: z.string().optional(), startDate: z.string().optional().describe('ISO 8601 date (used for client-side filtering)'), endDate: z.string().optional().describe('ISO 8601 date (used for client-side filtering)'), limit: z.number().default(50), cursor: z.string().optional(), }), execute: async (client: JobberClient, args: any) =&gt; { const filters: string\[\] = \[\]; if (args.userId) filters.push(`userId: "${args.userId}"`); if (args.visitId) filters.push(`visitId: "${args.visitId}"`);

```
  const filterClause = filters.length > 0 ? `, filter: { ${filters.join(', ')} }` : '';
  const afterClause = args.cursor ? `, after: "${args.cursor}"` : '';

  const query = `
    query ListTimeEntries {
      timeSheetEntries(first: ${args.limit}${afterClause}${filterClause}) {
        edges {
          node {
            id
            startAt
            endAt
            finalDuration
            note
            user {
              id
              name {
                full
              }
            }
            visit {
              id
              title
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const data = await client.query(query);
  let entries = data.timeSheetEntries.edges.map((e: any) => e.node);

  // Client-side date filtering (server-side date filters removed in Jobber API 2023-08-18)
  if (args.startDate) {
    entries = entries.filter((e: any) => e.startAt >= args.startDate);
  }
  if (args.endDate) {
    entries = entries.filter((e: any) => e.startAt <= args.endDate + 'T23:59:59Z');
  }

  return {
    timeEntries: entries,
    pageInfo: data.timeSheetEntries.pageInfo,
  };
},
```

},

get_time_entry: { description: 'Get a specific time entry by ID', inputSchema: z.object({ timeEntryId: z.string(), }), execute: async (client: JobberClient, args: any) =&gt; { const query = `query GetTimeEntry($id: EncodedId!) { timeSheetEntry(id: $id) { id startAt endAt finalDuration note user { id name { full } } visit { id title } } } `;

```
  const data = await client.query(query, { id: args.timeEntryId });
  return { timeEntry: data.timeSheetEntry };
},
```

},

create_time_entry: { description: 'Create a new time entry', inputSchema: z.object({ userId: z.string(), visitId: z.string().optional(), startAt: z.string().describe('ISO 8601 datetime'), endAt: z.string().optional().describe('ISO 8601 datetime'), note: z.string().optional(), }), execute: async (client: JobberClient, args: any) =&gt; { const mutation = `mutation CreateTimeEntry($input: TimeSheetEntryCreateInput!) { timeSheetEntryCreate(input: $input) { timeSheetEntry { id startAt endAt finalDuration note } userErrors { message } } } `;

```
  const input: any = {
    userId: args.userId,
    startAt: args.startAt,
  };
  if (args.visitId) input.visitId = args.visitId;
  if (args.endAt) input.endAt = args.endAt;
  if (args.note) input.note = args.note;

  const data = await client.mutate(mutation, { input });

  if (data.timeSheetEntryCreate.userErrors?.length > 0) {
    throw new Error(`Time entry creation failed: ${data.timeSheetEntryCreate.userErrors.map((e: any) => e.message).join(', ')}`);
  }

  return { timeEntry: data.timeSheetEntryCreate.timeSheetEntry };
},
```

},

update_time_entry: { description: 'Update an existing time entry', inputSchema: z.object({ timeEntryId: z.string(), startAt: z.string().optional().describe('ISO 8601 datetime'), endAt: z.string().optional().describe('ISO 8601 datetime'), note: z.string().optional(), }), execute: async (client: JobberClient, args: any) =&gt; { const mutation = `mutation UpdateTimeEntry($id: EncodedId!, $input: TimeSheetEntryUpdateInput!) { timeSheetEntryUpdate(id: $id, input: $input) { timeSheetEntry { id startAt endAt finalDuration note } userErrors { message } } } `;

```
  const input: any = {};
  if (args.startAt) input.startAt = args.startAt;
  if (args.endAt) input.endAt = args.endAt;
  if (args.note) input.note = args.note;

  const data = await client.mutate(mutation, { id: args.timeEntryId, input });

  if (data.timeSheetEntryUpdate.userErrors?.length > 0) {
    throw new Error(`Time entry update failed: ${data.timeSheetEntryUpdate.userErrors.map((e: any) => e.message).join(', ')}`);
  }

  return { timeEntry: data.timeSheetEntryUpdate.timeSheetEntry };
},
```

},

delete_time_entry: { description: 'Delete a time entry', inputSchema: z.object({ timeEntryId: z.string(), }), execute: async (client: JobberClient, args: any) =&gt; { const mutation = `mutation DeleteTimeEntry($id: EncodedId!) { timeSheetEntryDelete(id: $id) { deletedTimeSheetEntryId userErrors { message } } } `;

```
  const data = await client.mutate(mutation, { id: args.timeEntryId });

  if (data.timeSheetEntryDelete.userErrors?.length > 0) {
    throw new Error(`Time entry deletion failed: ${data.timeSheetEntryDelete.userErrors.map((e: any) => e.message).join(', ')}`);
  }

  return { deletedTimeEntryId: data.timeSheetEntryDelete.deletedTimeSheetEntryId };
},
```

},

stop_time_entry: { description: 'Stop a running time entry (set end time to now)', inputSchema: z.object({ timeEntryId: z.string(), }), execute: async (client: JobberClient, args: any) =&gt; { const endAt = new Date().toISOString(); const mutation = `mutation StopTimeEntry($id: EncodedId!, $input: TimeSheetEntryUpdateInput!) { timeSheetEntryUpdate(id: $id, input: $input) { timeSheetEntry { id startAt endAt finalDuration } userErrors { message } } } `;

```
  const data = await client.mutate(mutation, { id: args.timeEntryId, input: { endAt } });

  if (data.timeSheetEntryUpdate.userErrors?.length > 0) {
    throw new Error(`Failed to stop time entry: ${data.timeSheetEntryUpdate.userErrors.map((e: any) => e.message).join(', ')}`);
  }

  return { timeEntry: data.timeSheetEntryUpdate.timeSheetEntry };
},
```

},

get_user_timesheet: { description: 'Get timesheet summary for a user over a date range', inputSchema: z.object({ userId: z.string(), startDate: z.string().describe('ISO 8601 date'), endDate: z.string().describe('ISO 8601 date'), }), execute: async (client: JobberClient, args: any) =&gt; { const query = `query GetUserTimesheet { timeSheetEntries(first: 200, filter: { userId: "${args.userId}" }) { edges { node { id startAt endAt finalDuration note visit { id title } } } } } `;

```
  const data = await client.query(query);

  let entries = data.timeSheetEntries.edges.map((e: any) => e.node);

  // Client-side date filtering (server-side date range filters removed in Jobber API 2023-08-18)
  if (args.startDate) {
    entries = entries.filter((e: any) => e.startAt >= args.startDate);
  }
  if (args.endDate) {
    entries = entries.filter((e: any) => e.startAt <= args.endDate + 'T23:59:59Z');
  }

  const totalDuration = entries.reduce((sum: number, entry: any) => sum + (entry.finalDuration || 0), 0);

  return {
    userId: args.userId,
    startDate: args.startDate,
    endDate: args.endDate,
    entries,
    totalHours: totalDuration / 3600,
  };
},
```

}, };

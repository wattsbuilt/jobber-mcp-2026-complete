/**
 * Jobs Tools for Jobber MCP Server
 */

import { z } from 'zod';
import { JobberClient } from '../clients/jobber.js';
import type { Job, Visit, LineItem } from '../types/jobber.js';

export const jobsTools = {
  list_jobs: {
    description: 'List all jobs with optional filtering and pagination',
    inputSchema: z.object({
      status: z.enum(['ACTION_REQUIRED', 'ACTIVE', 'CANCELLED', 'COMPLETED', 'LATE', 'REQUIRES_INVOICING']).optional(),
      clientId: z.string().optional(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    }),
    execute: async (client: JobberClient, args: any) => {
      const filterConditions: string[] = [];
      if (args.status) {
        filterConditions.push(`status: ${args.status}`);
      }
      if (args.clientId) {
        filterConditions.push(`clientId: "${args.clientId}"`);
      }

      const filters = filterConditions.length > 0 ? `, filter: { ${filterConditions.join(', ')} }` : '';
      const afterClause = args.cursor ? `, after: "${args.cursor}"` : '';

      const query = `
        query ListJobs {
          jobs(first: ${args.limit}${afterClause}${filters}) {
            edges {
              node {
                ${JobberClient.jobFields}
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
          }
        }
      `;

      const data = await client.query(query);
      return {
        jobs: data.jobs.edges.map((e: any) => e.node),
        pageInfo: data.jobs.pageInfo,
        totalCount: data.jobs.totalCount,
      };
    },
  },

  get_job: {
    description: 'Get a specific job by ID',
    inputSchema: z.object({
      jobId: z.string().describe('The job ID'),
    }),
    execute: async (client: JobberClient, args: any) => {
      const query = `query GetJob($id: EncodedId!) { job(id: $id) { ${JobberClient.jobFields} timesheetEntries { nodes { id startAt endAt finalDuration ticking note user { id firstName lastName } } } } } `;

      const data = await client.query(query, { id: args.jobId });
      return { job: data.job };
    },
  },

  create_job: {
    description: 'Create a new job',
    inputSchema: z.object({
      title: z.string(),
      description: z.string().optional(),
      clientId: z.string(),
      propertyId: z.string().optional(),
    }),
    execute: async (client: JobberClient, args: any) => {
      const mutation = `
        mutation CreateJob($input: JobInput!) {
          jobCreate(input: $input) {
            job {
              ${JobberClient.jobFields}
            }
            userErrors {
              message
              path
            }
          }
        }
      `;

      const input = {
        title: args.title,
        description: args.description,
        clientId: args.clientId,
        propertyId: args.propertyId,
      };

      const data = await client.mutate(mutation, { input });

      if (data.jobCreate.userErrors?.length > 0) {
        throw new Error(`Job creation failed: ${data.jobCreate.userErrors.map((e: any) => e.message).join(', ')}`);
      }

      return { job: data.jobCreate.job };
    },
  },

  update_job: {
    description: 'Update an existing job',
    inputSchema: z.object({
      jobId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
    }),
    execute: async (client: JobberClient, args: any) => {
      const mutation = `
        mutation UpdateJob($id: ID!, $input: JobUpdateInput!) {
          jobUpdate(id: $id, input: $input) {
            job {
              ${JobberClient.jobFields}
            }
            userErrors {
              message
              path
            }
          }
        }
      `;

      const input: any = {};
      if (args.title) input.title = args.title;
      if (args.description) input.description = args.description;

      const data = await client.mutate(mutation, { id: args.jobId, input });

      if (data.jobUpdate.userErrors?.length > 0) {
        throw new Error(`Job update failed: ${data.jobUpdate.userErrors.map((e: any) => e.message).join(', ')}`);
      }

      return { job: data.jobUpdate.job };
    },
  },

  close_job: {
    description: 'Close a job (mark as completed)',
    inputSchema: z.object({
      jobId: z.string(),
    }),
    execute: async (client: JobberClient, args: any) => {
      const mutation = `
        mutation CloseJob($id: ID!) {
          jobClose(id: $id) {
            job {
              ${JobberClient.jobFields}
            }
            userErrors {
              message
            }
          }
        }
      `;

      const data = await client.mutate(mutation, { id: args.jobId });

      if (data.jobClose.userErrors?.length > 0) {
        throw new Error(`Job close failed: ${data.jobClose.userErrors.map((e: any) => e.message).join(', ')}`);
      }

      return { job: data.jobClose.job };
    },
  },

  list_job_visits: {
    description: 'List all visits for a specific job',
    inputSchema: z.object({
      jobId: z.string(),
    }),
    execute: async (client: JobberClient, args: any) => {
      const query = `
        query GetJobVisits($id: ID!) {
          job(id: $id) {
            visits {
              ${JobberClient.visitFields}
            }
          }
        }
      `;

      const data = await client.query(query, { id: args.jobId });
      return { visits: data.job.visits };
    },
  },

  create_job_visit: {
    description: 'Create a new visit for a job',
    inputSchema: z.object({
      jobId: z.string(),
      title: z.string(),
      startAt: z.string().describe('ISO 8601 datetime'),
      endAt: z.string().describe('ISO 8601 datetime'),
      userIds: z.array(z.string()).optional(),
    }),
    execute: async (client: JobberClient, args: any) => {
      const mutation = `
        mutation CreateVisit($input: VisitInput!) {
          visitCreate(input: $input) {
            visit {
              ${JobberClient.visitFields}
            }
            userErrors {
              message
            }
          }
        }
      `;

      const input = {
        jobId: args.jobId,
        title: args.title,
        startAt: args.startAt,
        endAt: args.endAt,
        userIds: args.userIds,
      };

      const data = await client.mutate(mutation, { input });

      if (data.visitCreate.userErrors?.length > 0) {
        throw new Error(`Visit creation failed: ${data.visitCreate.userErrors.map((e: any) => e.message).join(', ')}`);
      }

      return { visit: data.visitCreate.visit };
    },
  },

  list_job_line_items: {
    description: 'List all line items for a specific job',
    inputSchema: z.object({
      jobId: z.string(),
    }),
    execute: async (client: JobberClient, args: any) => {
      const query = `
        query GetJobLineItems($id: EncodedId!)
          job(id: $id) {
            lineItems {
              ${JobberClient.lineItemFields}
            }
          }
        }
      `;

      const data = await client.query(query, { id: args.jobId });
      return { lineItems: data.job.lineItems };
    },
  },

  complete_job: {
    description: 'Mark a job as complete (closes the job)',
    inputSchema: z.object({
      jobId: z.string().describe('The job ID to complete'),
    }),
    execute: async (client: JobberClient, args: any) => {
      const mutation = `
        mutation CompleteJob($id: ID!) {
          jobClose(id: $id) {
            job {
              ${JobberClient.jobFields}
            }
            userErrors {
              message
              path
            }
          }
        }
      `;

      const data = await client.mutate(mutation, { id: args.jobId });

      if (data.jobClose.userErrors?.length > 0) {
        throw new Error(`Job complete failed: ${data.jobClose.userErrors.map((e: any) => e.message).join(', ')}`);
      }

      return { job: data.jobClose.job };
    },
  },

  archive_job: {
    description: 'Archive a job (removes it from active job list)',
    inputSchema: z.object({
      jobId: z.string().describe('The job ID to archive'),
    }),
    execute: async (client: JobberClient, args: any) => {
      const mutation = `
        mutation ArchiveJob($id: ID!) {
          jobArchive(id: $id) {
            job {
              ${JobberClient.jobFields}
            }
            userErrors {
              message
              path
            }
          }
        }
      `;

      const data = await client.mutate(mutation, { id: args.jobId });

      if (data.jobArchive.userErrors?.length > 0) {
        throw new Error(`Job archive failed: ${data.jobArchive.userErrors.map((e: any) => e.message).join(', ')}`);
      }

      return { job: data.jobArchive.job };
    },
  },
};

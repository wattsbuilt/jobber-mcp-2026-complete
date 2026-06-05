/**
 * Jobber GraphQL API Client
 */

import type { JobberConfig, Connection, PaginationVariables } from '../types/jobber.js';

export class JobberClient {
  private apiUrl: string;
  private apiToken: string;

  constructor(config: JobberConfig) {
    this.apiUrl = config.apiUrl || 'https://api.getjobber.com/api/graphql';
    this.apiToken = config.apiToken;
  }

  /**
   * Execute a GraphQL query
   */
  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        'X-JOBBER-GRAPHQL-VERSION': '2025-04-16',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Jobber API error: ${response.status} ${response.statusText}`);
    }

    const result: any = await response.json();

    if (result.errors) {
      throw new Error(
        `GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`
      );
    }

    return result.data;
  }

  /**
   * Execute a GraphQL mutation
   */
  async mutate<T = any>(mutation: string, variables?: Record<string, any>): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  /**
   * Paginate through a connection
   */
  async *paginate<T>(
    queryTemplate: (vars: PaginationVariables) => string,
    extractConnection: (data: any) => Connection<T>,
    pageSize = 50
  ): AsyncGenerator<T> {
    let hasNextPage = true;
    let after: string | undefined;

    while (hasNextPage) {
      const variables: PaginationVariables = { first: pageSize, after };
      const data = await this.query(queryTemplate(variables), variables);
      const connection = extractConnection(data);

      for (const edge of connection.edges) {
        yield edge.node;
      }

      hasNextPage = connection.pageInfo.hasNextPage;
      after = connection.pageInfo.endCursor;
    }
  }

  /**
   * Build GraphQL query with fragments
   */
  static buildQuery(
    operationName: string,
    selections: string,
    variables?: string
  ): string {
    const varsDeclaration = variables ? `(${variables})` : '';
    return `query ${operationName}${varsDeclaration} { ${selections} }`;
  }

  /**
   * Build GraphQL mutation
   */
  static buildMutation(
    operationName: string,
    selections: string,
    variables?: string
  ): string {
    const varsDeclaration = variables ? `(${variables})` : '';
    return `mutation ${operationName}${varsDeclaration} { ${selections} }`;
  }

  /**
   * Standard client fields fragment
   */
  static get clientFields(): string {
    return `
      id
      firstName
      lastName
      companyName
      email
      phone
      isArchived
      createdAt
      updatedAt
      billingAddress {
        street1
        street2
        city
        province
        postalCode
        country
      }
    `;
  }

  /**
   * Standard job fields fragment
   */
  static get jobFields(): string {

    return `

      id

      jobNumber

      title

      instructions

      jobStatus

      createdAt

      updatedAt

      total

      client {

        id

        firstName

        lastName

        companyName

      }

    `;

  }

  /**
   * Standard quote fields fragment
   */
  static get quoteFields(): string {

    return `

      id

      quoteNumber

      title

      quoteStatus

      createdAt

      client {

        id

        firstName

        lastName

        companyName

      }

    `;

  }

  /**
   * Standard invoice fields fragment
   */
  static get invoiceFields(): string {

    return `

      id

      invoiceNumber

      subject

      invoiceStatus

      createdAt

      dueDate

      total

      client {

        id

        firstName

        lastName

        companyName

      }

    `;

  }

  /**
   * Standard visit fields fragment
   */
  static get visitFields(): string {
    return `
      id
      title
      startAt
      endAt
      status
      completedAt
      notes
    `;
  }

  /**
   * Standard line item fields fragment
   */
  static get lineItemFields(): string {
    return `
      id
      name
      description
      quantity
      unitPrice {
        amount
        currency
      }
      total {
        amount
        currency
      }
    `;
  }

  /**
   * Standard user fields fragment
   */
  static get userFields(): string {
    return `
      id
      firstName
      lastName
      email
      role
      isActive
    `;
  }
}

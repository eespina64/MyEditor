/**
 * OJS (Open Journal Systems) API Client
 * Provides integration with OJS REST API v3
 */

export interface OJSConfig {
  baseUrl: string;
  apiKey: string;
  journalPath: string;
}

export interface OJSSubmission {
  id: number;
  title: string;
  abstract?: string;
  status: number;
  statusLabel: string;
  dateSubmitted: string;
  dateLastActivity: string;
  authors: OJSAuthor[];
}

export interface OJSAuthor {
  givenName: string;
  familyName: string;
  email: string;
  affiliation?: string;
}

export interface OJSStats {
  totalSubmissions: number;
  underReview: number;
  accepted: number;
  rejected: number;
  published: number;
}

// OJS Submission statuses
export const OJS_STATUS = {
  QUEUED: 1,
  PUBLISHED: 3,
  DECLINED: 4,
  SCHEDULED: 5
} as const;

export class OJSClient {
  private baseUrl: string;
  private apiKey: string;
  private journalPath: string;

  constructor(config: OJSConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.journalPath = config.journalPath;
  }

  private get apiEndpoint(): string {
    return `${this.baseUrl}/api/v1/${this.journalPath}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiEndpoint}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OJS API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Test connection to OJS
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request('/submissions?count=1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all submissions
   */
  async getSubmissions(params?: {
    count?: number;
    offset?: number;
    status?: number;
    searchPhrase?: string;
  }): Promise<{ items: OJSSubmission[]; itemsMax: number }> {
    const queryParams = new URLSearchParams();

    if (params?.count) queryParams.set('count', params.count.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.status) queryParams.set('status', params.status.toString());
    if (params?.searchPhrase) queryParams.set('searchPhrase', params.searchPhrase);

    const query = queryParams.toString();
    const endpoint = `/submissions${query ? `?${query}` : ''}`;

    return this.request(endpoint);
  }

  /**
   * Get a single submission by ID
   */
  async getSubmission(id: number): Promise<OJSSubmission> {
    return this.request(`/submissions/${id}`);
  }

  /**
   * Get submission statistics
   */
  async getStats(): Promise<OJSStats> {
    try {
      const [queued, published, declined] = await Promise.all([
        this.getSubmissions({ status: OJS_STATUS.QUEUED, count: 1 }),
        this.getSubmissions({ status: OJS_STATUS.PUBLISHED, count: 1 }),
        this.getSubmissions({ status: OJS_STATUS.DECLINED, count: 1 })
      ]);

      const total = queued.itemsMax + published.itemsMax + declined.itemsMax;

      return {
        totalSubmissions: total,
        underReview: queued.itemsMax,
        accepted: 0, // Would need additional API call
        rejected: declined.itemsMax,
        published: published.itemsMax
      };
    } catch (error) {
      console.error('Error fetching OJS stats:', error);
      throw error;
    }
  }

  /**
   * Get current issues
   */
  async getIssues(params?: { count?: number; isPublished?: boolean }): Promise<{ items: unknown[]; itemsMax: number }> {
    const queryParams = new URLSearchParams();

    if (params?.count) queryParams.set('count', params.count.toString());
    if (params?.isPublished !== undefined) queryParams.set('isPublished', params.isPublished.toString());

    const query = queryParams.toString();
    const endpoint = `/issues${query ? `?${query}` : ''}`;

    return this.request(endpoint);
  }

  /**
   * Get users
   */
  async getUsers(params?: {
    count?: number;
    roleIds?: number[];
  }): Promise<{ items: unknown[]; itemsMax: number }> {
    const queryParams = new URLSearchParams();

    if (params?.count) queryParams.set('count', params.count.toString());
    if (params?.roleIds) queryParams.set('roleIds', params.roleIds.join(','));

    const query = queryParams.toString();
    const endpoint = `/users${query ? `?${query}` : ''}`;

    return this.request(endpoint);
  }
}

// Create client from environment variables
export function createOJSClient(): OJSClient | null {
  const baseUrl = process.env.OJS_BASE_URL || process.env.NEXT_PUBLIC_OJS_BASE_URL;
  const apiKey = process.env.OJS_API_KEY;
  const journalPath = process.env.OJS_JOURNAL_PATH || process.env.NEXT_PUBLIC_OJS_JOURNAL_PATH || 'index';

  if (!baseUrl || !apiKey) {
    return null;
  }

  return new OJSClient({ baseUrl, apiKey, journalPath });
}

// Utility function to convert OJS submission to local format
export function ojsSubmissionToArticle(submission: OJSSubmission) {
  return {
    ojsId: submission.id.toString(),
    title: submission.title,
    abstract: submission.abstract,
    authors: submission.authors.map((author, index) => ({
      id: `ojs-${submission.id}-${index}`,
      name: `${author.givenName} ${author.familyName}`,
      email: author.email,
      institution: author.affiliation
    })),
    stage: mapOJSStatusToStage(submission.status),
    priority: 'media' as const,
    submittedAt: new Date(submission.dateSubmitted),
    updatedAt: new Date(submission.dateLastActivity),
    keywords: []
  };
}

function mapOJSStatusToStage(status: number) {
  switch (status) {
    case OJS_STATUS.QUEUED:
      return 'recepcion' as const;
    case OJS_STATUS.PUBLISHED:
      return 'publicacion' as const;
    case OJS_STATUS.DECLINED:
      return 'recepcion' as const;
    case OJS_STATUS.SCHEDULED:
      return 'edicion' as const;
    default:
      return 'evaluacion_inicial' as const;
  }
}

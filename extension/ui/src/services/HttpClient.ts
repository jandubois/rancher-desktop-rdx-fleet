/**
 * HTTP client abstraction layer.
 *
 * This provides a testable interface for making HTTP requests
 * instead of depending directly on the global fetch function.
 */

/** HTTP response interface */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** HTTP client interface */
export interface HttpClient {
  /**
   * Perform a GET request
   * @param url The URL to fetch
   * @param headers Optional headers to include in the request
   * @returns Promise resolving to the response
   */
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

/**
 * Default implementation using the global fetch function.
 */
export class FetchHttpClient implements HttpClient {
  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    const response = await fetch(url, {
      headers: headers,
    });
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: {
        get: (name: string) => response.headers.get(name),
      },
      text: () => response.text(),
      json: () => response.json(),
    };
  }
}

/**
 * Mock HTTP client for testing.
 * Allows setting up expected responses for specific URLs.
 */
export class MockHttpClient implements HttpClient {
  private responses: Map<string, HttpResponse | Error> = new Map();
  private calls: string[] = [];

  /**
   * Set up a mock response for a specific URL
   */
  mockResponse(url: string, response: HttpResponse | Error): void {
    this.responses.set(url, response);
  }

  /**
   * Set up a mock response that matches URLs by pattern
   */
  mockPattern(pattern: RegExp, response: HttpResponse | Error): void {
    // Store pattern matches with a special key format
    this.responses.set(`__pattern__${pattern.source}`, response);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(url: string, _headers?: Record<string, string>): Promise<HttpResponse> {
    this.calls.push(url);

    // Check exact match first
    const exactResponse = this.responses.get(url);
    if (exactResponse) {
      if (exactResponse instanceof Error) {
        throw exactResponse;
      }
      return exactResponse;
    }

    // Check pattern matches
    for (const [key, response] of this.responses) {
      if (key.startsWith('__pattern__')) {
        const pattern = new RegExp(key.replace('__pattern__', ''));
        if (pattern.test(url)) {
          if (response instanceof Error) {
            throw response;
          }
          return response;
        }
      }
    }

    // Default response
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
      text: async () => 'Not Found',
      json: async () => ({ error: 'Not Found' }),
    };
  }

  /** Get all recorded calls */
  getCalls(): string[] {
    return [...this.calls];
  }

  /** Clear recorded calls */
  clearCalls(): void {
    this.calls = [];
  }

  /** Reset all mocks and calls */
  reset(): void {
    this.responses.clear();
    this.calls = [];
  }
}

/**
 * Create a mock HTTP response helper
 */
export function createMockResponse(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string | object;
}): HttpResponse {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    headers = {},
    body = '',
  } = options;

  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    text: async () => bodyStr,
    json: async () => typeof body === 'string' ? JSON.parse(body) : body,
  };
}

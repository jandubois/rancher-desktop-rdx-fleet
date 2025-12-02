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

/**
 * Command execution abstraction layer.
 *
 * This provides a testable interface for executing shell commands (kubectl, helm, etc.)
 * instead of depending directly on ddClient.
 */

/** Result of a command execution */
export interface ExecResult {
  stdout: string;
  stderr: string;
}

/** Interface for executing shell commands */
export interface CommandExecutor {
  /**
   * Execute a command with arguments
   * @param command The command to execute (e.g., 'kubectl', 'helm')
   * @param args Arguments to pass to the command
   * @returns Promise resolving to execution result
   * @throws Error if command fails
   */
  exec(command: string, args: string[]): Promise<ExecResult>;
}

/**
 * Default implementation using Docker Desktop extension client.
 * This wraps the ddClient.extension.host.cli.exec method.
 */
export class DdClientExecutor implements CommandExecutor {
  private ddClient: {
    extension: {
      host?: {
        cli: {
          exec: (command: string, args: string[]) => Promise<ExecResult | undefined>;
        };
      };
    };
  };

  constructor(ddClient: DdClientExecutor['ddClient']) {
    this.ddClient = ddClient;
  }

  async exec(command: string, args: string[]): Promise<ExecResult> {
    const result = await this.ddClient.extension.host?.cli.exec(command, args);
    return {
      stdout: result?.stdout || '',
      stderr: result?.stderr || '',
    };
  }
}

/**
 * Mock executor for testing.
 * Allows setting up expected command responses.
 */
export class MockCommandExecutor implements CommandExecutor {
  private responses: Map<string, ExecResult | Error> = new Map();
  private calls: Array<{ command: string; args: string[] }> = [];

  /**
   * Set up a mock response for a specific command
   * @param command Command string (e.g., 'kubectl')
   * @param args Expected arguments
   * @param response Response to return or Error to throw
   */
  mockResponse(command: string, args: string[], response: ExecResult | Error): void {
    const key = this.makeKey(command, args);
    this.responses.set(key, response);
  }

  /**
   * Set up a mock response that matches any args for a command
   */
  mockCommandResponse(command: string, response: ExecResult | Error): void {
    this.responses.set(`${command}:*`, response);
  }

  async exec(command: string, args: string[]): Promise<ExecResult> {
    this.calls.push({ command, args });

    // Try exact match first
    const key = this.makeKey(command, args);
    let response = this.responses.get(key);

    // Fall back to wildcard match
    if (!response) {
      response = this.responses.get(`${command}:*`);
    }

    if (!response) {
      return { stdout: '', stderr: '' };
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  }

  /** Get all recorded calls */
  getCalls(): Array<{ command: string; args: string[] }> {
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

  private makeKey(command: string, args: string[]): string {
    return `${command}:${JSON.stringify(args)}`;
  }
}

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

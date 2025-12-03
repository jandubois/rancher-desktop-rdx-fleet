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

  /**
   * Execute a command via rd-exec, which ensures ~/.rd/bin is in PATH.
   * This is used for kubectl, helm, rdctl, and other Rancher Desktop CLI tools.
   * @param command The command to execute (e.g., 'kubectl', 'helm', 'rdctl')
   * @param args Arguments to pass to the command
   * @returns Promise resolving to execution result
   */
  rdExec(command: string, args: string[]): Promise<ExecResult>;
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
    // Check if host CLI is available
    if (!this.ddClient.extension.host) {
      console.warn('[CommandExecutor] ddClient.extension.host is undefined - host binaries not available');
      return {
        stdout: '',
        stderr: 'ERROR: ddClient.extension.host is undefined',
      };
    }

    console.log(`[CommandExecutor] exec: ${command} ${args.join(' ')}`);
    const result = await this.ddClient.extension.host.cli.exec(command, args);
    console.log(`[CommandExecutor] result: stdout=${result?.stdout?.length ?? 'undefined'}, stderr=${result?.stderr?.length ?? 'undefined'}`);

    return {
      stdout: result?.stdout || '',
      stderr: result?.stderr || '',
    };
  }

  async rdExec(command: string, args: string[]): Promise<ExecResult> {
    console.log(`[CommandExecutor] rdExec: ${command} ${args.join(' ')}`);
    return this.exec('rd-exec', [command, ...args]);
  }
}

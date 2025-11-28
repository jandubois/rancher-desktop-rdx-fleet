// Error handling utilities

/**
 * Extract error message from various error types
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    const errObj = err as Record<string, unknown>;
    if (errObj.stderr) return String(errObj.stderr);
    if (errObj.message) return String(errObj.message);
    return JSON.stringify(err);
  }
  return String(err);
}

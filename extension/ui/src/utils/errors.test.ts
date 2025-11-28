import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('extracts message from Error object', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  it('extracts stderr from exec result object', () => {
    const execResult = { stderr: 'kubectl: command not found' };
    expect(getErrorMessage(execResult)).toBe('kubectl: command not found');
  });

  it('extracts message property from objects', () => {
    const errorObj = { message: 'API error occurred' };
    expect(getErrorMessage(errorObj)).toBe('API error occurred');
  });

  it('prefers stderr over message when both present', () => {
    const execResult = {
      stderr: 'stderr output',
      message: 'message property'
    };
    expect(getErrorMessage(execResult)).toBe('stderr output');
  });

  it('JSON stringifies unknown objects', () => {
    const unknownObj = { code: 404, status: 'Not Found' };
    expect(getErrorMessage(unknownObj)).toBe('{"code":404,"status":"Not Found"}');
  });

  it('handles plain strings', () => {
    expect(getErrorMessage('plain error string')).toBe('plain error string');
  });

  it('handles numbers', () => {
    expect(getErrorMessage(42)).toBe('42');
  });

  it('handles null', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('handles undefined', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('handles empty string', () => {
    expect(getErrorMessage('')).toBe('');
  });

  it('handles empty object', () => {
    expect(getErrorMessage({})).toBe('{}');
  });
});

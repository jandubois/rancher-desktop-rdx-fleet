/**
 * Tests for AuthGitHubCard UI components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RateLimitDisplay } from './RateLimitDisplay';
import { CredentialHelperWarning, GhCliStatusInfo } from './StatusAlerts';
import { GhCliAuthOption } from './GhCliAuthOption';
import { PatInputForm } from './PatInputForm';

describe('RateLimitDisplay', () => {
  const defaultProps = {
    rateLimit: {
      limit: 5000,
      remaining: 4500,
      reset: Math.floor(Date.now() / 1000) + 3600,
    },
    onRefresh: vi.fn(),
  };

  it('displays rate limit information', () => {
    render(<RateLimitDisplay {...defaultProps} />);

    expect(screen.getByText(/API Rate Limit:/)).toBeInTheDocument();
    expect(screen.getByText(/4,500/)).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(<RateLimitDisplay {...defaultProps} onRefresh={onRefresh} />);

    const refreshButton = screen.getByRole('button');
    fireEvent.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows warning chip when remaining is below threshold', () => {
    render(
      <RateLimitDisplay
        {...defaultProps}
        rateLimit={{ ...defaultProps.rateLimit, remaining: 50 }}
        warningThreshold={100}
      />
    );

    expect(screen.getByText(/Resets at/)).toBeInTheDocument();
  });

  it('does not show warning chip when remaining is above threshold', () => {
    render(
      <RateLimitDisplay
        {...defaultProps}
        rateLimit={{ ...defaultProps.rateLimit, remaining: 200 }}
        warningThreshold={100}
      />
    );

    expect(screen.queryByText(/Resets at/)).not.toBeInTheDocument();
  });

  it('shows suffix when provided', () => {
    render(<RateLimitDisplay {...defaultProps} suffix="unauthenticated" />);

    expect(screen.getByText(/\(unauthenticated\)/)).toBeInTheDocument();
  });
});

describe('CredentialHelperWarning', () => {
  it('returns null when credential helper is available', () => {
    const { container } = render(
      <CredentialHelperWarning
        credHelperStatus={{
          available: true,
          helper: 'secretservice',
          configured: true,
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows warning when credential helper is not available', () => {
    render(
      <CredentialHelperWarning
        credHelperStatus={{
          available: false,
          helper: '',
          configured: false,
        }}
      />
    );

    expect(screen.getByText(/No credential helper configured/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows debug info when provided', () => {
    render(
      <CredentialHelperWarning
        credHelperStatus={{
          available: false,
          helper: '',
          configured: false,
          debug: 'Could not find docker-credential-secretservice',
        }}
      />
    );

    expect(screen.getByText(/Could not find docker-credential-secretservice/)).toBeInTheDocument();
  });
});

describe('GhCliStatusInfo', () => {
  it('returns null when gh CLI is installed and authenticated', () => {
    const { container } = render(
      <GhCliStatusInfo
        ghAuthStatus={{
          installed: true,
          authenticated: true,
          user: 'testuser',
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows info when gh CLI is not installed', () => {
    render(
      <GhCliStatusInfo
        ghAuthStatus={{
          installed: false,
          authenticated: false,
        }}
      />
    );

    expect(screen.getByText(/not found/)).toBeInTheDocument();
    expect(screen.getByText(/To use gh CLI token/)).toBeInTheDocument();
  });

  it('shows info when gh CLI is installed but not authenticated', () => {
    render(
      <GhCliStatusInfo
        ghAuthStatus={{
          installed: true,
          authenticated: false,
        }}
      />
    );

    expect(screen.getByText(/installed/)).toBeInTheDocument();
    expect(screen.getByText(/not authenticated/)).toBeInTheDocument();
  });

  it('shows debug info when provided', () => {
    render(
      <GhCliStatusInfo
        ghAuthStatus={{
          installed: false,
          authenticated: false,
          debug: 'gh: command not found',
        }}
      />
    );

    expect(screen.getByText(/gh: command not found/)).toBeInTheDocument();
  });
});

describe('GhCliAuthOption', () => {
  const defaultProps = {
    ghAuthStatus: {
      installed: true,
      authenticated: true,
      user: 'testuser',
    },
    onUseGhToken: vi.fn(),
    isLoading: false,
  };

  it('renders with user info', () => {
    render(<GhCliAuthOption {...defaultProps} />);

    // Look for the heading specifically (h6)
    expect(screen.getByRole('heading', { name: /Use gh CLI Token/ })).toBeInTheDocument();
    expect(screen.getByText(/@testuser/)).toBeInTheDocument();
  });

  it('shows Recommended chip', () => {
    render(<GhCliAuthOption {...defaultProps} />);

    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('calls onUseGhToken when button is clicked', () => {
    const onUseGhToken = vi.fn();
    render(<GhCliAuthOption {...defaultProps} onUseGhToken={onUseGhToken} />);

    const button = screen.getByRole('button', { name: /Use gh CLI Token/i });
    fireEvent.click(button);

    expect(onUseGhToken).toHaveBeenCalledTimes(1);
  });

  it('disables button when loading', () => {
    render(<GhCliAuthOption {...defaultProps} isLoading={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows loading text when loading', () => {
    render(<GhCliAuthOption {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('renders without user info when user is not set', () => {
    render(
      <GhCliAuthOption
        {...defaultProps}
        ghAuthStatus={{ installed: true, authenticated: false }}
      />
    );

    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});

describe('PatInputForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isLoading: false,
  };

  it('renders input form', () => {
    render(<PatInputForm {...defaultProps} />);

    expect(screen.getByText('Personal Access Token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Token/i })).toBeInTheDocument();
  });

  it('calls onSubmit with trimmed input', () => {
    const onSubmit = vi.fn();
    render(<PatInputForm {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx');
    fireEvent.change(input, { target: { value: '  ghp_test123  ' } });

    const button = screen.getByRole('button', { name: /Save Token/i });
    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalledWith('ghp_test123');
  });

  it('clears input after submission', () => {
    render(<PatInputForm {...defaultProps} />);

    const input = screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ghp_test123' } });
    expect(input.value).toBe('ghp_test123');

    const button = screen.getByRole('button', { name: /Save Token/i });
    fireEvent.click(button);

    expect(input.value).toBe('');
  });

  it('disables input and button when loading', () => {
    render(<PatInputForm {...defaultProps} isLoading={true} />);

    const input = screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx');
    const button = screen.getByRole('button');

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('disables input and button when disabled prop is true', () => {
    render(<PatInputForm {...defaultProps} disabled={true} />);

    const input = screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx');
    const button = screen.getByRole('button');

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });

  it('submits on Enter key', () => {
    const onSubmit = vi.fn();
    render(<PatInputForm {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx');
    fireEvent.change(input, { target: { value: 'ghp_test123' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('ghp_test123');
  });

  it('does not submit with empty input', () => {
    const onSubmit = vi.fn();
    render(<PatInputForm {...defaultProps} onSubmit={onSubmit} />);

    const button = screen.getByRole('button', { name: /Save Token/i });
    fireEvent.click(button);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('has link to GitHub token creation', () => {
    render(<PatInputForm {...defaultProps} />);

    const link = screen.getByRole('link', { name: /Create token on GitHub/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('github.com/settings/tokens'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('disables button when input is only whitespace', () => {
    render(<PatInputForm {...defaultProps} />);

    const input = screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx');
    fireEvent.change(input, { target: { value: '   ' } });

    const button = screen.getByRole('button', { name: /Save Token/i });
    expect(button).toBeDisabled();
  });
});

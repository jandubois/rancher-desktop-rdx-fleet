/**
 * Tests for AuthAppCoCard UI components
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppCoInputForm } from './AppCoInputForm';

describe('AppCoInputForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isLoading: false,
    disabled: false,
  };

  it('renders username and token input fields', () => {
    render(<AppCoInputForm {...defaultProps} />);

    expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Access Token/i)).toBeInTheDocument();
  });

  it('renders authenticate button', () => {
    render(<AppCoInputForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Authenticate/i })).toBeInTheDocument();
  });

  it('disables button when username is empty', () => {
    render(<AppCoInputForm {...defaultProps} />);

    const tokenInput = screen.getByLabelText(/Access Token/i);
    fireEvent.change(tokenInput, { target: { value: 'my-token' } });

    expect(screen.getByRole('button', { name: /Authenticate/i })).toBeDisabled();
  });

  it('disables button when token is empty', () => {
    render(<AppCoInputForm {...defaultProps} />);

    const usernameInput = screen.getByLabelText(/Username or Email/i);
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });

    expect(screen.getByRole('button', { name: /Authenticate/i })).toBeDisabled();
  });

  it('enables button when both fields have values', () => {
    render(<AppCoInputForm {...defaultProps} />);

    const usernameInput = screen.getByLabelText(/Username or Email/i);
    const tokenInput = screen.getByLabelText(/Access Token/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(tokenInput, { target: { value: 'my-token' } });

    expect(screen.getByRole('button', { name: /Authenticate/i })).toBeEnabled();
  });

  it('calls onSubmit with credentials when button is clicked', () => {
    const onSubmit = vi.fn();
    render(<AppCoInputForm {...defaultProps} onSubmit={onSubmit} />);

    const usernameInput = screen.getByLabelText(/Username or Email/i);
    const tokenInput = screen.getByLabelText(/Access Token/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(tokenInput, { target: { value: 'my-token' } });
    fireEvent.click(screen.getByRole('button', { name: /Authenticate/i }));

    expect(onSubmit).toHaveBeenCalledWith('testuser', 'my-token');
  });

  it('clears token after submission', () => {
    render(<AppCoInputForm {...defaultProps} />);

    const usernameInput = screen.getByLabelText(/Username or Email/i);
    const tokenInput = screen.getByLabelText(/Access Token/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(tokenInput, { target: { value: 'my-token' } });
    fireEvent.click(screen.getByRole('button', { name: /Authenticate/i }));

    expect(tokenInput).toHaveValue('');
  });

  it('shows loading text when isLoading is true', () => {
    render(<AppCoInputForm {...defaultProps} isLoading={true} />);

    expect(screen.getByRole('button', { name: /Authenticating/i })).toBeInTheDocument();
  });

  it('disables inputs when isLoading is true', () => {
    render(<AppCoInputForm {...defaultProps} isLoading={true} />);

    expect(screen.getByLabelText(/Username or Email/i)).toBeDisabled();
    expect(screen.getByLabelText(/Access Token/i)).toBeDisabled();
  });

  it('disables inputs when disabled prop is true', () => {
    render(<AppCoInputForm {...defaultProps} disabled={true} />);

    expect(screen.getByLabelText(/Username or Email/i)).toBeDisabled();
    expect(screen.getByLabelText(/Access Token/i)).toBeDisabled();
  });

  it('renders links to AppCo account and documentation', () => {
    render(<AppCoInputForm {...defaultProps} />);

    expect(screen.getByRole('link', { name: /Get Account/i })).toHaveAttribute(
      'href',
      'https://apps.rancher.io'
    );
    expect(screen.getByRole('link', { name: /Documentation/i })).toHaveAttribute(
      'href',
      'https://apps.rancher.io/docs'
    );
  });

  it('submits on Enter key in token field', () => {
    const onSubmit = vi.fn();
    render(<AppCoInputForm {...defaultProps} onSubmit={onSubmit} />);

    const usernameInput = screen.getByLabelText(/Username or Email/i);
    const tokenInput = screen.getByLabelText(/Access Token/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(tokenInput, { target: { value: 'my-token' } });
    fireEvent.keyDown(tokenInput, { key: 'Enter', code: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('testuser', 'my-token');
  });

  it('does not submit on Enter key when fields are empty', () => {
    const onSubmit = vi.fn();
    render(<AppCoInputForm {...defaultProps} onSubmit={onSubmit} />);

    const tokenInput = screen.getByLabelText(/Access Token/i);
    fireEvent.keyDown(tokenInput, { key: 'Enter', code: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows help text about credentials', () => {
    render(<AppCoInputForm {...defaultProps} />);

    expect(
      screen.getByText(/Use your SUSE Application Collection account credentials/i)
    ).toBeInTheDocument();
  });
});

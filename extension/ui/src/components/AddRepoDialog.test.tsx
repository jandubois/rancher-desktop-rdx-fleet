import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRepoDialog } from './AddRepoDialog';

describe('AddRepoDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onAdd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    render(<AddRepoDialog {...defaultProps} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repository url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders dialog title', () => {
    render(<AddRepoDialog {...defaultProps} />);

    expect(screen.getByText('Add Git Repository')).toBeInTheDocument();
  });

  it('has default values for name and URL', () => {
    render(<AddRepoDialog {...defaultProps} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('fleet-examples');
    expect(screen.getByLabelText(/repository url/i)).toHaveValue('https://github.com/rancher/fleet-examples');
    expect(screen.getByLabelText(/branch/i)).toHaveValue('');
  });

  it('calls onAdd with form values', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ success: true });

    render(<AddRepoDialog {...defaultProps} onAdd={onAdd} />);

    // Clear and type new values
    const nameInput = screen.getByLabelText(/name/i);
    const urlInput = screen.getByLabelText(/repository url/i);
    const branchInput = screen.getByLabelText(/branch/i);

    await user.clear(nameInput);
    await user.type(nameInput, 'my-repo');
    await user.clear(urlInput);
    await user.type(urlInput, 'https://github.com/owner/repo');
    await user.type(branchInput, 'develop');

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('my-repo', 'https://github.com/owner/repo', 'develop');
    });
  });

  it('calls onAdd with undefined branch when branch is empty', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ success: true });

    render(<AddRepoDialog {...defaultProps} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('fleet-examples', 'https://github.com/rancher/fleet-examples', undefined);
    });
  });

  it('closes dialog on successful add', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();

    render(<AddRepoDialog {...defaultProps} onAdd={onAdd} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays error message when add fails', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ success: false, error: 'Repository already exists' });

    render(<AddRepoDialog {...defaultProps} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('Repository already exists')).toBeInTheDocument();
    });
  });

  it('displays fallback error when add fails without error message', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ success: false });

    render(<AddRepoDialog {...defaultProps} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to add repository/i)).toBeInTheDocument();
    });
  });

  it('displays error message when add throws', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<AddRepoDialog {...defaultProps} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('closes on cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<AddRepoDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('disables add button when name is empty', async () => {
    const user = userEvent.setup();

    render(<AddRepoDialog {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);

    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
  });

  it('disables add button when URL is empty', async () => {
    const user = userEvent.setup();

    render(<AddRepoDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText(/repository url/i);
    await user.clear(urlInput);

    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
  });

  it('shows "Adding..." text while submitting', async () => {
    const user = userEvent.setup();
    let resolveAdd: (value: { success: boolean }) => void;
    const addPromise = new Promise<{ success: boolean }>((resolve) => {
      resolveAdd = resolve;
    });
    const onAdd = vi.fn().mockReturnValue(addPromise);

    render(<AddRepoDialog {...defaultProps} onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(screen.getByRole('button', { name: /adding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();

    // Complete the add
    resolveAdd!({ success: true });
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('does not render when closed', () => {
    render(<AddRepoDialog {...defaultProps} open={false} />);

    // MUI Dialog should not be visible when open is false
    expect(screen.queryByText('Add Git Repository')).not.toBeInTheDocument();
  });

  it('shows helper text for fields', () => {
    render(<AddRepoDialog {...defaultProps} />);

    expect(screen.getByText(/unique name for this gitrepo resource/i)).toBeInTheDocument();
    expect(screen.getByText(/git repository url/i)).toBeInTheDocument();
    expect(screen.getByText(/branch to track/i)).toBeInTheDocument();
  });
});

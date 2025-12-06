import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditRepoDialog } from './EditRepoDialog';

describe('EditRepoDialog', () => {
  const defaultProps = {
    open: true,
    currentName: 'test-repo',
    currentUrl: 'https://github.com/owner/repo',
    currentBranch: 'main',
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    render(<EditRepoDialog {...defaultProps} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repository url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders dialog title', () => {
    render(<EditRepoDialog {...defaultProps} />);

    expect(screen.getByText('Edit Repository')).toBeInTheDocument();
  });

  it('pre-fills fields with current values', () => {
    render(<EditRepoDialog {...defaultProps} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('test-repo');
    expect(screen.getByLabelText(/repository url/i)).toHaveValue('https://github.com/owner/repo');
    expect(screen.getByLabelText(/branch/i)).toHaveValue('main');
  });

  it('handles empty branch', () => {
    render(<EditRepoDialog {...defaultProps} currentBranch={undefined} />);

    expect(screen.getByLabelText(/branch/i)).toHaveValue('');
  });

  it('calls onSave with old and new values when form is changed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<EditRepoDialog {...defaultProps} onSave={onSave} />);

    // Change name
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'new-repo');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('test-repo', 'new-repo', 'https://github.com/owner/repo', 'main');
    });
  });

  it('calls onSave with changed URL', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<EditRepoDialog {...defaultProps} onSave={onSave} />);

    const urlInput = screen.getByLabelText(/repository url/i);
    await user.clear(urlInput);
    await user.type(urlInput, 'https://github.com/other/repo');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('test-repo', 'test-repo', 'https://github.com/other/repo', 'main');
    });
  });

  it('calls onSave with undefined branch when branch is cleared', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<EditRepoDialog {...defaultProps} onSave={onSave} />);

    const branchInput = screen.getByLabelText(/branch/i);
    await user.clear(branchInput);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('test-repo', 'test-repo', 'https://github.com/owner/repo', undefined);
    });
  });

  it('closes dialog on successful save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<EditRepoDialog {...defaultProps} onSave={onSave} onClose={onClose} />);

    // Make a change first
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'changed');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays error message when save throws', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Name already exists'));

    render(<EditRepoDialog {...defaultProps} onSave={onSave} />);

    // Make a change first
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'changed');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('Name already exists')).toBeInTheDocument();
    });
  });

  it('closes on cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<EditRepoDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('disables save button when name is empty', async () => {
    const user = userEvent.setup();

    render(<EditRepoDialog {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('disables save button when URL is empty', async () => {
    const user = userEvent.setup();

    render(<EditRepoDialog {...defaultProps} />);

    const urlInput = screen.getByLabelText(/repository url/i);
    await user.clear(urlInput);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('disables save button when no changes have been made', () => {
    render(<EditRepoDialog {...defaultProps} />);

    // Save should be disabled because nothing has changed
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables save button when changes are made', async () => {
    const user = userEvent.setup();

    render(<EditRepoDialog {...defaultProps} />);

    // Initially disabled
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

    // Make a change
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'changed-name');

    // Now enabled
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('shows "Saving..." text while submitting', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(savePromise);

    render(<EditRepoDialog {...defaultProps} onSave={onSave} />);

    // Make a change
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'changed');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    // Complete the save
    resolveSave!();
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('does not render when closed', () => {
    render(<EditRepoDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Edit Repository')).not.toBeInTheDocument();
  });

  it('shows helper text for fields', () => {
    render(<EditRepoDialog {...defaultProps} />);

    expect(screen.getByText(/unique name for this gitrepo resource/i)).toBeInTheDocument();
    expect(screen.getByText(/git repository url/i)).toBeInTheDocument();
    expect(screen.getByText(/branch to track/i)).toBeInTheDocument();
  });

  it('shows warning about path clearing', () => {
    render(<EditRepoDialog {...defaultProps} />);

    expect(screen.getByText(/changing the repository url will clear all selected paths/i)).toBeInTheDocument();
  });

  it('resets form when opened with new props', async () => {
    const { rerender } = render(<EditRepoDialog {...defaultProps} open={false} />);

    // Open with new values
    rerender(
      <EditRepoDialog
        {...defaultProps}
        open={true}
        currentName="different-repo"
        currentUrl="https://github.com/different/url"
        currentBranch="develop"
      />
    );

    expect(screen.getByLabelText(/name/i)).toHaveValue('different-repo');
    expect(screen.getByLabelText(/repository url/i)).toHaveValue('https://github.com/different/url');
    expect(screen.getByLabelText(/branch/i)).toHaveValue('develop');
  });
});

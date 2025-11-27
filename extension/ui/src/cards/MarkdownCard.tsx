import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { CardProps } from './types';
import { MarkdownCardSettings } from '../manifest/types';
import { registerCard } from './registry';

// Simple markdown to HTML converter
// Supports: headers, bold, italic, links, code, lists, paragraphs
function renderMarkdown(markdown: string): string {
  let html = markdown
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 style="margin: 0.5em 0;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin: 0.5em 0;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin: 0.5em 0;">$1</h2>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Code
    .replace(/`(.+?)`/g, '<code style="background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px;">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap in paragraph
  html = '<p>' + html + '</p>';

  // Fix empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

export const MarkdownCard: React.FC<CardProps<MarkdownCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const content = settings?.content || '';

  const renderedHtml = useMemo(() => renderMarkdown(content), [content]);

  if (editMode && onSettingsChange) {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            {definition.title}
          </Typography>
        )}
        <TextField
          multiline
          fullWidth
          minRows={3}
          maxRows={10}
          value={content}
          onChange={(e) => onSettingsChange({ ...settings, content: e.target.value })}
          placeholder="Enter markdown content..."
          variant="outlined"
          size="small"
        />
        {content && (
          <Box sx={{ mt: 2, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Preview:
            </Typography>
            <Box
              sx={{ '& a': { color: 'primary.main' }, '& p': { m: 0 } }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {definition.title && (
        <Typography variant="h6" gutterBottom>
          {definition.title}
        </Typography>
      )}
      <Box
        sx={{
          '& a': { color: 'primary.main' },
          '& p': { m: 0 },
          '& h2, & h3, & h4': { color: 'text.primary' },
        }}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </Box>
  );
};

// Register the markdown card
registerCard('markdown', MarkdownCard);

export default MarkdownCard;

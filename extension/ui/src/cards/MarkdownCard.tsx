import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { CardProps } from './types';
import { MarkdownCardSettings } from '../manifest/types';
import { registerCard } from './registry';

export const MarkdownCard: React.FC<CardProps<MarkdownCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const content = settings?.content || '';

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
              sx={{
                '& a': { color: 'primary.main' },
                '& p': { m: 0 },
                '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 1, mb: 0.5 },
              }}
            >
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
            </Box>
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
          '& h1, & h2, & h3, & h4, & h5, & h6': { color: 'text.primary', mt: 1, mb: 0.5 },
        }}
      >
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
      </Box>
    </Box>
  );
};

// Register the markdown card
registerCard('markdown', MarkdownCard, {
  label: 'Markdown Content',
  orderable: true,
  category: 'content',
  defaultSettings: () => ({ content: '# New Card\n\nEdit this content...' }),
});

export default MarkdownCard;

import React, { useRef, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { CardProps } from './types';
import { HtmlCardSettings } from '../manifest/types';
import { registerCard } from './registry';

/**
 * HtmlCard - Renders raw HTML content including <script> elements
 *
 * Unlike MarkdownCard which sanitizes HTML, this card uses an iframe with
 * document.write to allow scripts to execute with full network access.
 *
 * Use cases:
 * - Stock tickers
 * - Weather widgets
 * - Third-party embed scripts
 * - Interactive visualizations
 */
export const HtmlCard: React.FC<CardProps<HtmlCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const content = settings?.content || '';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(200);
  const [iframeKey, setIframeKey] = useState(0);

  // Build the full HTML document for the iframe
  const buildIframeDocument = (htmlContent: string): string => {
    // Check if content already has html/body tags
    const hasHtmlStructure = /<html|<body/i.test(htmlContent);

    if (hasHtmlStructure) {
      return htmlContent;
    }

    // Wrap content in a basic HTML document with sensible defaults
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
  };

  // Write content to iframe using document.write
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !content) return;

    // Wait for iframe to be ready
    const writeContent = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(buildIframeDocument(content));
          doc.close();

          // Auto-resize after content loads
          const checkHeight = () => {
            try {
              const height = doc.body?.scrollHeight || 200;
              setIframeHeight(Math.max(height + 20, 100));
            } catch {
              setIframeHeight(200);
            }
          };

          // Check height after scripts have a chance to run
          setTimeout(checkHeight, 100);
          setTimeout(checkHeight, 500);
          setTimeout(checkHeight, 1500);
        }
      } catch (e) {
        console.error('Failed to write to iframe:', e);
      }
    };

    // Small delay to ensure iframe is mounted
    const timer = setTimeout(writeContent, 50);
    return () => clearTimeout(timer);
  }, [content, iframeKey, editMode]);

  // Force iframe recreation when content or editMode changes
  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [content, editMode]);

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
          minRows={5}
          maxRows={15}
          value={content}
          onChange={(e) => onSettingsChange({ ...settings, content: e.target.value })}
          placeholder="Enter HTML content (scripts allowed)..."
          variant="outlined"
          size="small"
          sx={{ fontFamily: 'monospace' }}
          InputProps={{
            sx: { fontFamily: 'monospace', fontSize: '0.85rem' },
          }}
        />
        {content && (
          <Box sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', p: 1, bgcolor: 'action.hover' }}
            >
              Preview:
            </Typography>
            <Box
              key={iframeKey}
              component="iframe"
              ref={iframeRef}
              sx={{
                width: '100%',
                height: iframeHeight,
                border: 'none',
                display: 'block',
              }}
              title={definition.title || 'HTML preview'}
            />
          </Box>
        )}
      </Box>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <Box>
      {definition.title && (
        <Typography variant="h6" gutterBottom>
          {definition.title}
        </Typography>
      )}
      <Box
        key={iframeKey}
        component="iframe"
        ref={iframeRef}
        sx={{
          width: '100%',
          height: iframeHeight,
          border: 'none',
          display: 'block',
          borderRadius: 1,
        }}
        title={definition.title || 'HTML content'}
      />
    </Box>
  );
};

// Register the html card
registerCard('html', HtmlCard);

export default HtmlCard;

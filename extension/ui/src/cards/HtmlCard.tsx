import React, { useRef, useEffect, useState, useMemo } from 'react';
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
 * a blob URL to allow scripts to execute with full network access.
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

  // Create blob URL for the iframe content
  const blobUrl = useMemo(() => {
    if (!content) return null;
    const html = buildIframeDocument(content);
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [content]);

  // Clean up blob URL on unmount or content change
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Auto-resize iframe based on content
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !content) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          // Get the content height and add some padding
          const height = doc.body.scrollHeight || 200;
          setIframeHeight(Math.max(height + 20, 100));
        }
      } catch {
        // Cross-origin restrictions may prevent access
        setIframeHeight(200);
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [content]);

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
              component="iframe"
              ref={iframeRef}
              src={blobUrl || 'about:blank'}
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
        component="iframe"
        ref={iframeRef}
        src={blobUrl || 'about:blank'}
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

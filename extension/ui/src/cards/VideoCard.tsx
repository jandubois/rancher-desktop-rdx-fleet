import React, { useRef, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { CardProps } from './types';
import { VideoCardSettings } from '../manifest/types';
import { registerCard } from './registry';
import { CardTitle } from './CardTitle';

// Convert YouTube/Vimeo URLs to embed URLs
function getEmbedUrl(url: string): { type: 'embed' | 'video'; url: string } {
  // YouTube URLs
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (youtubeMatch) {
    return { type: 'embed', url: `https://www.youtube.com/embed/${youtubeMatch[1]}` };
  }

  // Vimeo URLs
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeoMatch) {
    return { type: 'embed', url: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  // Direct video URL
  return { type: 'video', url };
}

export const VideoCard: React.FC<CardProps<VideoCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const src = settings?.src || '';
  const title = settings?.title || '';

  if (editMode && onSettingsChange) {
    return (
      <Box>
        <CardTitle title={definition.title} />
        <TextField
          fullWidth
          label="Video URL"
          value={src}
          onChange={(e) => onSettingsChange({ ...settings, src: e.target.value })}
          placeholder="https://youtube.com/watch?v=... or direct video URL"
          variant="outlined"
          size="small"
          helperText="Supports YouTube, Vimeo, or direct video URLs (.mp4, .webm)"
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Title (optional)"
          value={title}
          onChange={(e) => onSettingsChange({ ...settings, title: e.target.value })}
          placeholder="Video title for accessibility"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
        {src && (
          <Box sx={{ mt: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Preview:
            </Typography>
            <VideoPlayer src={src} title={title} />
          </Box>
        )}
      </Box>
    );
  }

  if (!src) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No video configured</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <CardTitle title={definition.title} />
      <VideoPlayer src={src} title={title} />
    </Box>
  );
};

/**
 * VideoPlayer - Renders embedded videos using document.write to bypass CSP restrictions
 *
 * Uses the same approach as HtmlCard - creates an iframe without a src attribute
 * and uses document.write to inject the video embed content. This bypasses
 * Rancher Desktop's CSP restrictions on external iframe sources.
 */
const VideoPlayer: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const { type, url } = getEmbedUrl(src);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Generate a unique key when src changes to force iframe recreation
  const iframeKey = useMemo(() => {
    return `video-${src.length}-${src.slice(0, 50)}`;
  }, [src]);

  // Build the HTML document for the embed iframe
  const buildEmbedDocument = (embedUrl: string, embedTitle: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <iframe
    src="${embedUrl}"
    title="${embedTitle || 'Embedded video'}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</body>
</html>`;
  };

  // Write content to iframe using document.write (bypasses CSP restrictions)
  useEffect(() => {
    if (type !== 'embed') return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const writeContent = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(buildEmbedDocument(url, title));
          doc.close();
        }
      } catch (e) {
        console.error('Failed to write video embed to iframe:', e);
      }
    };

    // Small delay to ensure iframe is mounted
    const timer = setTimeout(writeContent, 50);
    return () => clearTimeout(timer);
  }, [type, url, title, iframeKey]);

  if (type === 'embed') {
    return (
      <Box
        sx={{
          position: 'relative',
          paddingBottom: '56.25%', // 16:9 aspect ratio
          height: 0,
          overflow: 'hidden',
          borderRadius: 1,
        }}
      >
        <Box
          key={iframeKey}
          component="iframe"
          ref={iframeRef}
          title={title || 'Embedded video'}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: 1,
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      component="video"
      controls
      src={url}
      title={title}
      sx={{
        maxWidth: '100%',
        maxHeight: 400,
        borderRadius: 1,
        display: 'block',
      }}
    >
      Your browser does not support the video tag.
    </Box>
  );
};

// Register the video card
registerCard('video', VideoCard, {
  label: 'Video Embed',
  orderable: true,
  category: 'content',
  defaultSettings: () => ({ src: '', title: '' }),
});

export default VideoCard;

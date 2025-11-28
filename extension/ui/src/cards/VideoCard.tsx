import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { CardProps } from './types';
import { VideoCardSettings } from '../manifest/types';
import { registerCard } from './registry';

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
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            {definition.title}
          </Typography>
        )}
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
      {definition.title && (
        <Typography variant="h6" gutterBottom>
          {definition.title}
        </Typography>
      )}
      <VideoPlayer src={src} title={title} />
    </Box>
  );
};

// Separate component for rendering video to avoid duplication
const VideoPlayer: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const { type, url } = getEmbedUrl(src);

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
          component="iframe"
          src={url}
          title={title || 'Embedded video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
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
registerCard('video', VideoCard);

export default VideoCard;

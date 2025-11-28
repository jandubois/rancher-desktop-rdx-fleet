import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CardProps } from './types';
import { LinkCardSettings, LinkItem } from '../manifest/types';
import { registerCard } from './registry';

export const LinkCard: React.FC<CardProps<LinkCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const links = settings?.links || [];
  const variant = settings?.variant || 'buttons';

  const handleAddLink = () => {
    if (onSettingsChange) {
      onSettingsChange({
        ...settings,
        links: [...links, { label: '', url: '' }],
      });
    }
  };

  const handleRemoveLink = (index: number) => {
    if (onSettingsChange) {
      const newLinks = links.filter((_, i) => i !== index);
      onSettingsChange({
        ...settings,
        links: newLinks,
      });
    }
  };

  const handleUpdateLink = (index: number, field: keyof LinkItem, value: string) => {
    if (onSettingsChange) {
      const newLinks = links.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      );
      onSettingsChange({
        ...settings,
        links: newLinks,
      });
    }
  };

  const handleVariantChange = (_: React.MouseEvent<HTMLElement>, newVariant: 'buttons' | 'list') => {
    if (newVariant && onSettingsChange) {
      onSettingsChange({
        ...settings,
        variant: newVariant,
      });
    }
  };

  if (editMode && onSettingsChange) {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            {definition.title}
          </Typography>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Display Style:
          </Typography>
          <ToggleButtonGroup
            value={variant}
            exclusive
            onChange={handleVariantChange}
            size="small"
          >
            <ToggleButton value="buttons">Buttons</ToggleButton>
            <ToggleButton value="list">List</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Stack spacing={2}>
          {links.map((link, index) => (
            <Box
              key={index}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label="Label"
                    value={link.label}
                    onChange={(e) => handleUpdateLink(index, 'label', e.target.value)}
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    label="URL"
                    value={link.url}
                    onChange={(e) => handleUpdateLink(index, 'url', e.target.value)}
                    placeholder="https://..."
                    variant="outlined"
                    size="small"
                  />
                </Box>
                <IconButton
                  onClick={() => handleRemoveLink(index)}
                  color="error"
                  size="small"
                  sx={{ mt: 0.5 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Stack>

        <Button
          startIcon={<AddIcon />}
          onClick={handleAddLink}
          variant="outlined"
          size="small"
          sx={{ mt: 2 }}
        >
          Add Link
        </Button>
      </Box>
    );
  }

  if (links.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No links configured</Typography>
      </Box>
    );
  }

  // Filter out empty links
  const validLinks = links.filter((link) => link.label && link.url);

  if (validLinks.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No valid links</Typography>
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

      {variant === 'buttons' ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {validLinks.map((link, index) => (
            <Button
              key={index}
              variant="outlined"
              size="small"
              startIcon={<LinkIcon />}
              endIcon={<OpenInNewIcon fontSize="small" />}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none' }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      ) : (
        <List dense disablePadding>
          {validLinks.map((link, index) => (
            <ListItem key={index} disablePadding>
              <ListItemButton
                component="a"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                <ListItemText primary={link.label} />
                <OpenInNewIcon fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

// Register the link card
registerCard('link', LinkCard);

export default LinkCard;

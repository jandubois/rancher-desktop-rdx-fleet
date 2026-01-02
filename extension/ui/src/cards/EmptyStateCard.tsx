/**
 * Reusable empty state component for cards.
 * Renders a centered message when no content is configured.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface EmptyStateCardProps {
  message?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  message = 'No content configured',
}) => (
  <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
    <Typography variant="body2">{message}</Typography>
  </Box>
);

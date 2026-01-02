/**
 * Reusable card title component.
 * Renders the card title with consistent Typography styling.
 */

import Typography from '@mui/material/Typography';

interface CardTitleProps {
  title?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ title }) => {
  if (!title) return null;
  return (
    <Typography variant="h6" gutterBottom>
      {title}
    </Typography>
  );
};

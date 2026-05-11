import { Paper, Stack, Typography } from '@mui/material';

export function HomePage() {
  return (
    <Paper sx={{ p: 3 }} variant="outlined">
      <Stack spacing={1}>
        <Typography component="h1" variant="h5">
          Elemika Correction
        </Typography>
        <Typography color="text.secondary">
          Local frontend shell is running. Correction UI starts in Phase 3.
        </Typography>
      </Stack>
    </Paper>
  );
}

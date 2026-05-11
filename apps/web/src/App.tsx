import { Container, CssBaseline } from '@mui/material';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';

export function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <RouterProvider router={router} />
      </Container>
    </>
  );
}

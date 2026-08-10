import { Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();

  return <Alert severity="warning">{t('router.notFound')}</Alert>;
}

import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormHelperText,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from 'https://esm.sh/@mui/material@9.0.1?deps=react@18.3.1,react-dom@18.3.1,@emotion/react@11.14.0,@emotion/styled@11.14.0';
import {
  ThemeProvider,
  createTheme,
} from 'https://esm.sh/@mui/material@9.0.1/styles?deps=react@18.3.1,react-dom@18.3.1,@emotion/react@11.14.0,@emotion/styled@11.14.0';

const html = htm.bind(React.createElement);

const TOKENS = {
  accent: 'oklch(58% 0.16 145)',
  bg: 'oklch(98% 0.005 250)',
  border: 'oklch(90% 0.008 240)',
  danger: 'oklch(62% 0.22 28)',
  fg: 'oklch(22% 0.02 240)',
  muted: 'oklch(50% 0.018 240)',
  success: 'oklch(62% 0.16 154)',
  surface: 'oklch(100% 0 0)',
  surfaceAlt: 'oklch(97% 0.006 240)',
  warn: 'oklch(74% 0.15 85)',
};

const DEMO_USER = {
  displayName: 'Alicia Chen',
  email: 'test2@test.com',
  password: 'pass1234',
  role: 'Correction lead',
};

const SESSION_ROWS = [
  {
    confidence: 64,
    documentId: 'INV-2047',
    documentType: 'Supplier invoice',
    id: 'SES-2047',
    issues: 2,
    priority: 'Needs review',
    status: 'In review',
    updatedAt: '2026-05-15T18:10:00Z',
    version: 7,
  },
  {
    confidence: 82,
    documentId: 'INV-2038',
    documentType: 'Supplier invoice',
    id: 'SES-2038',
    issues: 1,
    priority: 'Ready to submit',
    status: 'Draft updated',
    updatedAt: '2026-05-15T16:42:00Z',
    version: 4,
  },
  {
    confidence: 58,
    documentId: 'BOL-7811',
    documentType: 'Bill of lading',
    id: 'SES-7811',
    issues: 3,
    priority: 'Escalate',
    status: 'In review',
    updatedAt: '2026-05-15T15:30:00Z',
    version: 2,
  },
  {
    confidence: 93,
    documentId: 'INV-2009',
    documentType: 'Supplier invoice',
    id: 'SES-2009',
    issues: 0,
    priority: 'Ready to submit',
    status: 'Ready',
    updatedAt: '2026-05-15T13:14:00Z',
    version: 9,
  },
  {
    confidence: 77,
    documentId: 'INV-1986',
    documentType: 'Supplier invoice',
    id: 'SES-1986',
    issues: 1,
    priority: 'Needs review',
    status: 'Draft updated',
    updatedAt: '2026-05-14T20:48:00Z',
    version: 5,
  },
  {
    confidence: 89,
    documentId: 'PO-1197',
    documentType: 'Purchase order',
    id: 'SES-1197',
    issues: 0,
    priority: 'Ready to submit',
    status: 'Ready',
    updatedAt: '2026-05-14T18:02:00Z',
    version: 3,
  },
];

const SESSION_GROUPS = [
  {
    fields: [
      {
        confidence: 98,
        evidence: 'Supplier header matches the registry record exactly.',
        key: 'supplierName',
        label: 'Supplier name',
        originalValue: 'NORTHWIND PAPER GMBH',
        source: 'OCR + registry',
        type: 'text',
        value: 'Northwind Paper GmbH',
      },
      {
        confidence: 64,
        evidence:
          'Invoice identifier is faint near the upper-right corner. OCR read “INV-2O47” with O/0 ambiguity.',
        key: 'invoiceNumber',
        label: 'Invoice number',
        originalValue: 'INV-2O47',
        source: 'OCR',
        type: 'text',
        value: 'INV-2047',
      },
      {
        confidence: 87,
        evidence: 'Issue date appears in the summary block beside the supplier VAT number.',
        key: 'issueDate',
        label: 'Issue date',
        originalValue: '2026-04-11',
        source: 'OCR',
        type: 'date',
        value: '2026-04-11',
      },
      {
        confidence: 51,
        evidence:
          'Due date is partially cropped in the scan footer. Keep this field in the first review pass.',
        key: 'dueDate',
        label: 'Due date',
        originalValue: '2026-05-17',
        source: 'OCR',
        type: 'date',
        value: '2026-05-11',
      },
    ],
    title: 'Header fields',
  },
  {
    fields: [
      {
        confidence: 99,
        evidence: 'Currency is consistent across header, tax summary, and line-item totals.',
        key: 'currency',
        label: 'Currency',
        options: ['EUR', 'USD', 'GBP'],
        originalValue: 'EUR',
        source: 'ERP sync',
        type: 'select',
        value: 'EUR',
      },
      {
        confidence: 72,
        evidence:
          'Net amount and tax amount reconcile cleanly, but the line-item tax layout is condensed.',
        key: 'netAmount',
        label: 'Net amount',
        originalValue: '12,480.00',
        source: 'OCR',
        type: 'number',
        value: '12480.00',
      },
      {
        confidence: 96,
        evidence: 'Tax amount is aligned with the VAT line and matches the extracted value.',
        key: 'taxAmount',
        label: 'Tax amount',
        originalValue: '2,496.00',
        source: 'OCR',
        type: 'number',
        value: '2496.00',
      },
      {
        confidence: 93,
        evidence: 'Total amount is consistent with the net and tax totals.',
        key: 'totalAmount',
        label: 'Total amount',
        originalValue: '14,976.00',
        source: 'OCR + calculated',
        type: 'number',
        value: '14976.00',
      },
    ],
    title: 'Amounts',
  },
  {
    fields: [
      {
        confidence: 66,
        evidence:
          'Cost center came from the downstream intake file rather than the invoice itself.',
        key: 'costCenter',
        label: 'Cost center',
        originalValue: 'F1N-OPS-04',
        source: 'Downstream intake',
        type: 'text',
        value: 'FIN-OPS-04',
      },
      {
        confidence: 81,
        evidence:
          'Purchase order sits beneath the supplier address block and is legible after normalization.',
        key: 'purchaseOrder',
        label: 'Purchase order',
        originalValue: 'PO-77831',
        source: 'OCR',
        type: 'text',
        value: 'PO-77831',
      },
      {
        confidence: 38,
        evidence: 'Payment terms are not present in the currently connected source asset.',
        key: 'paymentTerms',
        label: 'Payment terms',
        originalValue: '—',
        required: true,
        source: 'Missing',
        type: 'text',
        value: '',
      },
    ],
    title: 'Accounting references',
  },
];

const LINE_ITEMS = [
  {
    confidence: 94,
    description: 'A4 copy paper, 80gsm',
    net: '8,960.00',
    quantity: '320',
    sku: 'PAPER-A4-80',
  },
  {
    confidence: 69,
    description: 'Thermal labels, 100x150',
    net: '3,520.00',
    quantity: '88',
    sku: 'LBL-100-150',
  },
];

const theme = createTheme({
  palette: {
    background: { default: TOKENS.bg, paper: TOKENS.surface },
    error: { main: TOKENS.danger },
    mode: 'light',
    primary: { main: TOKENS.accent },
    success: { main: TOKENS.success },
    text: { primary: TOKENS.fg, secondary: TOKENS.muted },
    warning: { main: TOKENS.warn },
  },
  shape: { borderRadius: 14 },
  typography: {
    body1: { fontSize: 15.5, lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none' },
    fontFamily: 'var(--font-body)',
    h1: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(2.2rem, 3vw, 3.35rem)',
      fontWeight: 700,
      letterSpacing: '-0.045em',
    },
    h2: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(1.65rem, 2vw, 2.35rem)',
      fontWeight: 700,
      letterSpacing: '-0.04em',
    },
    h3: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.45rem',
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h4: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.15rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    subtitle2: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
  },
  components: {
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'color-mix(in oklab, var(--surface) 88%, white)',
          borderBottom: '1px solid var(--border)',
          boxShadow: 'none',
          color: 'var(--fg)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          backgroundColor: 'var(--accent)',
          boxShadow: 'none',
          color: 'white',
        },
        outlined: {
          borderColor: 'var(--border)',
        },
        root: {
          borderRadius: 12,
          minHeight: 42,
          paddingInline: 18,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            'linear-gradient(to bottom, color-mix(in oklab, var(--accent) 5%, transparent), transparent 34%), linear-gradient(to right, color-mix(in oklab, var(--border) 74%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 74%, transparent) 1px, transparent 1px), var(--bg)',
          backgroundSize: 'auto, 24px 24px, 24px 24px, auto',
          color: 'var(--fg)',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          backgroundColor: 'var(--surface)',
          backgroundImage: 'none',
          borderColor: 'var(--border)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: 'var(--surface)',
          },
        },
      },
    },
  },
});

function statusChipProps(status) {
  if (status === 'Ready') {
    return { color: 'success', label: status, variant: 'filled' };
  }
  if (status === 'In review') {
    return { color: 'warning', label: status, variant: 'filled' };
  }
  return { color: 'default', label: status, variant: 'outlined' };
}

function confidenceLabel(confidence) {
  if (confidence >= 90) return 'High confidence';
  if (confidence >= 75) return 'Needs a quick review';
  return 'Review first';
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function StatusChip({ status }) {
  const props = statusChipProps(status);
  return html` <${Chip} color=${props.color} label=${props.label} variant=${props.variant} /> `;
}

function App() {
  const screen = document.body.dataset.screen;
  const viewport = document.body.dataset.viewport;

  let content;
  if (screen === 'signup') content = html`<${AuthPage} kind="signup" viewport=${viewport} />`;
  if (screen === 'login') content = html`<${AuthPage} kind="login" viewport=${viewport} />`;
  if (screen === 'dashboard') content = html`<${DashboardPage} viewport=${viewport} />`;
  if (screen === 'session') content = html`<${SessionPage} viewport=${viewport} />`;

  return html`
    <${ThemeProvider} theme=${theme}>
      <${CssBaseline} />
      ${content}
    </${ThemeProvider}>
  `;
}

function PageFrame({ children, viewport, noContainer = false }) {
  const isMobile = viewport === 'mobile';

  return html`
    <${Box}
      sx=${{
        minHeight: '100%',
        paddingBottom: isMobile ? 10 : 0,
      }}
    >
      ${
        noContainer
          ? children
          : html`
            <${Container}
              maxWidth=${false}
              sx=${{
                marginInline: 'auto',
                maxWidth: isMobile ? 460 : 1440,
                paddingInline: isMobile ? 2 : 4,
                paddingTop: isMobile ? 2 : 4,
                width: '100%',
              }}
            >
              ${children}
            </${Container}>
          `
      }
    </${Box}>
  `;
}

function TopBar({ title, subtitle, right, viewport, backHref = '../index.html' }) {
  return html`
    <${AppBar} position="sticky">
      <${Toolbar}
        sx=${{
          alignItems: viewport === 'mobile' ? 'flex-start' : 'center',
          gap: 2,
          minHeight: viewport === 'mobile' ? 78 : 72,
          paddingInline: viewport === 'mobile' ? 2 : 4,
        }}
      >
        <${Stack} spacing=${0.5} sx=${{ flex: 1, minWidth: 0 }}>
          <${Breadcrumbs} separator="·" sx=${{ fontSize: 12 }}>
            <${Typography} color="text.secondary" variant="subtitle2">AspectLoop</${Typography}>
            <${Typography} color="text.secondary" variant="subtitle2">Correction flows</${Typography}>
          </${Breadcrumbs}>
          <${Typography} variant="h3">${title}</${Typography}>
          ${subtitle ? html`<${Typography} color="text.secondary">${subtitle}</${Typography}>` : null}
        </${Stack}>
        <${Stack} direction="row" spacing=${1.5} sx=${{ alignItems: 'center', flexShrink: 0 }}>
          ${right}
          <${Button} href=${backHref} variant="outlined">Launcher</${Button}>
        </${Stack}>
      </${Toolbar}>
    </${AppBar}>
  `;
}

function AuthPage({ kind, viewport }) {
  const isMobile = viewport === 'mobile';
  const [values, setValues] = useState(
    kind === 'signup' ? { displayName: '', email: '', password: '' } : { email: '', password: '' },
  );
  const [touched, setTouched] = useState({});
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const errors = useMemo(() => {
    const next = {};
    if (kind === 'signup' && !values.displayName.trim()) {
      next.displayName = 'Display name is required.';
    }
    if (!values.email.trim()) {
      next.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!values.password.trim()) {
      next.password = 'Password is required.';
    } else if (values.password.length < 8) {
      next.password = 'Password must be at least 8 characters long.';
    }
    return next;
  }, [kind, values]);

  const showError = (field) => touched[field] && errors[field];
  const isValid = Object.keys(errors).length === 0;

  useEffect(() => {
    if (!banner || banner.intent !== 'success' || !banner.href) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      window.location.href = banner.href;
    }, 900);
    return () => window.clearTimeout(timer);
  }, [banner]);

  function updateField(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    setBanner(null);
  }

  function markAllTouched() {
    setTouched({
      displayName: true,
      email: true,
      password: true,
    });
  }

  function submitForm(event) {
    event.preventDefault();
    markAllTouched();

    if (!isValid) {
      setBanner({ intent: 'warning', message: 'Fix the highlighted fields to continue.' });
      return;
    }

    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      if (kind === 'login') {
        if (values.email === DEMO_USER.email && values.password === DEMO_USER.password) {
          setBanner({
            href:
              viewport === 'mobile'
                ? './corrections-dashboard-mobile.html'
                : './corrections-dashboard-desktop.html',
            intent: 'success',
            message: 'Signed in. Opening your correction inbox…',
          });
          return;
        }
        setBanner({
          intent: 'error',
          message: 'Could not sign you in. Check your email and password and try again.',
        });
        return;
      }

      setBanner({
        href: viewport === 'mobile' ? './login-mobile.html' : './login-desktop.html',
        intent: 'success',
        message: 'Account created. Sign in to continue.',
      });
    }, 420);
  }

  const title =
    kind === 'signup'
      ? 'Create your review workspace'
      : 'Review extracted data with evidence at hand';
  const subtitle =
    kind === 'signup'
      ? 'Create an account to access the correction inbox.'
      : 'Sign in to open your correction inbox.';

  const hero = html`
    <${Paper}
      sx=${{
        background:
          'linear-gradient(160deg, color-mix(in oklab, var(--accent) 10%, white), var(--surface) 48%)',
        display: 'grid',
        gap: 2,
        minHeight: isMobile ? 'auto' : 520,
        padding: isMobile ? 2.5 : 4,
      }}
    >
      <${Typography} color="text.secondary" variant="subtitle2">Evidence desk / access path</${Typography}>
      <${Typography} variant="h2">${kind === 'signup' ? 'Create your correction seat.' : 'Re-enter the live review queue.'}</${Typography}>
      <${Typography} color="text.secondary">
        Quiet surfaces, immediate validation, and the same evidence-first posture the correction workspace uses later in the flow.
      </${Typography}>
      <${Stack} spacing=${1.5}>
        ${[
          'Draft values keep a visible source and confidence trail.',
          'Local token state clears immediately on sign-out.',
          'Inbox sessions open back into the active review context.',
        ].map(
          (item, index) => html`
            <${Paper}
              key=${item}
              sx=${{
                alignItems: 'center',
                display: 'grid',
                gap: 1,
                gridTemplateColumns: '40px 1fr',
                padding: 2,
              }}
            >
              <${Avatar}
                sx=${{
                  background:
                    index === 1
                      ? `color-mix(in oklab, ${TOKENS.warn} 18%, white)`
                      : 'color-mix(in oklab, var(--accent) 18%, white)',
                  color: 'var(--fg)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  height: 40,
                  width: 40,
                }}
              >
                0${index + 1}
              </${Avatar}>
              <${Typography}>${item}</${Typography}>
            </${Paper}>
          `,
        )}
      </${Stack}>
      ${
        kind === 'login'
          ? html`
            <${Paper} sx=${{ padding: 2 }}>
              <${Typography} color="text.secondary" variant="subtitle2">Seeded reviewer access</${Typography}>
              <${Typography} sx=${{ fontFamily: 'var(--font-mono)', fontSize: 14, marginTop: 1 }}>
                ${DEMO_USER.email} / ${DEMO_USER.password}
              </${Typography}>
            </${Paper}>
          `
          : null
      }
    </${Paper}>
  `;

  const form = html`
    <${Paper} sx=${{ padding: isMobile ? 2.5 : 4 }}>
      <${Stack} component="form" onSubmit=${submitForm} spacing=${2.25}>
        <${Typography} color="text.secondary" variant="subtitle2">${kind === 'signup' ? 'Sign up' : 'Sign in'}</${Typography}>
        <${Typography} variant="h2">${title}</${Typography}>
        <${Typography} color="text.secondary">${subtitle}</${Typography}>
        ${banner ? html`<${Alert} severity=${banner.intent}>${banner.message}</${Alert}>` : null}
        ${
          kind === 'signup'
            ? html`
              <${Box}>
                <${TextField}
                  error=${Boolean(showError('displayName'))}
                  fullWidth=${true}
                  label="Display name"
                  onBlur=${() => setTouched((current) => ({ ...current, displayName: true }))}
                  onChange=${(event) => updateField('displayName', event.target.value)}
                  value=${values.displayName}
                />
                ${
                  showError('displayName')
                    ? html`<${FormHelperText} error=${true}>${errors.displayName}</${FormHelperText}>`
                    : null
                }
              </${Box}>
            `
            : null
        }
        <${Box}>
          <${TextField}
            error=${Boolean(showError('email'))}
            fullWidth=${true}
            label="Email"
            onBlur=${() => setTouched((current) => ({ ...current, email: true }))}
            onChange=${(event) => updateField('email', event.target.value)}
            type="email"
            value=${values.email}
          />
          ${showError('email') ? html`<${FormHelperText} error=${true}>${errors.email}</${FormHelperText}>` : null}
        </${Box}>
        <${Box}>
          <${TextField}
            error=${Boolean(showError('password'))}
            fullWidth=${true}
            label="Password"
            onBlur=${() => setTouched((current) => ({ ...current, password: true }))}
            onChange=${(event) => updateField('password', event.target.value)}
            type="password"
            value=${values.password}
          />
          ${
            showError('password')
              ? html`<${FormHelperText} error=${true}>${errors.password}</${FormHelperText}>`
              : null
          }
        </${Box}>
        <${Stack} direction=${isMobile ? 'column' : 'row'} spacing=${1.5}>
          <${Button} disabled=${submitting} type="submit" variant="contained">
            ${kind === 'signup' ? 'Create account' : 'Sign in'}
          </${Button}>
          <${Button}
            href=${
              kind === 'signup'
                ? viewport === 'mobile'
                  ? './login-mobile.html'
                  : './login-desktop.html'
                : viewport === 'mobile'
                  ? './signup-mobile.html'
                  : './signup-desktop.html'
            }
            variant="text"
          >
            ${kind === 'signup' ? 'I already have an account' : 'Create account'}
          </${Button}>
        </${Stack}>
        <${LinearProgress}
          sx=${{
            '& .MuiLinearProgress-bar': { backgroundColor: 'var(--accent)' },
            backgroundColor: 'color-mix(in oklab, var(--accent) 14%, white)',
            borderRadius: 999,
            height: 8,
          }}
          value=${isValid ? 100 : 33}
          variant="determinate"
        />
      </${Stack}>
    </${Paper}>
  `;

  return html`
    <${PageFrame} viewport=${viewport}>
      <${Box}
        sx=${{
          alignItems: 'stretch',
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
          minHeight: isMobile ? 'auto' : 'calc(100vh - 56px)',
        }}
      >
        ${kind === 'signup' && isMobile ? [form, hero] : [hero, form]}
      </${Box}>
    </${PageFrame}>
  `;
}

function DashboardPage({ viewport }) {
  const isMobile = viewport === 'mobile';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredSessions = useMemo(
    () =>
      SESSION_ROWS.filter((session) => {
        const matchesQuery =
          !query ||
          session.documentId.toLowerCase().includes(query.toLowerCase()) ||
          session.documentType.toLowerCase().includes(query.toLowerCase());
        const matchesFilter =
          filter === 'all' ||
          (filter === 'review' && session.issues > 0) ||
          (filter === 'ready' && session.issues === 0) ||
          (filter === 'priority' && session.confidence < 70);
        return matchesQuery && matchesFilter;
      }),
    [filter, query],
  );

  const stats = {
    active: SESSION_ROWS.filter((row) => row.status === 'In review').length,
    lowConfidence: SESSION_ROWS.filter((row) => row.confidence < 70).length,
    ready: SESSION_ROWS.filter((row) => row.issues === 0).length,
  };

  const right = html`
    <${Chip} label=${DEMO_USER.role} variant="outlined" />
    <${Avatar} sx=${{ background: 'color-mix(in oklab, var(--accent) 18%, white)', color: 'var(--fg)' }}>
      AC
    </${Avatar}>
  `;

  const summaryCards = [
    { label: 'Assigned to me', value: String(SESSION_ROWS.length) },
    { label: 'Review first', value: String(stats.lowConfidence) },
    { label: 'Ready to submit', value: String(stats.ready) },
  ].map(
    (item) => html`
      <${Paper}
        key=${item.label}
        sx=${{
          minWidth: isMobile ? 200 : 'auto',
          padding: 2.25,
        }}
      >
        <${Typography} color="text.secondary" variant="subtitle2">${item.label}</${Typography}>
        <${Typography} sx=${{ marginTop: 1 }} variant="h2">${item.value}</${Typography}>
      </${Paper}>
    `,
  );

  return html`
    <${PageFrame} noContainer=${true} viewport=${viewport}>
      <${TopBar}
        right=${right}
        subtitle="Open an active review session and continue where you left off."
        title="Correction inbox"
        viewport=${viewport}
      />
      <${Container}
        maxWidth=${false}
        sx=${{
          marginInline: 'auto',
          maxWidth: 1440,
          paddingInline: isMobile ? 2 : 4,
          paddingTop: 3,
        }}
      >
        <${Stack} spacing=${2.5}>
          <${Box}
            sx=${{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: isMobile ? '1fr' : '2.1fr 0.9fr',
            }}
          >
            <${Paper} sx=${{ padding: 2.5 }}>
              <${Stack} spacing=${2}>
                <${Stack} direction="row" justifyContent="space-between" spacing=${2}>
                  <${Typography} variant="h3">Today’s active queue</${Typography}>
                  <${Chip} color="warning" label="${stats.active} live sessions" />
                </${Stack}>
                <${Stack} direction=${isMobile ? 'column' : 'row'} spacing=${1.5} sx=${{ overflowX: 'auto' }}>
                  ${summaryCards}
                </${Stack}>
                <${Stack} direction=${isMobile ? 'column' : 'row'} spacing=${1.25}>
                  <${TextField}
                    fullWidth=${true}
                    label="Search documents"
                    onChange=${(event) => setQuery(event.target.value)}
                    value=${query}
                  />
                  <${Stack} direction="row" spacing=${1} sx=${{ flexWrap: 'wrap' }}>
                    ${[
                      ['all', 'All'],
                      ['review', 'Needs review'],
                      ['ready', 'Ready'],
                      ['priority', 'Low confidence'],
                    ].map(
                      ([value, label]) => html`
                        <${Chip}
                          clickable=${true}
                          color=${filter === value ? 'success' : 'default'}
                          key=${value}
                          label=${label}
                          onClick=${() => setFilter(value)}
                          variant=${filter === value ? 'filled' : 'outlined'}
                        />
                      `,
                    )}
                  </${Stack}>
                </${Stack}>
              </${Stack}>
            </${Paper}>
            <${Paper} sx=${{ padding: 2.5 }}>
              <${Stack} spacing=${2}>
                <${Typography} variant="h4">Queue health</${Typography}>
                <${MetricBar} label="Ready coverage" value=${Math.round((stats.ready / SESSION_ROWS.length) * 100)} />
                <${MetricBar} label="Low-confidence load" value=${Math.round((stats.lowConfidence / SESSION_ROWS.length) * 100)} tone="warning" />
                <${MetricBar} label="Assigned throughput" value=${72} />
                <${Typography} color="text.secondary">
                  New sessions appear here when documents are ready for review. The evidence-first workspace stays one click away.
                </${Typography}>
              </${Stack}>
            </${Paper}>
          </${Box}>

          ${
            filteredSessions.length === 0
              ? html`
                <${Paper} sx=${{ padding: 4 }}>
                  <${Typography} variant="h3">No correction sessions yet</${Typography}>
                  <${Typography} color="text.secondary" sx=${{ marginTop: 1 }}>
                    New sessions will appear here when documents are ready for review.
                  </${Typography}>
                </${Paper}>
              `
              : isMobile
                ? html`
                  <${Stack} spacing=${1.5}>
                    ${filteredSessions.map(
                      (session) => html`
                        <${Paper} key=${session.id} sx=${{ padding: 2.25 }}>
                          <${Stack} spacing=${1.5}>
                            <${Stack} direction="row" justifyContent="space-between" spacing=${1.5}>
                              <${Box}>
                                <${Typography} variant="h4">${session.documentId}</${Typography}>
                                <${Typography} color="text.secondary">${session.documentType}</${Typography}>
                              </${Box}>
                              <${Chip}
                                color=${session.confidence < 70 ? 'warning' : session.issues === 0 ? 'success' : 'default'}
                                label=${confidenceLabel(session.confidence)}
                                variant="outlined"
                              />
                            </${Stack}>
                            <${Stack} direction="row" spacing=${1} sx=${{ flexWrap: 'wrap' }}>
                              <${StatusChip} status=${session.status} />
                              <${Chip} label="v${session.version}" variant="outlined" />
                              <${Chip} label="${session.issues} issues" variant="outlined" />
                            </${Stack}>
                            <${Typography} color="text.secondary">Updated ${formatDate(session.updatedAt)}</${Typography}>
                            <${Button} href="./correction-session-mobile.html" variant="contained">Open session</${Button}>
                          </${Stack}>
                        </${Paper}>
                      `,
                    )}
                  </${Stack}>
                `
                : html`
                  <${Paper} sx=${{ overflow: 'hidden' }}>
                    <${Table}>
                      <${TableHead}>
                        <${TableRow}>
                          <${TableCell}>Document ID</${TableCell}>
                          <${TableCell}>Type</${TableCell}>
                          <${TableCell}>Status</${TableCell}>
                          <${TableCell}>Version</${TableCell}>
                          <${TableCell}>Updated</${TableCell}>
                          <${TableCell}>Confidence</${TableCell}>
                          <${TableCell} align="right">Action</${TableCell}>
                        </${TableRow}>
                      </${TableHead}>
                      <${TableBody}>
                        ${filteredSessions.map(
                          (session) => html`
                            <${TableRow} key=${session.id} hover=${true}>
                              <${TableCell}>
                                <${Typography} sx=${{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>${session.documentId}</${Typography}>
                              </${TableCell}>
                              <${TableCell}>${session.documentType}</${TableCell}>
                              <${TableCell}><${StatusChip} status=${session.status} /></${TableCell}>
                              <${TableCell}>v${session.version}</${TableCell}>
                              <${TableCell}>${formatDate(session.updatedAt)}</${TableCell}>
                              <${TableCell}>
                                <${Stack} spacing=${0.75}>
                                  <${Typography}>${confidenceLabel(session.confidence)}</${Typography}>
                                  <${LinearProgress}
                                    sx=${{
                                      '& .MuiLinearProgress-bar': {
                                        backgroundColor:
                                          session.confidence < 70 ? TOKENS.warn : TOKENS.accent,
                                      },
                                      backgroundColor:
                                        'color-mix(in oklab, var(--border) 60%, white)',
                                      borderRadius: 999,
                                      height: 6,
                                    }}
                                    value=${session.confidence}
                                    variant="determinate"
                                  />
                                </${Stack}>
                              </${TableCell}>
                              <${TableCell} align="right">
                                <${Button} href="./correction-session-desktop.html" variant="contained">Open session</${Button}>
                              </${TableCell}>
                            </${TableRow}>
                          `,
                        )}
                      </${TableBody}>
                    </${Table}>
                  </${Paper}>
                `
          }
        </${Stack}>
      </${Container}>
    </${PageFrame}>
  `;
}

function MetricBar({ label, value, tone = 'success' }) {
  return html`
    <${Stack} spacing=${0.75}>
      <${Stack} direction="row" justifyContent="space-between">
        <${Typography}>${label}</${Typography}>
        <${Typography} color="text.secondary">${value}%</${Typography}>
      </${Stack}>
      <${LinearProgress}
        sx=${{
          '& .MuiLinearProgress-bar': {
            backgroundColor: tone === 'warning' ? TOKENS.warn : TOKENS.accent,
          },
          backgroundColor: 'color-mix(in oklab, var(--border) 60%, white)',
          borderRadius: 999,
          height: 8,
        }}
        value=${value}
        variant="determinate"
      />
    </${Stack}>
  `;
}

function SessionPage({ viewport }) {
  const isMobile = viewport === 'mobile';
  const [fields, setFields] = useState(() =>
    SESSION_GROUPS.map((group) => ({
      ...group,
      fields: group.fields.map((field) => ({ ...field })),
    })),
  );
  const [selectedField, setSelectedField] = useState('invoiceNumber');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState(0);

  const flatFields = useMemo(
    () =>
      fields.flatMap((group) => group.fields.map((field) => ({ ...field, group: group.title }))),
    [fields],
  );
  const validationIssues = useMemo(() => {
    const issues = [];
    flatFields.forEach((field) => {
      if (field.required && !field.value.trim()) {
        issues.push(`${field.label} is required before submission.`);
      }
      if (field.confidence < 70) {
        issues.push(`${field.label} still needs evidence review.`);
      }
    });
    return Array.from(new Set(issues));
  }, [flatFields]);
  const reviewFirst = flatFields.filter((field) => field.confidence < 70);
  const activeField = flatFields.find((field) => field.key === selectedField) ?? flatFields[0];
  const progressValue = Math.max(
    24,
    Math.round(((flatFields.length - validationIssues.length / 2) / flatFields.length) * 100),
  );

  function updateField(key, value) {
    setFields((current) =>
      current.map((group) => ({
        ...group,
        fields: group.fields.map((field) => (field.key === key ? { ...field, value } : field)),
      })),
    );
    setSelectedField(key);
  }

  const right = html`
    <${Chip} color="warning" label="In review" />
    <${Chip} label="Version 7" variant="outlined" />
    <${Button} href=${isMobile ? './corrections-dashboard-mobile.html' : './corrections-dashboard-desktop.html'} variant="outlined">
      Back to inbox
    </${Button}>
  `;

  const summary = html`
    <${Paper} sx=${{ padding: 2.5 }}>
      <${Stack} spacing=${1.5}>
        <${Typography} color="text.secondary" variant="subtitle2">Workspace title</${Typography}>
        <${Typography} variant="h2">Supplier invoice review</${Typography}>
        <${Stack} direction="row" spacing=${1} sx=${{ flexWrap: 'wrap' }}>
          <${Chip} label="Session SES-2047" variant="outlined" />
          <${Chip} label="Invoice INV-2047" variant="outlined" />
          <${Chip} color="warning" label="${reviewFirst.length} review-first fields" />
        </${Stack}>
        <${Typography} color="text.secondary">
          Persistent validation and conflict surfaces stay visible while the document preview remains a placeholder.
        </${Typography}>
        <${MetricBar} label="Review completion" value=${progressValue} />
      </${Stack}>
    </${Paper}>
  `;

  const validationPanel = html`
    <${Paper} sx=${{ padding: 2.25, position: isMobile ? 'static' : 'sticky', top: 96 }}>
      <${Stack} spacing=${2}>
        <${Typography} variant="h4">Review first</${Typography}>
        <${List} disablePadding=${true}>
          ${reviewFirst.map(
            (field) => html`
              <${ListItem} disablePadding=${true} key=${field.key}>
                <${ListItemButton} onClick=${() => setSelectedField(field.key)} selected=${selectedField === field.key}>
                  <${ListItemText}
                    primary=${field.label}
                    secondary=${`${field.confidence}% confidence · ${field.group}`}
                  />
                </${ListItemButton}>
              </${ListItem}>
            `,
          )}
        </${List}>
        <${Divider} />
        <${Typography} variant="h4">Validation summary</${Typography}>
        <${Alert} severity=${validationIssues.length ? 'warning' : 'success'}>
          ${validationIssues.length ? `${validationIssues.length} items still need attention.` : 'All required fields are ready to submit.'}
        </${Alert}>
        <${List} dense=${true}>
          ${validationIssues.map(
            (issue) => html`
              <${ListItem} key=${issue}>
                <${ListItemText} primary=${issue} />
              </${ListItem}>
            `,
          )}
        </${List}>
      </${Stack}>
    </${Paper}>
  `;

  const evidencePanel = html`
    <${Paper} sx=${{ padding: 2.25, position: isMobile ? 'static' : 'sticky', top: 96 }}>
      <${Stack} spacing=${2}>
        <${Typography} variant="h4">Source evidence</${Typography}>
        <${Alert} severity="info">Document preview is not yet connected to a source asset.</${Alert}>
        <${Paper}
          sx=${{
            background: `color-mix(in oklab, ${TOKENS.surfaceAlt} 80%, white)`,
            borderStyle: 'dashed',
            padding: 2,
          }}
        >
          <${Typography} color="text.secondary" variant="subtitle2">Active field</${Typography}>
          <${Typography} sx=${{ marginTop: 1 }} variant="h4">${activeField.label}</${Typography}>
          <${Typography} color="text.secondary" sx=${{ marginTop: 0.5 }}>
            ${activeField.evidence}
          </${Typography}>
        </${Paper}>
        <${Paper} sx=${{ padding: 2 }}>
          <${Typography} color="text.secondary" variant="subtitle2">Original value</${Typography}>
          <${Typography} sx=${{ fontFamily: 'var(--font-mono)', marginTop: 1 }}>${activeField.originalValue}</${Typography}>
          <${Stack} direction="row" spacing=${1} sx=${{ flexWrap: 'wrap', marginTop: 2 }}>
            <${Chip} label=${activeField.source} variant="outlined" />
            <${Chip}
              color=${activeField.confidence < 70 ? 'warning' : 'success'}
              label=${`${activeField.confidence}% confidence`}
              variant="outlined"
            />
          </${Stack}>
        </${Paper}>
        <${Paper} sx=${{ padding: 2 }}>
          <${Typography} color="text.secondary" variant="subtitle2">Recent provenance</${Typography}>
          <${List} dense=${true}>
            <${ListItem}><${ListItemText} primary="OCR extraction seeded the draft value" secondary="14 May · 18:03" /></${ListItem}>
            <${ListItem}><${ListItemText} primary="ERP sync enriched currency and supplier registry match" secondary="14 May · 18:06" /></${ListItem}>
            <${ListItem}><${ListItemText} primary="Local draft remains unpublished" secondary="15 May · 18:10" /></${ListItem}>
          </${List}>
        </${Paper}>
      </${Stack}>
    </${Paper}>
  `;

  const fieldGroups = fields.map(
    (group) => html`
      <${Accordion} defaultExpanded=${true} key=${group.title}>
        <${AccordionSummary} expandIcon=${html`<${Typography} component="span">+</${Typography}>`}>
          <${Stack} spacing=${0.4}>
            <${Typography} variant="h4">${group.title}</${Typography}>
            <${Typography} color="text.secondary">
              ${group.fields.filter((field) => field.confidence < 70).length} items need review-first attention
            </${Typography}>
          </${Stack}>
        </${AccordionSummary}>
        <${AccordionDetails}>
          <${Stack} spacing=${1.5}>
            ${group.fields.map(
              (field) => html`
                <${Paper}
                  key=${field.key}
                  sx=${{
                    borderColor: selectedField === field.key ? 'var(--accent)' : 'var(--border)',
                    padding: 2,
                  }}
                >
                  <${Stack} spacing=${1.2}>
                    <${Stack} direction="row" justifyContent="space-between" spacing=${1.5} sx=${{ alignItems: 'flex-start' }}>
                      <${Box}>
                        <${Typography} variant="h4">${field.label}</${Typography}>
                        <${Typography} color="text.secondary">${field.group ?? group.title}</${Typography}>
                      </${Box}>
                      <${Stack} direction="row" spacing=${1} sx=${{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <${Chip} label=${field.source} variant="outlined" />
                        <${Chip}
                          color=${field.confidence < 70 ? 'warning' : 'success'}
                          label=${`${field.confidence}%`}
                          variant=${field.confidence < 70 ? 'filled' : 'outlined'}
                        />
                      </${Stack}>
                    </${Stack}>
                    <${TextField}
                      fullWidth=${true}
                      label=${field.label}
                      onChange=${(event) => updateField(field.key, event.target.value)}
                      onFocus=${() => setSelectedField(field.key)}
                      select=${field.type === 'select'}
                      type=${field.type === 'number' || field.type === 'date' ? field.type : 'text'}
                      value=${field.value}
                    >
                      ${
                        field.type === 'select'
                          ? field.options.map(
                              (option) =>
                                html`<${MenuItem} key=${option} value=${option}>${option}</${MenuItem}>`,
                            )
                          : null
                      }
                    </${TextField}>
                    <${Typography} color="text.secondary">
                      Original value: <strong>${field.originalValue}</strong>
                    </${Typography}>
                  </${Stack}>
                </${Paper}>
              `,
            )}
          </${Stack}>
        </${AccordionDetails}>
      </${Accordion}>
    `,
  );

  const lineItems = html`
    <${Paper} sx=${{ padding: 2.25 }}>
      <${Stack} spacing=${1.5}>
        <${Typography} variant="h4">Line items</${Typography}>
        <${Table}>
          <${TableHead}>
            <${TableRow}>
              <${TableCell}>SKU</${TableCell}>
              <${TableCell}>Description</${TableCell}>
              <${TableCell}>Qty</${TableCell}>
              <${TableCell}>Net</${TableCell}>
              <${TableCell}>Confidence</${TableCell}>
            </${TableRow}>
          </${TableHead}>
          <${TableBody}>
            ${LINE_ITEMS.map(
              (item) => html`
                <${TableRow} key=${item.sku}>
                  <${TableCell}><${Typography} sx=${{ fontFamily: 'var(--font-mono)' }}>${item.sku}</${Typography}></${TableCell}>
                  <${TableCell}>${item.description}</${TableCell}>
                  <${TableCell}>${item.quantity}</${TableCell}>
                  <${TableCell}>${item.net}</${TableCell}>
                  <${TableCell}>
                    <${Chip}
                      color=${item.confidence < 70 ? 'warning' : 'success'}
                      label=${`${item.confidence}%`}
                      variant="outlined"
                    />
                  </${TableCell}>
                </${TableRow}>
              `,
            )}
          </${TableBody}>
        </${Table}>
      </${Stack}>
    </${Paper}>
  `;

  const reviewContent = html`
    <${Stack} spacing=${2}>
      ${summary}
      ${
        validationIssues.length
          ? html`
            <${Alert} severity="warning">
              This session changed before your submit completed. Reload the latest session state, compare your edits, and submit again.
            </${Alert}>
          `
          : null
      }
      ${fieldGroups}
      ${lineItems}
    </${Stack}>
  `;

  return html`
    <${PageFrame} noContainer=${true} viewport=${viewport}>
      <${TopBar}
        right=${right}
        subtitle="Evidence-first correction shell with persistent validation, provenance, and a placeholder evidence panel."
        title="Correction workspace"
        viewport=${viewport}
      />
      <${Container}
        maxWidth=${false}
        sx=${{
          marginInline: 'auto',
          maxWidth: 1480,
          paddingBottom: isMobile ? 12 : 4,
          paddingInline: isMobile ? 2 : 4,
          paddingTop: 3,
        }}
      >
        ${
          isMobile
            ? html`
              <${Stack} spacing=${2}>
                <${Tabs} onChange=${(_, value) => setMobileTab(value)} value=${mobileTab} variant="fullWidth">
                  <${Tab} label="Review" />
                  <${Tab} label="Evidence" />
                </${Tabs}>
                ${mobileTab === 0 ? html`<${Stack} spacing=${2}>${validationPanel}${reviewContent}</${Stack}>` : evidencePanel}
                <${Paper}
                  sx=${{
                    bottom: 12,
                    left: 16,
                    padding: 1.5,
                    position: 'fixed',
                    right: 16,
                    zIndex: 10,
                  }}
                >
                  <${Stack} direction="row" spacing=${1.25}>
                    <${Button} fullWidth=${true} variant="outlined">Save draft</${Button}>
                    <${Button} fullWidth=${true} onClick=${() => setSubmitOpen(true)} variant="contained">Submit corrections</${Button}>
                  </${Stack}>
                </${Paper}>
              </${Stack}>
            `
            : html`
              <${Box}
                sx=${{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: '300px minmax(0, 1fr) 340px',
                }}
              >
                ${validationPanel}
                ${reviewContent}
                ${evidencePanel}
              </${Box}>
              <${Stack} direction="row" justifyContent="flex-end" spacing=${1.25} sx=${{ marginTop: 2 }}>
                <${Button} variant="outlined">Save draft</${Button}>
                <${Button} onClick=${() => setSubmitOpen(true)} variant="contained">Submit corrections</${Button}>
              </${Stack}>
            `
        }
      </${Container}>

      <${Dialog} onClose=${() => setSubmitOpen(false)} open=${submitOpen}>
        <${DialogTitle}>${validationIssues.length ? `${validationIssues.length} items still need review` : 'Submit corrections?'}</${DialogTitle}>
        <${DialogContent}>
          ${
            validationIssues.length
              ? html`
                <${List}>
                  ${validationIssues.slice(0, 4).map(
                    (issue) => html`
                      <${ListItem} key=${issue}>
                        <${ListItemText} primary=${issue} />
                      </${ListItem}>
                    `,
                  )}
                </${List}>
              `
              : html`
                <${Typography}>
                  The draft looks ready. Publish the corrected values back into the downstream correction flow.
                </${Typography}>
              `
          }
        </${DialogContent}>
        <${DialogActions}>
          <${Button} onClick=${() => setSubmitOpen(false)} variant="text">Keep editing</${Button}>
          <${Button} onClick=${() => setSubmitOpen(false)} variant="contained">
            ${validationIssues.length ? 'Review fields' : 'Submit now'}
          </${Button}>
        </${DialogActions}>
      </${Dialog}>
    </${PageFrame}>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);

import type { Meta, StoryObj } from '@storybook/react-vite';

import { CorrectionSessionsTable } from '.';

const sampleSessions = [
  {
    documentId: 'INV-2026-0012',
    documentType: 'Invoice',
    id: '1',
    status: 'OPEN',
    updatedAt: '2026-05-16T09:15:00.000Z',
    version: 3,
  },
  {
    documentId: 'POL-2026-0041',
    documentType: 'Policy',
    id: '2',
    status: 'IN_PROGRESS',
    updatedAt: '2026-05-16T11:45:00.000Z',
    version: 1,
  },
];

const meta = {
  args: {
    documentIdLabel: 'Document ID',
    documentTypeLabel: 'Type',
    openSessionLabel: 'Workspace route arrives in Part 2.',
    sessions: sampleSessions,
    statusLabel: 'Status',
    updatedAtLabel: 'Updated',
    versionLabel: 'Version',
  },
  component: CorrectionSessionsTable,
  tags: ['autodocs'],
  title: 'Inbox/CorrectionSessionsTable',
} satisfies Meta<typeof CorrectionSessionsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

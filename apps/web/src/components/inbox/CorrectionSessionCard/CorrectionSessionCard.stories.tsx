import type { Meta, StoryObj } from '@storybook/react-vite';

import { CorrectionSessionCard } from '.';

const meta = {
  args: {
    documentTypeLabel: 'Type',
    openSessionLabel: 'Workspace route arrives in Part 2.',
    session: {
      documentId: 'INV-2026-0012',
      documentType: 'Invoice',
      id: '1',
      status: 'OPEN',
      updatedAt: '2026-05-16T09:15:00.000Z',
      version: 3,
    },
    updatedAtLabel: 'Updated',
    versionLabel: 'Version',
  },
  component: CorrectionSessionCard,
  tags: ['autodocs'],
  title: 'Inbox/CorrectionSessionCard',
} satisfies Meta<typeof CorrectionSessionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

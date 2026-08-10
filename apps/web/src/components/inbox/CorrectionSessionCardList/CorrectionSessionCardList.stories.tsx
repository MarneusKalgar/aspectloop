import type { Meta, StoryObj } from '@storybook/react-vite';

import { CorrectionSessionCardList } from '.';

const meta = {
  args: {
    documentTypeLabel: 'Type',
    openSessionLabel: 'Workspace route arrives in Part 2.',
    sessions: [
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
    ],
    updatedAtLabel: 'Updated',
    versionLabel: 'Version',
  },
  component: CorrectionSessionCardList,
  tags: ['autodocs'],
  title: 'Inbox/CorrectionSessionCardList',
} satisfies Meta<typeof CorrectionSessionCardList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

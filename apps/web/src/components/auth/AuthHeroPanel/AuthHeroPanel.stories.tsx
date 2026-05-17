import type { Meta, StoryObj } from '@storybook/react-vite';

import { AuthHeroPanel } from '.';

const meta = {
  args: {
    description:
      'Review extracted values against source documents with field-level confidence scoring.',
    eyebrow: 'Correction workbench',
    features: [
      'Low-confidence fields surfaced first',
      'Provenance linked to source evidence',
      'Persistent validation status',
    ],
    title: 'Evidence-first data review, built for accuracy.',
  },
  component: AuthHeroPanel,
  tags: ['autodocs'],
  title: 'Auth/AuthHeroPanel',
} satisfies Meta<typeof AuthHeroPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { InboxFilterChips } from '.';

const meta = {
  component: InboxFilterChips,
  tags: ['autodocs'],
  title: 'Inbox/InboxFilterChips',
} satisfies Meta<typeof InboxFilterChips>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeFilter: 'ALL',
    onChange: () => {},
    options: [
      { key: 'ALL', label: 'All statuses' },
      { key: 'OPEN', label: 'Open' },
      { key: 'IN_PROGRESS', label: 'In Progress' },
      { key: 'COMPLETED', label: 'Completed' },
    ],
  },
  render: () => {
    const [activeFilter, setActiveFilter] = useState('ALL');

    return (
      <InboxFilterChips
        activeFilter={activeFilter}
        onChange={setActiveFilter}
        options={[
          { key: 'ALL', label: 'All statuses' },
          { key: 'OPEN', label: 'Open' },
          { key: 'IN_PROGRESS', label: 'In Progress' },
          { key: 'COMPLETED', label: 'Completed' },
        ]}
      />
    );
  },
};

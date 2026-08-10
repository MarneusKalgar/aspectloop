import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { InboxSearchField } from '.';

const meta = {
  component: InboxSearchField,
  tags: ['autodocs'],
  title: 'Inbox/InboxSearchField',
} satisfies Meta<typeof InboxSearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Search sessions',
    onChange: () => {},
    placeholder: 'Search by document ID or type',
    value: '',
  },
  render: () => {
    const [value, setValue] = useState('');

    return (
      <InboxSearchField
        label="Search sessions"
        onChange={setValue}
        placeholder="Search by document ID or type"
        value={value}
      />
    );
  },
};

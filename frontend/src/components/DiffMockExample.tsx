import { Paper, Text } from '@mantine/core';

const DiffMockExample = () => (
  <Paper
    withBorder
    p="sm"
    radius="md"
    maw={560}
    w="100%"
    style={{ borderLeft: '3px solid var(--mantine-color-green-6)' }}
  >
    <Text component="div" size="sm" style={{ lineHeight: 1.6 }}>
      Led a team{' '}
      <span
        style={{
          backgroundColor: 'rgba(250, 82, 82, 0.14)',
          color: 'var(--mantine-color-red-3)',
          textDecoration: 'line-through',
          borderRadius: 3,
          padding: '0 2px',
        }}
      >
        working on internal tools
      </span>{' '}
      <span
        style={{
          backgroundColor: 'rgba(64, 192, 87, 0.16)',
          color: 'var(--mantine-color-green-3)',
          borderRadius: 3,
          padding: '0 2px',
        }}
      >
        of 5 engineers shipping React dashboards used by 2,000+ internal users
      </span>
      , cutting report turnaround{' '}
      <span
        style={{
          backgroundColor: 'rgba(64, 192, 87, 0.16)',
          color: 'var(--mantine-color-green-3)',
          borderRadius: 3,
          padding: '0 2px',
        }}
      >
        from days to hours
      </span>
      .
    </Text>
  </Paper>
);

export default DiffMockExample;

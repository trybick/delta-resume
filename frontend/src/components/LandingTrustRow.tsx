import { Group, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

const TRUST_POINTS = ['Free to try', 'No sign-up', 'No card needed'];

const LandingTrustRow = () => (
  <Group gap="md" justify="center" wrap="wrap">
    {TRUST_POINTS.map((point) => (
      <Group key={point} gap={6} wrap="nowrap">
        <IconCheck size={14} stroke={2.5} color="var(--mantine-color-teal-5)" />
        <Text size="xs" c="dimmed">
          {point}
        </Text>
      </Group>
    ))}
  </Group>
);

export default LandingTrustRow;

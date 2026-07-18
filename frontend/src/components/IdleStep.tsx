import { Group, Text } from '@mantine/core';

type IdleStepProps = {
  index: number;
  label: string;
};

const IdleStep = ({ index, label }: IdleStepProps) => (
  <Group
    gap={6}
    wrap="nowrap"
    px={10}
    py={5}
    style={{
      borderRadius: 999,
      border: '1px dashed var(--mantine-color-default-border)',
    }}
  >
    <Text size="xs" fw={700} c="cyan.4" lh={1}>
      {index}
    </Text>
    <Text size="xs" c="dimmed" lh={1}>
      {label}
    </Text>
  </Group>
);

export default IdleStep;

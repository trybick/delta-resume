import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';
import { IconBolt, IconCircleCheck, IconFileText, IconList } from '@tabler/icons-react';

export const UpdatedBadge = () => (
  <Group
    className="updated-badge"
    gap={6}
    wrap="nowrap"
    px={12}
    py={6}
    style={{
      flexShrink: 0,
      borderRadius: 999,
      border: '1px solid color-mix(in srgb, var(--mantine-color-green-6) 35%, transparent)',
      backgroundColor:
        'color-mix(in srgb, var(--mantine-color-green-6) 14%, var(--mantine-color-body))',
    }}
  >
    <IconCircleCheck size={15} color="var(--mantine-color-green-5)" stroke={1.8} />
    <Text size="xs" fw={700} c="green.5" tt="uppercase" lts={0.6} lh={1}>
      Resume updated
    </Text>
  </Group>
);

type ChangeStatChipProps = {
  icon: ReactNode;
  count: number;
  label: string;
};

const ChangeStatChip = ({ icon, count, label }: ChangeStatChipProps) => (
  <Group
    className="change-stat-chip"
    gap={6}
    wrap="nowrap"
    px={10}
    py={5}
    style={{
      flexShrink: 0,
      borderRadius: 999,
      border: '1px solid color-mix(in srgb, var(--mantine-color-green-6) 25%, transparent)',
    }}
  >
    {icon}
    <Text size="sm" fw={700} c="green.5" lh={1}>
      {count}
    </Text>
    <Text size="sm" fw={500} c="dimmed" lh={1}>
      {label}
    </Text>
  </Group>
);

type ChangeStatsPillProps = {
  bulletCount: number;
  skillCount: number;
  paragraphCount: number;
};

const ChangeStatsPill = ({ bulletCount, skillCount, paragraphCount }: ChangeStatsPillProps) => (
  <Group className="change-stats-pill" gap={6} wrap="wrap">
    {bulletCount > 0 && (
      <ChangeStatChip
        icon={<IconList size={14} color="var(--mantine-color-green-5)" stroke={1.8} />}
        count={bulletCount}
        label={bulletCount === 1 ? 'bullet' : 'bullets'}
      />
    )}
    {skillCount > 0 && (
      <ChangeStatChip
        icon={<IconBolt size={14} color="var(--mantine-color-green-5)" stroke={1.8} />}
        count={skillCount}
        label={skillCount === 1 ? 'skill' : 'skills'}
      />
    )}
    {paragraphCount > 0 && (
      <ChangeStatChip
        icon={<IconFileText size={14} color="var(--mantine-color-green-5)" stroke={1.8} />}
        count={paragraphCount}
        label="summary"
      />
    )}
  </Group>
);

export default ChangeStatsPill;

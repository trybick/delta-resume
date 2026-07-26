import { Fragment, type ReactNode } from 'react';
import { Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBolt, IconCircleCheck, IconFileText, IconList } from '@tabler/icons-react';

type ChangeStat = {
  key: string;
  icon: ReactNode;
  count: number;
  label: string;
};

type ChangesSummaryProps = {
  bulletCount: number;
  skillCount: number;
  paragraphCount: number;
};

const statIconProps = {
  size: 14,
  stroke: 1.8,
  color: 'var(--mantine-color-green-5)',
};

const ChangesSummary = ({ bulletCount, skillCount, paragraphCount }: ChangesSummaryProps) => {
  const stats: ChangeStat[] = [
    {
      key: 'bullets',
      icon: <IconList {...statIconProps} />,
      count: bulletCount,
      label: bulletCount === 1 ? 'bullet' : 'bullets',
    },
    {
      key: 'skills',
      icon: <IconBolt {...statIconProps} />,
      count: skillCount,
      label: skillCount === 1 ? 'skill' : 'skills',
    },
    {
      key: 'summary',
      icon: <IconFileText {...statIconProps} />,
      count: paragraphCount,
      label: 'summary',
    },
  ].filter((stat) => stat.count > 0);

  return (
    <Group className="changes-summary" gap={10} wrap="nowrap" align="flex-start">
      <ThemeIcon size={30} radius="xl" variant="light" color="green" style={{ flexShrink: 0 }}>
        <IconCircleCheck size={18} stroke={1.8} />
      </ThemeIcon>
      <Stack gap={3} style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} lh={1.3}>
          Resume updated
        </Text>
        {stats.length === 0 ? (
          <Text size="xs" c="dimmed" lh={1.3}>
            No rewrites suggested for this job
          </Text>
        ) : (
          <Group gap={8} wrap="wrap">
            <Text size="xs" c="dimmed" lh={1.3}>
              Rewritten:
            </Text>
            {stats.map((stat, index) => (
              <Fragment key={stat.key}>
                {index > 0 && (
                  <Text size="xs" c="dimmed" lh={1.3} aria-hidden>
                    &middot;
                  </Text>
                )}
                <Group gap={4} wrap="nowrap">
                  {stat.icon}
                  <Text size="xs" c="dimmed" lh={1.3}>
                    <Text component="span" size="xs" fw={700} c="green.5">
                      {stat.count}
                    </Text>{' '}
                    {stat.label}
                  </Text>
                </Group>
              </Fragment>
            ))}
          </Group>
        )}
      </Stack>
    </Group>
  );
};

export default ChangesSummary;

import { Box, Group, Progress, Text, Tooltip } from '@mantine/core';
import { IconTargetArrow } from '@tabler/icons-react';

type RequirementsCoverageProps = {
  coveredCount: number;
  totalCount: number;
  coveredByChangesCount: number;
};

const RequirementsCoverage = ({
  coveredCount,
  totalCount,
  coveredByChangesCount,
}: RequirementsCoverageProps) => {
  if (totalCount === 0) return null;

  const baseCoveredCount = Math.max(coveredCount - coveredByChangesCount, 0);
  const basePercent = (baseCoveredCount / totalCount) * 100;
  const changesPercent = (Math.min(coveredByChangesCount, coveredCount) / totalCount) * 100;

  return (
    <Tooltip
      label="How many of the job's key requirements your resume demonstrates, counting the changes you keep applied."
      multiline
      maw={320}
    >
      <Box
        className="requirements-coverage"
        px="sm"
        py={8}
        w="100%"
        maw={420}
        style={{
          borderRadius: 10,
          border: '1px solid color-mix(in srgb, var(--mantine-color-green-6) 25%, transparent)',
        }}
      >
        <Group justify="space-between" gap="xs" wrap="nowrap" mb={6}>
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            <IconTargetArrow
              size={14}
              color="var(--mantine-color-green-5)"
              stroke={1.8}
              style={{ flexShrink: 0 }}
            />
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.6} truncate>
              Requirement coverage
            </Text>
          </Group>
          <Text size="xs" lh={1} style={{ flexShrink: 0 }}>
            <Text component="span" size="xs" fw={700} c="green.5">
              {coveredCount}
            </Text>
            <Text component="span" size="xs" c="dimmed">
              {' '}
              of {totalCount}
            </Text>
          </Text>
        </Group>
        <Progress.Root size={8} radius="xl">
          <Progress.Section value={basePercent} color="green.7" />
          <Progress.Section value={changesPercent} color="lime.4" />
        </Progress.Root>
        {coveredByChangesCount > 0 && (
          <Group gap={6} wrap="nowrap" mt={6}>
            <Box
              w={8}
              h={8}
              style={{
                flexShrink: 0,
                borderRadius: 999,
                backgroundColor: 'var(--mantine-color-lime-4)',
              }}
            />
            <Text size="xs" c="dimmed" lh={1.3}>
              +{coveredByChangesCount} from the changes you keep
            </Text>
          </Group>
        )}
      </Box>
    </Tooltip>
  );
};

export default RequirementsCoverage;

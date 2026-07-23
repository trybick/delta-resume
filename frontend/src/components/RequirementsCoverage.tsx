import { Box, Group, Progress, Text, Tooltip } from '@mantine/core';
import { IconTargetArrow } from '@tabler/icons-react';

type RequirementsCoverageProps = {
  coveredCount: number;
  totalCount: number;
  baseCoveredCount: number;
  coveredByChangesCount: number;
  coveredByAddedCount: number;
  availableFillerCount: number;
};

type LegendItemProps = {
  color: string;
  dashed?: boolean;
  label: string;
};

const LegendItem = ({ color, dashed, label }: LegendItemProps) => (
  <Group gap={5} wrap="nowrap">
    <Box
      w={8}
      h={8}
      style={{
        flexShrink: 0,
        borderRadius: 999,
        backgroundColor: dashed ? 'transparent' : color,
        border: dashed ? `1.5px dashed ${color}` : undefined,
      }}
    />
    <Text size="xs" c="dimmed" lh={1.3}>
      {label}
    </Text>
  </Group>
);

const RequirementsCoverage = ({
  coveredCount,
  totalCount,
  baseCoveredCount,
  coveredByChangesCount,
  coveredByAddedCount,
  availableFillerCount,
}: RequirementsCoverageProps) => {
  if (totalCount === 0) return null;

  const basePercent = (baseCoveredCount / totalCount) * 100;
  const changesPercent = (coveredByChangesCount / totalCount) * 100;
  const addedPercent = (coveredByAddedCount / totalCount) * 100;
  const potentialPercent = (availableFillerCount / totalCount) * 100;
  const potentialCount = coveredCount + availableFillerCount;

  return (
    <Tooltip
      label="How many of the job's key requirements your resume demonstrates: what your original resume already covered, what the tailored changes now cover, and gaps you can still fill with suggested bullets."
      multiline
      maw={340}
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
            {availableFillerCount > 0 && (
              <Text component="span" size="xs" c="dimmed">
                {' '}
                ({potentialCount} possible)
              </Text>
            )}
          </Text>
        </Group>
        <Progress.Root size={8} radius="xl">
          <Progress.Section value={basePercent} color="green.7" />
          <Progress.Section value={changesPercent} color="violet.5" />
          <Progress.Section value={addedPercent} color="violet.5" style={{ opacity: 0.55 }} />
          <Progress.Section
            value={potentialPercent}
            color="gray.6"
            striped
            style={{ opacity: 0.45 }}
          />
        </Progress.Root>
        <Group gap="sm" mt={6} wrap="wrap">
          <LegendItem
            color="var(--mantine-color-green-7)"
            label={`${baseCoveredCount} already on your resume`}
          />
          {coveredByChangesCount > 0 && (
            <LegendItem
              color="var(--mantine-color-violet-5)"
              label={`+${coveredByChangesCount} from tailored changes`}
            />
          )}
          {coveredByAddedCount > 0 && (
            <LegendItem
              color="var(--mantine-color-violet-5)"
              dashed
              label={`+${coveredByAddedCount} from bullets you added`}
            />
          )}
          {availableFillerCount > 0 && (
            <LegendItem
              color="var(--mantine-color-gray-5)"
              dashed
              label={`+${availableFillerCount} more if you add the suggested bullets below`}
            />
          )}
        </Group>
      </Box>
    </Tooltip>
  );
};

export default RequirementsCoverage;

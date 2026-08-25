import type { ReactNode } from 'react';
import { Box, Collapse, Group, Progress, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconTargetArrow } from '@tabler/icons-react';

type RequirementsCoverageProps = {
  coveredCount: number;
  totalCount: number;
  baseCoveredCount: number;
  coveredByChangesCount: number;
  coveredByAddedCount: number;
  availableFillerCount: number;
  unresolvedGapCount?: number;
  open?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
};

const RequirementsCoverage = ({
  coveredCount,
  totalCount,
  baseCoveredCount,
  coveredByChangesCount,
  coveredByAddedCount,
  availableFillerCount,
  unresolvedGapCount = 0,
  open = false,
  onToggle,
  actions,
  children,
}: RequirementsCoverageProps) => {
  if (totalCount === 0) return null;

  const basePercent = (baseCoveredCount / totalCount) * 100;
  const changesPercent = (coveredByChangesCount / totalCount) * 100;
  const addedPercent = (coveredByAddedCount / totalCount) * 100;
  const potentialPercent = (availableFillerCount / totalCount) * 100;
  const expandable = onToggle !== undefined;

  const tooltipParts = [
    `${baseCoveredCount} already on your resume`,
    coveredByChangesCount > 0 ? `+${coveredByChangesCount} from tailored changes` : null,
    coveredByAddedCount > 0 ? `+${coveredByAddedCount} from bullets you added` : null,
    availableFillerCount > 0
      ? `+${availableFillerCount} more if you add the suggested bullets`
      : null,
  ].filter((part) => part !== null);

  const header = (
    <Group gap="xs" wrap="nowrap">
      <IconTargetArrow
        size={14}
        color="var(--mantine-color-green-5)"
        stroke={1.8}
        style={{ flexShrink: 0 }}
      />
      <Progress.Root size={6} radius="xl" style={{ flex: 1, minWidth: 48 }}>
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
      <Text size="xs" lh={1} style={{ flexShrink: 0 }}>
        <Text component="span" size="xs" fw={700} c="green.5">
          {coveredCount}
        </Text>
        <Text component="span" size="xs" c="dimmed">
          {' '}
          of {totalCount}
        </Text>
      </Text>
      {unresolvedGapCount > 0 && (
        <Text size="xs" fw={600} c="orange.5" lh={1} style={{ flexShrink: 0 }}>
          {unresolvedGapCount} missing
        </Text>
      )}
      {expandable && (
        <IconChevronDown
          size={14}
          color="var(--mantine-color-gray-5)"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      )}
    </Group>
  );

  return (
    <Box
      className="requirements-coverage"
      px="sm"
      py={6}
      w="100%"
      style={{
        borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--mantine-color-green-6) 25%, transparent)',
      }}
    >
      <Group gap="sm" wrap="nowrap" align="center">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Tooltip
            label={`How many of the job's key requirements your resume demonstrates. ${tooltipParts.join('. ')}.`}
            multiline
            maw={340}
          >
            {expandable ? (
              <UnstyledButton
                onClick={onToggle}
                w="100%"
                aria-expanded={open}
                aria-label="Requirement coverage"
                style={{ display: 'block' }}
              >
                {header}
              </UnstyledButton>
            ) : (
              <Box>{header}</Box>
            )}
          </Tooltip>
        </Box>
        {actions}
      </Group>
      {expandable && (
        <Collapse expanded={open}>
          <Box
            pt={8}
            mt={6}
            style={{
              borderTop: '1px solid var(--mantine-color-default-border)',
            }}
          >
            {children}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default RequirementsCoverage;

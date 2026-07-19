import type { ReactNode } from 'react';
import { Box, Collapse, Group, Paper, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

type CollapsibleInsightProps = {
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  labelColor: string;
  borderColor: string;
  background: string;
  ariaLabel: string;
  children: ReactNode;
};

const CollapsibleInsight = ({
  open,
  onToggle,
  icon,
  label,
  labelColor,
  borderColor,
  background,
  ariaLabel,
  children,
}: CollapsibleInsightProps) => (
  <Paper
    component="section"
    aria-label={ariaLabel}
    px="md"
    py="xs"
    style={{
      borderLeft: `2px solid ${borderColor}`,
      borderRadius: '0 var(--mantine-radius-md) var(--mantine-radius-md) 0',
      background,
    }}
  >
    <UnstyledButton onClick={onToggle} w="100%" aria-expanded={open} style={{ display: 'block' }}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          {icon}
          <Text
            className="collapsible-insight-label"
            size="xs"
            fw={600}
            c={labelColor}
            tt="uppercase"
            lts={0.6}
            truncate
          >
            {label}
          </Text>
        </Group>
        <IconChevronDown
          size={14}
          color="var(--mantine-color-gray-5)"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </Group>
    </UnstyledButton>
    <Collapse expanded={open}>
      <Box pt={6}>{children}</Box>
    </Collapse>
  </Paper>
);

export default CollapsibleInsight;

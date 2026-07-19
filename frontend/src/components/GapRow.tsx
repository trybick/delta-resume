import { Badge, Button, Group, Stack, Text } from '@mantine/core';
import { IconCircleCheck, IconPlus } from '@tabler/icons-react';
import { hasDraftBullet } from '../lib/hasDraftBullet';
import { proAccent } from '../lib/proAccent';
import type { AddedBullet, JobRequirement } from '../lib/types';

type GapRowProps = {
  requirement: JobRequirement;
  addedBullet?: AddedBullet;
  onAdd?: (requirement: JobRequirement) => void;
  onUndo?: (id: string) => void;
};

const GapRow = ({ requirement, addedBullet, onAdd, onUndo }: GapRowProps) => {
  const canAdd = onAdd !== undefined && addedBullet === undefined && hasDraftBullet(requirement);

  return (
    <Stack gap={2}>
      <Group className="gap-row" gap="xs" wrap="nowrap" align="center">
        <Badge
          size="xs"
          variant="light"
          color={requirement.importance === 'must' ? proAccent.badgeColor : 'gray'}
          style={{ flexShrink: 0 }}
        >
          {requirement.importance === 'must' ? 'Must-have' : 'Nice-to-have'}
        </Badge>
        <Text className="gap-row-title" size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
          {requirement.text}
        </Text>
        {addedBullet && onUndo && (
          <Group className="gap-row-action" gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            <IconCircleCheck size={14} color="var(--mantine-color-green-5)" />
            <Text size="xs" fw={600} c="green.5">
              Added
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => onUndo(addedBullet.id)}
            >
              Undo
            </Button>
          </Group>
        )}
        {canAdd && (
          <Button
            className="gap-row-action"
            size="compact-xs"
            variant="light"
            leftSection={<IconPlus size={12} />}
            style={{ flexShrink: 0 }}
            onClick={() => onAdd(requirement)}
          >
            Add to resume
          </Button>
        )}
      </Group>
      {requirement.gapHint && !addedBullet && (
        <Text size="xs" c="dimmed">
          {requirement.gapHint}
        </Text>
      )}
    </Stack>
  );
};

export default GapRow;

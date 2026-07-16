import { ActionIcon, Box, Group, Paper, Text, Textarea, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { AddedBullet } from '../lib/types';

type AddedBulletRowProps = {
  bullet: AddedBullet;
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
};

const AddedBulletRow = ({ bullet, onTextChange, onRemove }: AddedBulletRowProps) => (
  <Paper
    withBorder
    p="sm"
    my={6}
    radius="md"
    style={{
      borderLeft: '3px solid var(--mantine-color-green-6)',
      backgroundColor: 'rgba(64, 192, 87, 0.06)',
    }}
  >
    <Group align="flex-start" wrap="nowrap" gap="sm">
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text size="xs" fw={600} c="green.4" mb={4}>
          New bullet — {bullet.requirementText}
        </Text>
        <Textarea
          value={bullet.text}
          onChange={(event) => onTextChange(bullet.id, event.currentTarget.value)}
          autosize
          minRows={1}
          size="xs"
          styles={{
            input: {
              fontFamily: 'ui-monospace, monospace',
              fontSize: 'var(--mantine-font-size-xs)',
              lineHeight: 1.5,
            },
          }}
          aria-label={`Added bullet for ${bullet.requirementText}`}
        />
        <Text size="xs" c="dimmed" mt={4}>
          Only keep this if it&rsquo;s true for you &mdash; fill in the bracketed placeholders.
        </Text>
      </Box>
      <Tooltip label="Remove added bullet">
        <ActionIcon
          variant="light"
          color="red"
          onClick={() => onRemove(bullet.id)}
          aria-label="Remove added bullet"
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  </Paper>
);

export default AddedBulletRow;

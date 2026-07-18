import { Text, UnstyledButton } from '@mantine/core';
import { IconArrowsVertical } from '@tabler/icons-react';

type CollapsedContextProps = {
  hiddenCount: number;
  onExpand: () => void;
};

const CollapsedContext = ({ hiddenCount, onExpand }: CollapsedContextProps) => (
  <UnstyledButton
    onClick={onExpand}
    my={6}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '4px 10px',
      borderRadius: 6,
      border: '1px dashed var(--mantine-color-default-border)',
      backgroundColor: 'var(--mantine-color-default-hover)',
    }}
  >
    <IconArrowsVertical size={14} color="var(--mantine-primary-color-filled)" />
    <Text size="xs" c="dimmed">
      Show {hiddenCount} hidden line{hiddenCount === 1 ? '' : 's'} from original
    </Text>
  </UnstyledButton>
);

export default CollapsedContext;

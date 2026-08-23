import { Box, Group, Text, ThemeIcon } from '@mantine/core';
import type { ProFeature } from '../lib/proPlan';

type FeatureRowProps = {
  feature: ProFeature;
  compact: boolean;
};

const FeatureRow = ({ feature, compact }: FeatureRowProps) => {
  const Icon = feature.icon;

  return (
    <Group gap="sm" wrap="nowrap" align={compact ? 'center' : 'flex-start'}>
      <ThemeIcon size={compact ? 28 : 36} radius="xl" variant="light" color="cyan">
        <Icon size={compact ? 15 : 19} />
      </ThemeIcon>
      <Box>
        <Text size={compact ? 'xs' : 'sm'} fw={600} lh={1.3}>
          {feature.title}
        </Text>
        {!compact && (
          <Text size="xs" c="dimmed" lh={1.4}>
            {feature.description}
          </Text>
        )}
      </Box>
    </Group>
  );
};

export default FeatureRow;

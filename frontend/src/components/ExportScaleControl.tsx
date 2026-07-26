import { Box, Group, Slider, Text } from '@mantine/core';
import {
  EXPORT_SCALE_DEFAULT,
  EXPORT_SCALE_MAX,
  EXPORT_SCALE_MIN,
  EXPORT_SCALE_STEP,
} from '../lib/exportDocx';

const SCALE_MARKS = [
  { value: EXPORT_SCALE_MIN },
  { value: EXPORT_SCALE_DEFAULT },
  { value: EXPORT_SCALE_MAX },
];

const formatScalePercent = (scale: number): string => `${Math.round(scale * 100)}%`;

type ExportScaleControlProps = {
  scale: number;
  onChange: (scale: number) => void;
  disabled?: boolean;
};

export const ExportScaleControl = ({ scale, onChange, disabled }: ExportScaleControlProps) => (
  <Box
    px="sm"
    pt={4}
    pb={10}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <Group justify="space-between" mb={10}>
      <Text size="xs" fw={600}>
        Text size
      </Text>
      <Text size="xs" c="dimmed">
        {formatScalePercent(scale)}
      </Text>
    </Group>
    <Slider
      size="sm"
      value={scale}
      onChange={onChange}
      disabled={disabled}
      min={EXPORT_SCALE_MIN}
      max={EXPORT_SCALE_MAX}
      step={EXPORT_SCALE_STEP}
      marks={SCALE_MARKS}
      label={formatScalePercent}
      aria-label="Export text size"
    />
    <Box
      mt={8}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
      }}
    >
      <Text size="xs" c="dimmed" ta="left">
        Smaller
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        Default
      </Text>
      <Text size="xs" c="dimmed" ta="right">
        Larger
      </Text>
    </Box>
  </Box>
);

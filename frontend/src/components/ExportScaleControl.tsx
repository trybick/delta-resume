import { Box, Group, Slider, Text } from '@mantine/core';
import {
  EXPORT_SCALE_DEFAULT,
  EXPORT_SCALE_MAX,
  EXPORT_SCALE_MIN,
  EXPORT_SCALE_STEP,
} from '../lib/exportDocx';

const SCALE_MARKS = [
  { value: EXPORT_SCALE_MIN, label: 'Smaller' },
  { value: EXPORT_SCALE_DEFAULT, label: 'Default' },
  { value: EXPORT_SCALE_MAX, label: 'Larger' },
];

const formatScalePercent = (scale: number): string => `${Math.round(scale * 100)}%`;

type ExportScaleControlProps = {
  scale: number;
  onChange: (scale: number) => void;
  disabled?: boolean;
};

export const ExportScaleControl = ({ scale, onChange, disabled }: ExportScaleControlProps) => (
  <Box
    px={12}
    pt={4}
    pb={28}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <Group justify="space-between" mb={8}>
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
  </Box>
);

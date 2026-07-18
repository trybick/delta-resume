import { Text } from '@mantine/core';

type ContextLineProps = {
  line: string;
};

const ContextLine = ({ line }: ContextLineProps) => (
  <Text
    size="sm"
    c="dimmed"
    style={{
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
    }}
  >
    {line.trim() === '' ? '\u00A0' : line}
  </Text>
);

export default ContextLine;

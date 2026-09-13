import { Text } from '@mantine/core';
import { diffWords } from 'diff';

type DiffTextProps = {
  original: string;
  tailored: string;
  size?: 'xs' | 'sm' | 'md';
};

const removedStyle = {
  backgroundColor: 'rgba(250, 82, 82, 0.14)',
  color: 'var(--mantine-color-red-3)',
  textDecoration: 'line-through',
  borderRadius: 3,
  padding: '0 2px',
} as const;

const addedStyle = {
  backgroundColor: 'rgba(64, 192, 87, 0.16)',
  color: 'var(--mantine-color-green-3)',
  borderRadius: 3,
  padding: '0 2px',
} as const;

const DiffText = ({ original, tailored, size = 'sm' }: DiffTextProps) => (
  <Text component="div" size={size} style={{ lineHeight: 1.55 }}>
    {diffWords(original, tailored).map((part, index) => {
      if (part.added) {
        return (
          <span key={index} style={addedStyle}>
            {part.value}
          </span>
        );
      }
      if (part.removed) {
        return (
          <span key={index} style={removedStyle}>
            {part.value}
          </span>
        );
      }
      return <span key={index}>{part.value}</span>;
    })}
  </Text>
);

export default DiffText;

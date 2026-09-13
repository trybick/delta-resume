import { ActionIcon, Box, Group, Paper, Text } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { IconArrowBackUp, IconPointerFilled, IconRefresh } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { SAMPLE_TAILOR_RESULT } from '../lib/mockTailor';
import DiffText from './DiffText';

type Phase = 'diff' | 'pressRevert' | 'reverted' | 'pressReapply';

type Point = { x: number; y: number };

const SAMPLE_CHANGE = SAMPLE_TAILOR_RESULT.changes[0];

const PHASE_DURATIONS: Record<Phase, number> = {
  diff: 2800,
  pressRevert: 450,
  reverted: 2600,
  pressReapply: 450,
};

const NEXT_PHASE: Record<Phase, Phase> = {
  diff: 'pressRevert',
  pressRevert: 'reverted',
  reverted: 'pressReapply',
  pressReapply: 'diff',
};

const stripBullet = (text: string): string => text.replace(/^-\s*/, '');

const DiffMockExample = () => {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('diff');
  const paperRef = useRef<HTMLDivElement>(null);
  const revertRef = useRef<HTMLButtonElement>(null);
  const [cursorTarget, setCursorTarget] = useState<Point | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const timeout = window.setTimeout(() => setPhase(NEXT_PHASE[phase]), PHASE_DURATIONS[phase]);
    return () => window.clearTimeout(timeout);
  }, [phase, reducedMotion]);

  useEffect(() => {
    const measure = () => {
      const paper = paperRef.current;
      const revert = revertRef.current;
      if (!paper || !revert) return;
      const paperBox = paper.getBoundingClientRect();
      const revertBox = revert.getBoundingClientRect();
      setCursorTarget({
        x: revertBox.left - paperBox.left + revertBox.width / 2,
        y: revertBox.top - paperBox.top + revertBox.height / 2,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const isReverted = phase === 'reverted' || phase === 'pressReapply';
  const isPressing = phase === 'pressRevert' || phase === 'pressReapply';
  const cursorVisible = !reducedMotion && cursorTarget !== null;

  return (
    <Paper
      ref={paperRef}
      withBorder
      p="sm"
      radius="md"
      maw={560}
      w="100%"
      aria-hidden
      style={{
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'none',
        borderLeft: `3px solid ${isReverted ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-green-6)'}`,
        transition: 'border-color 0.4s ease',
      }}
    >
      <Group justify="space-between" align="center" mb={6} wrap="nowrap">
        <Text size="xs" c="dimmed" fw={600}>
          Suggested rewrite
        </Text>
        <ActionIcon
          ref={revertRef}
          size="sm"
          variant={isReverted ? 'filled' : 'light'}
          color={isReverted ? 'green' : 'gray'}
          tabIndex={-1}
          style={{
            transition: 'transform 0.15s ease',
            transform: isPressing ? 'scale(0.88)' : undefined,
          }}
        >
          {isReverted ? <IconRefresh size={14} /> : <IconArrowBackUp size={14} />}
        </ActionIcon>
      </Group>
      <Box style={{ display: 'grid' }}>
        <Box
          style={{
            gridArea: '1 / 1',
            opacity: isReverted ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        >
          <DiffText
            original={stripBullet(SAMPLE_CHANGE.original)}
            tailored={stripBullet(SAMPLE_CHANGE.tailored)}
          />
        </Box>
        <Text
          component="div"
          size="sm"
          style={{
            gridArea: '1 / 1',
            lineHeight: 1.55,
            opacity: isReverted ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          {stripBullet(SAMPLE_CHANGE.original)}
        </Text>
      </Box>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: 'none',
          opacity: cursorVisible ? 1 : 0,
          transform: cursorTarget
            ? `translate(${cursorTarget.x - 5}px, ${cursorTarget.y - 3}px) scale(${isPressing ? 0.8 : 1})`
            : undefined,
          transition: 'transform 0.6s ease, opacity 0.3s ease',
          color: 'var(--mantine-color-text)',
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))',
        }}
      >
        <IconPointerFilled size={18} />
      </div>
    </Paper>
  );
};

export default DiffMockExample;

import { ActionIcon, Group, Paper, Text } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { IconArrowBackUp, IconCheck, IconPointerFilled } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

type Phase = 'diff' | 'pressKeep' | 'kept' | 'pressRevert' | 'reverted';

type Point = { x: number; y: number };

const PHASE_DURATIONS: Record<Phase, number> = {
  diff: 2600,
  pressKeep: 450,
  kept: 2400,
  pressRevert: 450,
  reverted: 2600,
};

const NEXT_PHASE: Record<Phase, Phase> = {
  diff: 'pressKeep',
  pressKeep: 'kept',
  kept: 'pressRevert',
  pressRevert: 'reverted',
  reverted: 'diff',
};

const removedStyle = {
  backgroundColor: 'rgba(250, 82, 82, 0.14)',
  color: 'var(--mantine-color-red-3)',
  textDecoration: 'line-through',
  borderRadius: 3,
  padding: '0 2px',
  transition: 'background-color 0.4s ease, color 0.4s ease',
} as const;

const addedStyle = {
  backgroundColor: 'rgba(64, 192, 87, 0.16)',
  color: 'var(--mantine-color-green-3)',
  borderRadius: 3,
  padding: '0 2px',
  transition: 'background-color 0.4s ease, color 0.4s ease',
} as const;

const plainStyle = {
  backgroundColor: 'transparent',
  color: 'inherit',
  borderRadius: 3,
  padding: '0 2px',
  transition: 'background-color 0.4s ease, color 0.4s ease',
} as const;

const DiffMockExample = () => {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('diff');
  const paperRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const revertRef = useRef<HTMLButtonElement>(null);
  const [cursorTargets, setCursorTargets] = useState<{ keep: Point; revert: Point } | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const timeout = window.setTimeout(() => setPhase(NEXT_PHASE[phase]), PHASE_DURATIONS[phase]);
    return () => window.clearTimeout(timeout);
  }, [phase, reducedMotion]);

  useEffect(() => {
    const measure = () => {
      const paper = paperRef.current;
      const keep = keepRef.current;
      const revert = revertRef.current;
      if (!paper || !keep || !revert) return;
      const paperBox = paper.getBoundingClientRect();
      const centerOf = (el: HTMLElement): Point => {
        const box = el.getBoundingClientRect();
        return {
          x: box.left - paperBox.left + box.width / 2,
          y: box.top - paperBox.top + box.height / 2,
        };
      };
      setCursorTargets({ keep: centerOf(keep), revert: centerOf(revert) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const isKept = phase === 'kept' || phase === 'pressRevert';
  const isReverted = phase === 'reverted';
  const isPressing = phase === 'pressKeep' || phase === 'pressRevert';

  const cursorTarget =
    phase === 'kept' || phase === 'pressRevert' ? cursorTargets?.revert : cursorTargets?.keep;
  const cursorVisible = !reducedMotion && phase !== 'reverted' && cursorTarget !== undefined;

  return (
    <Paper
      ref={paperRef}
      withBorder
      p="sm"
      radius="md"
      maw={560}
      w="100%"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `3px solid ${isReverted ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-green-6)'}`,
        opacity: isReverted ? 0.6 : 1,
        transition: 'border-color 0.4s ease, opacity 0.4s ease',
      }}
    >
      <Group justify="space-between" align="center" mb={6} wrap="nowrap">
        <Text size="xs" c="dimmed" fw={600}>
          Suggested rewrite
        </Text>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            ref={keepRef}
            size="sm"
            variant={phase === 'pressKeep' || isKept ? 'filled' : 'light'}
            color="green"
            aria-label="Keep change"
            style={{ transition: 'transform 0.15s ease', transform: phase === 'pressKeep' ? 'scale(0.88)' : undefined }}
          >
            <IconCheck size={14} />
          </ActionIcon>
          <ActionIcon
            ref={revertRef}
            size="sm"
            variant={phase === 'pressRevert' || isReverted ? 'filled' : 'light'}
            color={isReverted ? 'green' : 'gray'}
            aria-label="Revert to original"
            style={{ transition: 'transform 0.15s ease', transform: phase === 'pressRevert' ? 'scale(0.88)' : undefined }}
          >
            <IconArrowBackUp size={14} />
          </ActionIcon>
        </Group>
      </Group>
      <Text component="div" size="sm" style={{ lineHeight: 1.6 }}>
        Led a team{' '}
        {!isKept && (
          <span style={isReverted ? plainStyle : removedStyle}>working on internal tools</span>
        )}
        {!isKept && !isReverted && ' '}
        {!isReverted && (
          <span style={isKept ? plainStyle : addedStyle}>
            of 5 engineers shipping React dashboards used by 2,000+ internal users
          </span>
        )}
        , cutting report turnaround
        {!isReverted && (
          <span style={isKept ? plainStyle : addedStyle}> from days to hours</span>
        )}
        .
      </Text>
      <div
        aria-hidden
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

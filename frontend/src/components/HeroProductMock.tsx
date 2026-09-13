import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { ActionIcon, Badge, Box, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import {
  IconArrowBackUp,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileTypeDocx,
  IconPlus,
  IconPointerFilled,
  IconRefresh,
  IconTargetArrow,
} from '@tabler/icons-react';
import { SAMPLE_TAILOR_RESULT } from '../lib/mockTailor';
import DiffText from './DiffText';
import RequirementsCoverage from './RequirementsCoverage';

type Phase =
  | 'original'
  | 'diff'
  | 'pressRevert'
  | 'reverted'
  | 'pressReapply'
  | 'reapplied'
  | 'moveToGap'
  | 'pressAdd'
  | 'added';

type Point = { x: number; y: number };

const PHASE_DURATIONS: Record<Phase, number> = {
  original: 1100,
  diff: 2200,
  pressRevert: 420,
  reverted: 1800,
  pressReapply: 420,
  reapplied: 1300,
  moveToGap: 750,
  pressAdd: 420,
  added: 3000,
};

const NEXT_PHASE: Record<Phase, Phase> = {
  original: 'diff',
  diff: 'pressRevert',
  pressRevert: 'reverted',
  reverted: 'pressReapply',
  pressReapply: 'reapplied',
  reapplied: 'moveToGap',
  moveToGap: 'pressAdd',
  pressAdd: 'added',
  added: 'original',
};

const PRIMARY_CHANGE = SAMPLE_TAILOR_RESULT.changes[0];
const SECONDARY_CHANGE = SAMPLE_TAILOR_RESULT.changes[2];
const TOTAL_REQUIREMENTS = 9;
const BASE_COVERED = 4;
const GAP_TEXT = 'GraphQL APIs';
const DRAFT_BULLET =
  '- Designed and shipped GraphQL APIs for checkout, serving 200+ partner clients';

const stripBullet = (text: string): string => text.replace(/^-\s*/, '');

type MockBulletProps = {
  original: string;
  tailored: string;
  showDiff: boolean;
  reverted: boolean;
  pressing?: boolean;
  revertRef?: Ref<HTMLButtonElement>;
};

const MockBullet = ({
  original,
  tailored,
  showDiff,
  reverted,
  pressing = false,
  revertRef,
}: MockBulletProps) => {
  const borderColor = !showDiff
    ? 'var(--mantine-color-dark-4)'
    : reverted
      ? 'var(--mantine-color-gray-6)'
      : 'var(--mantine-color-green-6)';

  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        opacity: reverted ? 0.6 : 1,
        transition: 'border-color 0.4s ease, opacity 0.4s ease',
      }}
    >
      <Group align="center" wrap="nowrap" gap="sm">
        <Box style={{ flex: 1, minWidth: 0, display: 'grid' }}>
          <Box
            aria-hidden={!showDiff || reverted}
            style={{
              gridArea: '1 / 1',
              opacity: showDiff && !reverted ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          >
            <DiffText original={stripBullet(original)} tailored={stripBullet(tailored)} />
          </Box>
          <Text
            component="div"
            size="sm"
            aria-hidden={showDiff && !reverted}
            style={{
              gridArea: '1 / 1',
              lineHeight: 1.55,
              opacity: showDiff && !reverted ? 0 : 1,
              transition: 'opacity 0.4s ease',
            }}
          >
            {stripBullet(original)}
          </Text>
        </Box>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            ref={revertRef}
            size="sm"
            variant={reverted ? 'filled' : 'light'}
            color={reverted ? 'green' : 'gray'}
            aria-hidden
            tabIndex={-1}
            style={{
              transition: 'transform 0.15s ease',
              transform: pressing ? 'scale(0.85)' : undefined,
              opacity: showDiff ? 1 : 0.35,
            }}
          >
            {reverted ? <IconRefresh size={13} /> : <IconArrowBackUp size={13} />}
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="light"
            color="gray"
            aria-hidden
            tabIndex={-1}
            style={{ opacity: showDiff ? 1 : 0.35 }}
          >
            <IconCopy size={13} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
};

const HeroProductMock = () => {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'added' : 'original');
  const frameRef = useRef<HTMLDivElement>(null);
  const revertRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [revertPoint, setRevertPoint] = useState<Point | null>(null);
  const [addPoint, setAddPoint] = useState<Point | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setPhase('added');
      return;
    }
    const timeout = window.setTimeout(() => setPhase(NEXT_PHASE[phase]), PHASE_DURATIONS[phase]);
    return () => window.clearTimeout(timeout);
  }, [phase, reducedMotion]);

  useEffect(() => {
    const measure = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const frameBox = frame.getBoundingClientRect();
      const toPoint = (element: HTMLElement | null): Point | null => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          x: box.left - frameBox.left + box.width / 2,
          y: box.top - frameBox.top + box.height / 2,
        };
      };
      setRevertPoint(toPoint(revertRef.current));
      setAddPoint(toPoint(addRef.current));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const showDiff = phase !== 'original';
  const primaryReverted = phase === 'reverted' || phase === 'pressReapply';
  const pressingRevert = phase === 'pressRevert' || phase === 'pressReapply';
  const cursorAtGap = phase === 'moveToGap' || phase === 'pressAdd' || phase === 'added';
  const pressingAdd = phase === 'pressAdd';
  const draftAdded = phase === 'added';

  const coveredByChanges = !showDiff ? 0 : primaryReverted ? 2 : 3;
  const coveredByAdded = draftAdded ? 1 : 0;
  const coveredCount = BASE_COVERED + coveredByChanges + coveredByAdded;
  const unresolvedGapCount = TOTAL_REQUIREMENTS - coveredCount;

  const cursorTarget = cursorAtGap ? addPoint : revertPoint;
  const cursorVisible = !reducedMotion && cursorTarget !== null;
  const cursorPressing = pressingRevert || pressingAdd;

  return (
    <Paper
      ref={frameRef}
      withBorder
      radius="lg"
      maw={560}
      w="100%"
      aria-hidden
      style={{
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        background: 'var(--mantine-color-dark-7)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(34, 184, 207, 0.08)',
      }}
    >
      <Group
        justify="space-between"
        align="center"
        wrap="nowrap"
        px="md"
        py={10}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-dark-8)',
        }}
      >
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={22} radius="sm" variant="light" color="cyan">
            <IconFileTypeDocx size={13} />
          </ThemeIcon>
          <Text size="xs" fw={600} truncate>
            Jordan_Ellis_Resume.docx
          </Text>
          <Text size="xs" c="dimmed" truncate visibleFrom="xs">
            → Senior Frontend Engineer · Acme
          </Text>
        </Group>
        <Badge
          variant="light"
          color="cyan"
          size="sm"
          radius="sm"
          leftSection={<IconDownload size={11} />}
          style={{ flexShrink: 0, textTransform: 'none', fontWeight: 600 }}
        >
          Export
        </Badge>
      </Group>

      <Stack gap={10} p="md">
        <RequirementsCoverage
          coveredCount={coveredCount}
          totalCount={TOTAL_REQUIREMENTS}
          baseCoveredCount={BASE_COVERED}
          coveredByChangesCount={coveredByChanges}
          coveredByAddedCount={coveredByAdded}
          availableFillerCount={showDiff && !draftAdded ? 1 : 0}
          unresolvedGapCount={unresolvedGapCount}
        />

        <MockBullet
          original={PRIMARY_CHANGE.original}
          tailored={PRIMARY_CHANGE.tailored}
          showDiff={showDiff}
          reverted={primaryReverted}
          pressing={pressingRevert}
          revertRef={revertRef}
        />
        <MockBullet
          original={SECONDARY_CHANGE.original}
          tailored={SECONDARY_CHANGE.tailored}
          showDiff={showDiff}
          reverted={false}
        />

        <Box>
          <Box
            px="sm"
            py={8}
            style={{
              borderRadius: 10,
              border: `1px dashed ${
                draftAdded ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-orange-6)'
              }`,
              background: draftAdded ? 'rgba(64, 192, 87, 0.05)' : 'rgba(232, 145, 45, 0.06)',
              transition: 'border-color 0.4s ease, background-color 0.4s ease',
            }}
          >
            <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
              <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                <IconTargetArrow
                  size={14}
                  stroke={1.8}
                  color={
                    draftAdded ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-orange-5)'
                  }
                  style={{ flexShrink: 0, transition: 'color 0.4s ease' }}
                />
                <Text size="xs" fw={600} truncate>
                  {GAP_TEXT}
                </Text>
                <Text size="xs" c="dimmed" truncate visibleFrom="xs">
                  {draftAdded ? 'Draft bullet added' : 'Missing from your resume'}
                </Text>
              </Group>
              <ActionIcon
                ref={addRef}
                size="sm"
                variant={draftAdded ? 'filled' : 'light'}
                color={draftAdded ? 'green' : 'orange'}
                aria-hidden
                tabIndex={-1}
                style={{
                  flexShrink: 0,
                  transition: 'transform 0.15s ease',
                  transform: pressingAdd ? 'scale(0.85)' : undefined,
                }}
              >
                {draftAdded ? <IconCheck size={13} /> : <IconPlus size={13} />}
              </ActionIcon>
            </Group>
            <Box
              style={{
                display: 'grid',
                gridTemplateRows: draftAdded ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.4s ease',
              }}
            >
              <Box style={{ overflow: 'hidden' }}>
                <Text
                  size="sm"
                  pt={8}
                  style={{
                    lineHeight: 1.55,
                    opacity: draftAdded ? 1 : 0,
                    transition: 'opacity 0.4s ease 0.15s',
                  }}
                >
                  <span
                    style={{
                      backgroundColor: 'rgba(64, 192, 87, 0.16)',
                      color: 'var(--mantine-color-green-3)',
                      borderRadius: 3,
                      padding: '0 2px',
                    }}
                  >
                    {stripBullet(DRAFT_BULLET)}
                  </span>
                </Text>
              </Box>
            </Box>
          </Box>
          <Box
            aria-hidden
            px="sm"
            style={{
              display: 'grid',
              gridTemplateRows: draftAdded ? '0fr' : '1fr',
              transition: 'grid-template-rows 0.4s ease',
            }}
          >
            <Box style={{ overflow: 'hidden' }}>
              <Text size="sm" pt={8} style={{ lineHeight: 1.55, visibility: 'hidden' }}>
                <span style={{ padding: '0 2px' }}>{stripBullet(DRAFT_BULLET)}</span>
              </Text>
            </Box>
          </Box>
        </Box>
      </Stack>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: 'none',
          opacity: cursorVisible ? 1 : 0,
          transform: cursorTarget
            ? `translate(${cursorTarget.x - 5}px, ${cursorTarget.y - 3}px) scale(${
                cursorPressing ? 0.8 : 1
              })`
            : undefined,
          transition: 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
          color: 'var(--mantine-color-text)',
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))',
        }}
      >
        <IconPointerFilled size={18} />
      </div>
    </Paper>
  );
};

export default HeroProductMock;

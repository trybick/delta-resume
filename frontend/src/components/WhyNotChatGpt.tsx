import { Box, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import DeltaLogo from './DeltaLogo';

type ComparisonRow = {
  label: string;
  chatGpt: string;
  deltaResume: string;
};

const ROWS: ComparisonRow[] = [
  {
    label: 'What changed',
    chatGpt: 'A rewritten wall of text. You spot the edits yourself.',
    deltaResume: 'Every edit as a word-level diff, bullet by bullet.',
  },
  {
    label: 'Your control',
    chatGpt: 'Take it all or re-prompt and hope.',
    deltaResume: 'Approve or revert each change with one click.',
  },
  {
    label: 'Your formatting',
    chatGpt: 'Plain text. Rebuild your document by hand.',
    deltaResume: 'Export in your original Word formatting.',
  },
  {
    label: 'Job requirements',
    chatGpt: 'No idea what the posting asks for that you lack.',
    deltaResume: 'Coverage bar plus every missing requirement flagged.',
  },
  {
    label: 'Cover letter',
    chatGpt: 'A second prompt, a second copy-paste.',
    deltaResume: 'Written to match, in the same run.',
  },
  {
    label: 'One page',
    chatGpt: 'Fiddle with margins and font sizes.',
    deltaResume: 'Fit to one page automatically on export.',
  },
];

const WhyNotChatGpt = () => (
  <Stack id="why-not-chatgpt" gap="xl" align="center" py={{ base: 'xl', md: 48 }}>
    <Stack gap={6} align="center">
      <Title order={2} ta="center" fw={700} style={{ letterSpacing: '-0.015em' }}>
        Why not just paste it into ChatGPT?
      </Title>
      <Text size="md" c="dimmed" ta="center" maw={560} lh={1.5}>
        You can. You just won&apos;t see what it changed, and you&apos;ll rebuild your document
        afterwards. Delta Resume is built around the review step.
      </Text>
    </Stack>

    <Box
      className="compare-table"
      w="100%"
      maw={880}
      style={{
        borderRadius: 14,
        border: '1px solid var(--mantine-color-default-border)',
        overflow: 'hidden',
        background: 'var(--mantine-color-dark-7)',
      }}
    >
      <Box className="compare-row compare-row-header">
        <Box className="compare-cell compare-cell-label" />
        <Box className="compare-cell">
          <Text size="sm" fw={700} c="dimmed">
            ChatGPT
          </Text>
        </Box>
        <Box className="compare-cell compare-cell-delta">
          <Group gap={8} wrap="nowrap">
            <DeltaLogo size={22} />
            <Text size="sm" fw={700}>
              Delta Resume
            </Text>
          </Group>
        </Box>
      </Box>
      {ROWS.map((row) => (
        <Box key={row.label} className="compare-row">
          <Box className="compare-cell compare-cell-label">
            <Text size="sm" fw={600}>
              {row.label}
            </Text>
          </Box>
          <Box className="compare-cell">
            <Group gap={10} wrap="nowrap" align="flex-start">
              <ThemeIcon
                size={20}
                radius="xl"
                variant="light"
                color="red"
                style={{ flexShrink: 0 }}
              >
                <IconX size={12} />
              </ThemeIcon>
              <Text size="sm" c="dimmed" lh={1.45}>
                <Text span size="xs" fw={700} c="dimmed" hiddenFrom="sm" mr={6}>
                  ChatGPT
                </Text>
                {row.chatGpt}
              </Text>
            </Group>
          </Box>
          <Box className="compare-cell compare-cell-delta">
            <Group gap={10} wrap="nowrap" align="flex-start">
              <ThemeIcon
                size={20}
                radius="xl"
                variant="light"
                color="teal"
                style={{ flexShrink: 0 }}
              >
                <IconCheck size={12} />
              </ThemeIcon>
              <Text size="sm" lh={1.45}>
                <Text span size="xs" fw={700} c="cyan.4" hiddenFrom="sm" mr={6}>
                  Delta Resume
                </Text>
                {row.deltaResume}
              </Text>
            </Group>
          </Box>
        </Box>
      ))}
    </Box>
  </Stack>
);

export default WhyNotChatGpt;

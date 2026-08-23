import { Badge, Group, Paper, Text } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { proAccent } from '../lib/proAccent';

const COVER_LETTER_EXCERPT =
  'Dear Acme Hiring Team — your posting for a Senior Frontend Engineer caught my attention because it pairs the product problems I enjoy most with a stack I know deeply. In my current role I rebuilt the checkout flow in React and TypeScript, lifting conversion 12% on the company\u2019s highest-traffic surface\u2026';

const CoverLetterMockExample = () => (
  <Paper
    withBorder
    p="sm"
    radius="md"
    maw={560}
    w="100%"
    style={{ borderLeft: `3px solid ${proAccent.insightBorderColor}` }}
  >
    <Group gap={6} mb={6} wrap="nowrap">
      <IconMail size={14} color={proAccent.insightIconColor} />
      <Text size="xs" fw={600} c={proAccent.insightLabelColor}>
        Matching cover letter, written in the same run
      </Text>
      <Badge size="xs" variant="gradient" gradient={{ ...proAccent.gradient, deg: 45 }}>
        Pro
      </Badge>
    </Group>
    <Text size="sm" c="dimmed" lh={1.6} lineClamp={3}>
      {COVER_LETTER_EXCERPT}
    </Text>
  </Paper>
);

export default CoverLetterMockExample;

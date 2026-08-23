import { Badge, Box, Group, Paper, Text } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { proAccent } from '../lib/proAccent';

const CoverLetterMockExample = () => (
  <Paper
    withBorder
    p="sm"
    radius="md"
    maw={560}
    w="100%"
    style={{ borderLeft: `3px solid ${proAccent.insightBorderColor}` }}
  >
    <Group justify="space-between" mb={6}>
      <Group gap={6}>
        <IconMail size={15} color={proAccent.insightIconColor} />
        <Text size="xs" fw={600} c={proAccent.insightLabelColor}>
          Matching cover letter, written in the same run
        </Text>
      </Group>
      <Badge size="sm" variant="gradient" gradient={{ ...proAccent.gradient, deg: 45 }}>
        Pro
      </Badge>
    </Group>
    <Box
      style={{
        maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
      }}
    >
      <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
        Dear Hiring Team,
        <br />
        When I read that you need a frontend lead who can own dashboards end to end, it sounded like
        my last role. I led a team of 5 engineers shipping React dashboards used by 2,000+ internal
        users, cutting report turnaround from days to hours...
      </Text>
    </Box>
  </Paper>
);

export default CoverLetterMockExample;

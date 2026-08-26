import { Badge, Box, Group, Paper, Stack, Text } from '@mantine/core';

const CoverLetterMockExample = () => {
  return (
    <Stack gap={6} align="center" w="100%">
      <Paper
        withBorder
        p="sm"
        radius="md"
        maw={560}
        w="100%"
        style={{ borderLeft: '3px solid var(--mantine-color-cyan-6)' }}
      >
        <Group justify="space-between" align="center" mb={6} wrap="nowrap">
          <Text size="xs" c="dimmed" fw={600}>
            Matching cover letter
          </Text>
          <Badge size="sm" variant="light" color="teal">
            Included free
          </Badge>
        </Group>
        <Box
          style={{
            maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
          }}
        >
          <Text size="sm" c="dimmed" lineClamp={3} style={{ lineHeight: 1.6 }}>
            Dear Hiring Team,
            <br />
            When I read that you need a frontend lead who can own dashboards end to end, it sounded
            like my last role. I led a team of 5 engineers shipping React dashboards used by 2,000+
            internal users, cutting report turnaround from days to hours...
          </Text>
        </Box>
      </Paper>
      <Text size="xs" c="dimmed" ta="center">
        A matching cover letter, written in the same run.
      </Text>
    </Stack>
  );
};

export default CoverLetterMockExample;

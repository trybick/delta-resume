import { Badge, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { useProPlan } from '../hooks/useProPlan';
import { proAccent } from '../lib/proAccent';

const CoverLetterMockExample = () => {
  const { monthlyPrice, annualMonthlyPrice } = useProPlan();
  const proPrice = annualMonthlyPrice ?? monthlyPrice;

  return (
    <Stack gap={6} align="center" w="100%">
      <Paper
        withBorder
        p="sm"
        radius="md"
        maw={560}
        w="100%"
        pos="relative"
        style={{ borderLeft: '3px solid var(--mantine-color-cyan-6)' }}
      >
        <Group gap={6} pos="absolute" top={10} right={10} align="center" wrap="nowrap">
          {proPrice && (
            <Text size="xs" c="dimmed" fw={500}>
              from {proPrice}/mo
            </Text>
          )}
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
          <Text
            size="sm"
            c="dimmed"
            lineClamp={3}
            style={{ lineHeight: 1.6, paddingRight: proPrice ? 128 : 44 }}
          >
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

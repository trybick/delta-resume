import { Badge, Box, Button, Card, Group, Stack, Text } from '@mantine/core';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { prependCoverLetterDate } from '../lib/formatCoverLetter';
import { proAccent } from '../lib/proAccent';
import { useProUpgradeCtaLabel } from '../hooks/useProPlan';
import type { CoverLetterResult } from '../lib/types';

type ExampleCoverLetterProps = {
  exampleResult: CoverLetterResult;
  isProPlan: boolean;
  onUpgradeClick: () => void;
};

const ExampleCoverLetter = ({
  exampleResult,
  isProPlan,
  onUpgradeClick,
}: ExampleCoverLetterProps) => {
  const upgradeCtaLabel = useProUpgradeCtaLabel();

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        <Group gap="sm">
          <Badge color="cyan" variant="light">
            Example
          </Badge>
        </Group>
        {!isProPlan && (
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm" c="dimmed">
              On the Pro plan, every tailor run also writes a cover letter like this one.
            </Text>
            <Button
              size="xs"
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
              onClick={() => {
                trackEvent(AnalyticsEvents.CoverLetterUpgradeExample);
                onUpgradeClick();
              }}
            >
              {upgradeCtaLabel}
            </Button>
          </Group>
        )}
        <Box
          p="md"
          style={{
            borderRadius: 8,
            border: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-default-hover)',
          }}
        >
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {prependCoverLetterDate(exampleResult.letter)}
          </Text>
        </Box>
      </Stack>
    </Card>
  );
};

export default ExampleCoverLetter;

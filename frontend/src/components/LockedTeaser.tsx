import { Badge, Button, Card, Center, Group, Stack, Text, Title } from '@mantine/core';
import { IconEye, IconLock } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { prependCoverLetterDate } from '../lib/formatCoverLetter';
import { SAMPLE_COVER_LETTER_RESULT } from '../lib/mockTailor';
import { proAccent } from '../lib/proAccent';
import { useProUpgradeCtaLabel } from '../hooks/useProPlan';

type LockedTeaserProps = {
  isProPlan: boolean;
  onUpgradeClick: () => void;
  onShowExample?: () => void;
};

const LockedTeaser = ({ isProPlan, onUpgradeClick, onShowExample }: LockedTeaserProps) => {
  const upgradeCtaLabel = useProUpgradeCtaLabel();

  return (
    <Card withBorder shadow="xs" padding="lg" style={{ position: 'relative', overflow: 'hidden' }}>
      <Stack gap="md" style={{ filter: 'blur(5px)', userSelect: 'none' }} aria-hidden>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {prependCoverLetterDate(SAMPLE_COVER_LETTER_RESULT.letter)}
        </Text>
      </Stack>
      <Center
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 55%, transparent)',
        }}
      >
        <Stack align="center" gap="xs" p="md">
          <IconLock size={32} color="var(--mantine-primary-color-filled)" />
          <Group gap={6}>
            <Title order={5}>Cover letters are a Pro feature</Title>
            <Badge variant="gradient" gradient={{ ...proAccent.gradient, deg: 45 }}>
              Pro
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" ta="center" maw={340}>
            Every tailor run also writes a matching cover letter, ready to copy or download as a
            polished .docx.
          </Text>
          {!isProPlan && (
            <Button
              mt={4}
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
              onClick={() => {
                trackEvent(AnalyticsEvents.CoverLetterUpgradeTeaser);
                onUpgradeClick();
              }}
            >
              {upgradeCtaLabel}
            </Button>
          )}
          {onShowExample && (
            <Button
              variant="light"
              leftSection={<IconEye size={16} />}
              onClick={() => {
                trackEvent(AnalyticsEvents.PreviewExample);
                onShowExample();
              }}
            >
              Preview an example
            </Button>
          )}
        </Stack>
      </Center>
    </Card>
  );
};

export default LockedTeaser;

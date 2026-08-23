import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconFileExport, IconListCheck, IconRobot, IconSparkles } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { proAccent } from '../lib/proAccent';

type AtsPoint = {
  icon: typeof IconRobot;
  title: string;
  description: string;
  isPro?: boolean;
};

const ATS_POINTS: AtsPoint[] = [
  {
    icon: IconRobot,
    title: 'Mirror the job post\u2019s language',
    description:
      'Screening software ranks your resume on how closely it matches the job post. Your bullets are rewritten to use its skills and keywords \u2014 and you approve every change.',
  },
  {
    icon: IconListCheck,
    title: 'Leave no requirement unaddressed',
    description:
      'Delta Resume flags every requirement your resume doesn\u2019t show yet and drafts a ready-to-edit bullet for each gap, placed right where it belongs.',
    isPro: true,
  },
  {
    icon: IconFileExport,
    title: 'Exports that stay clean',
    description:
      'Download your tailored resume as a DOCX or PDF \u2014 keeping your original formatting or in a clean, simple layout \u2014 or copy it straight into the application form.',
  },
];

type LandingAtsSectionProps = {
  onStartClick?: () => void;
};

const LandingAtsSection = ({ onStartClick }: LandingAtsSectionProps) => {
  const handleStartClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'ats' });
    onStartClick?.();
  };

  return (
    <Stack gap="xl" align="center">
      <Stack gap={4} align="center">
        <Title order={2} ta="center">
          Get past the screening software
        </Title>
        <Text size="sm" c="dimmed" ta="center" maw={520}>
          Applicant tracking systems scan for the job post&apos;s keywords before a recruiter reads
          a word. Delta Resume is built for that first read &mdash; and the human one after it.
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" w="100%">
        {ATS_POINTS.map((point) => {
          const PointIcon = point.icon;
          return (
            <Paper key={point.title} withBorder p="lg" radius="md">
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={36} radius="md" variant="light">
                    <PointIcon size={19} />
                  </ThemeIcon>
                  {point.isPro && (
                    <Badge size="sm" variant="light" color={proAccent.badgeColor}>
                      Pro
                    </Badge>
                  )}
                </Group>
                <Text fw={600}>{point.title}</Text>
                <Text size="sm" c="dimmed" lh={1.5}>
                  {point.description}
                </Text>
              </Stack>
            </Paper>
          );
        })}
      </SimpleGrid>
      {onStartClick && (
        <Button
          size="md"
          variant="light"
          leftSection={<IconSparkles size={16} />}
          onClick={handleStartClick}
        >
          Try it on your resume &mdash; free
        </Button>
      )}
    </Stack>
  );
};

export default LandingAtsSection;

import { useEffect, useState } from 'react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Container,
  Divider,
  Group,
  List,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClipboardText,
  IconDatabaseOff,
  IconFileText,
  IconFolders,
  IconGitCompare,
  IconRobotOff,
  IconSparkles,
} from '@tabler/icons-react';
import DiffMockExample from './DiffMockExample';
import LegalModal from './LegalModal';
import ProFeatureList from './ProFeatureList';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { PRIVACY_POLICY } from '../lib/legalContent';
import type { LegalDocument } from '../lib/legalContent';
import { proAccent } from '../lib/proAccent';
import { appTheme } from '../lib/theme';
import { useProPlan } from '../hooks/useProPlan';

type LandingStripProps = {
  collapsible: boolean;
  freeCreditTotal: number | null;
  showUpgradeButton: boolean;
  onUpgradeClick: () => void;
  onStartClick?: () => void;
};

type HowItWorksStep = {
  icon: typeof IconFileText;
  title: string;
  description: string;
};

const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    icon: IconFileText,
    title: 'Add your resume',
    description: 'Upload a .docx or .pdf, or paste the text. No account needed to try it.',
  },
  {
    icon: IconClipboardText,
    title: 'Paste the job post',
    description: 'Drop in the job description you\u2019re applying for, straight from the listing.',
  },
  {
    icon: IconGitCompare,
    title: 'Review every change',
    description:
      'Your bullets are rewritten to match the role. You see each edit as an inline diff and keep or revert it.',
  },
];

type PrivacyPoint = {
  icon: typeof IconDatabaseOff;
  title: string;
  description: string;
};

const PRIVACY_POINTS: PrivacyPoint[] = [
  {
    icon: IconDatabaseOff,
    title: 'Tailoring runs aren\u2019t stored',
    description:
      'Your resume and the job post are processed in memory to generate suggestions, then discarded. Guest runs never touch a database.',
  },
  {
    icon: IconFolders,
    title: 'Saved only with an account',
    description:
      'When you\u2019re signed in, your resume is saved to your account after a run so you can reuse it. Rename or delete it anytime.',
  },
  {
    icon: IconRobotOff,
    title: 'Never used for training',
    description:
      'Your documents are used only to tailor your resume. They are not used to train AI models.',
  },
];

const getFreePlanFeatures = (freeCreditTotal: number | null): string[] => [
  freeCreditTotal !== null
    ? `${freeCreditTotal} free ${freeCreditTotal === 1 ? 'credit' : 'credits'}, no account needed`
    : 'Free credits, no account needed',
  'Inline diff review of every change',
  'Copy or export your tailored resume',
  'Multiple export options, including fit to one page',
];

const LandingStrip = ({
  collapsible,
  freeCreditTotal,
  showUpgradeButton,
  onUpgradeClick,
  onStartClick,
}: LandingStripProps) => {
  const [openDocument, setOpenDocument] = useState<LegalDocument | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { monthlyPrice, annualMonthlyPrice, isLoading: isLoadingProPrice } = useProPlan();
  const proPrice = annualMonthlyPrice ?? monthlyPrice;
  const showContent = !collapsible || expanded;
  const freePlanFeatures = getFreePlanFeatures(freeCreditTotal);

  useEffect(() => {
    if (collapsible) {
      setExpanded(false);
    }
  }, [collapsible]);

  const handleOpenPrivacyPolicy = () => {
    trackEvent(AnalyticsEvents.LandingPrivacyPolicy);
    setOpenDocument(PRIVACY_POLICY);
  };

  const handleUpgradeClick = () => {
    trackEvent(AnalyticsEvents.LandingUpgradeClick);
    onUpgradeClick();
  };

  const handleStartClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'bottom' });
    onStartClick?.();
  };

  const handleToggleExpanded = () => {
    trackEvent(AnalyticsEvents.LandingStripToggle, { expanded: !expanded });
    setExpanded(!expanded);
  };

  return (
    <Box component="section" pb="xl">
      <Container size="lg">
        <Stack gap={0} pt="xl">
          <Divider />
          {collapsible && (
            <Group justify="center" pt="lg">
              <Button
                variant="subtle"
                color="gray"
                onClick={handleToggleExpanded}
                rightSection={
                  expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />
                }
              >
                How it works &amp; pricing
              </Button>
            </Group>
          )}
        </Stack>
        <Collapse expanded={showContent}>
          <Stack gap={56} py="xl">
            <Stack gap="xl" align="center">
              <Stack gap={4} align="center">
                <Title order={2} ta="center">
                  How it works
                </Title>
                <Text size="sm" c="dimmed" ta="center" maw={520}>
                  Three steps from job post to tailored resume. On Pro, a matching cover letter is
                  written for you at the same time.
                </Text>
              </Stack>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" w="100%">
                {HOW_IT_WORKS_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  return (
                    <Card key={step.title} withBorder padding="lg" radius="md">
                      <Stack gap="sm">
                        <Group gap="sm">
                          <ThemeIcon size={36} radius="md" variant="light">
                            <StepIcon size={19} />
                          </ThemeIcon>
                          <Badge size="lg" variant="light" color="cyan">
                            Step {index + 1}
                          </Badge>
                        </Group>
                        <Text fw={600}>{step.title}</Text>
                        <Text size="sm" c="dimmed" lh={1.5}>
                          {step.description}
                        </Text>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
              <Stack
                gap={6}
                align="center"
                w="100%"
                hiddenFrom={onStartClick ? 'md' : undefined}
              >
                <DiffMockExample />
                <Text size="xs" c="dimmed" ta="center">
                  Every rewrite is shown as an inline diff. Keep it or revert it with one click.
                </Text>
              </Stack>
            </Stack>

            <Divider />

            <Stack gap="xl" align="center">
              <Stack gap={4} align="center">
                <Title order={2} ta="center">
                  Your resume stays yours
                </Title>
                <Text size="sm" c="dimmed" ta="center" maw={520}>
                  We built Delta Resume so you never have to put blind trust in AI. Every change
                  is yours to keep or reject, and your documents stay private.
                </Text>
              </Stack>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" w="100%">
                {PRIVACY_POINTS.map((point) => {
                  const PointIcon = point.icon;
                  return (
                    <Stack key={point.title} gap="sm" align="center">
                      <ThemeIcon size={40} radius="md" variant="light" color="teal">
                        <PointIcon size={21} />
                      </ThemeIcon>
                      <Text fw={600} ta="center">
                        {point.title}
                      </Text>
                      <Text size="sm" c="dimmed" ta="center" lh={1.5}>
                        {point.description}
                      </Text>
                    </Stack>
                  );
                })}
              </SimpleGrid>
              <Anchor component="button" type="button" size="sm" onClick={handleOpenPrivacyPolicy}>
                Read the full privacy policy
              </Anchor>
            </Stack>

            <Divider />

            <Stack gap="xl" align="center">
              <Stack gap={4} align="center">
                <Title order={2} ta="center">
                  Simple pricing
                </Title>
                <Text size="sm" c="dimmed" ta="center" maw={520}>
                  Try it free, no account needed. Upgrade when you&apos;re applying in volume.
                </Text>
              </Stack>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" w="100%" maw={760}>
                <Card withBorder padding="lg" radius="lg">
                  <Stack gap="md" h="100%">
                    <Stack gap={4}>
                      <Text fw={700} size="xl">
                        Free
                      </Text>
                      <Group gap={6} align="baseline">
                        <Text fw={700} size="1.75rem" lh={1}>
                          $0
                        </Text>
                      </Group>
                    </Stack>
                    <List
                      spacing="xs"
                      size="sm"
                      icon={
                        <ThemeIcon size={20} radius="xl" variant="light" color="teal">
                          <IconCheck size={12} />
                        </ThemeIcon>
                      }
                    >
                      {freePlanFeatures.map((feature) => (
                        <List.Item key={feature}>{feature}</List.Item>
                      ))}
                    </List>
                  </Stack>
                </Card>
                <Paper
                  p="lg"
                  radius="lg"
                  style={{
                    border: '1px solid var(--mantine-color-cyan-9)',
                    background:
                      'linear-gradient(160deg, rgba(34, 184, 207, 0.08) 0%, rgba(34, 139, 230, 0.04) 60%, transparent 100%)',
                  }}
                >
                  <Stack gap="md" h="100%">
                    <Stack gap={4}>
                      <Text
                        fw={700}
                        size="xl"
                        variant="gradient"
                        gradient={{ ...proAccent.gradient, deg: 45 }}
                      >
                        Pro
                      </Text>
                      <Group gap={6} align="baseline">
                        {proPrice ? (
                          <Text fw={700} size="1.75rem" lh={1}>
                            {proPrice}
                          </Text>
                        ) : isLoadingProPrice ? (
                          <Skeleton width={64} height={28} />
                        ) : null}
                        {(proPrice || isLoadingProPrice) && (
                          <Text size="sm" c="dimmed">
                            / month
                          </Text>
                        )}
                      </Group>
                    </Stack>
                    <ProFeatureList />
                    {showUpgradeButton && (
                      <Button
                        mt="auto"
                        size="md"
                        fullWidth
                        variant="gradient"
                        gradient={{ ...proAccent.gradient, deg: 45 }}
                        leftSection={<IconSparkles size={18} />}
                        onClick={handleUpgradeClick}
                      >
                        Upgrade to Pro
                      </Button>
                    )}
                  </Stack>
                </Paper>
              </SimpleGrid>
              <Text size="xs" c="dimmed" ta="center">
                Cancel anytime. Pro credits renew every month.
              </Text>
            </Stack>

            {onStartClick && (
              <Stack gap="sm" align="center">
                <Button
                  size="lg"
                  fullWidth
                  maw={420}
                  variant="gradient"
                  gradient={{ ...appTheme.gradient, deg: 45 }}
                  leftSection={<IconSparkles size={18} />}
                  onClick={handleStartClick}
                >
                  Tailor my resume for free
                </Button>
              </Stack>
            )}
          </Stack>
        </Collapse>
      </Container>
      <LegalModal document={openDocument} onClose={() => setOpenDocument(null)} />
    </Box>
  );
};

export default LandingStrip;

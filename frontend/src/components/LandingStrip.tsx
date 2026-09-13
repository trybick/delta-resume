import { useEffect, useState } from 'react';
import {
  Anchor,
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
  IconDatabaseOff,
  IconFolders,
  IconRobotOff,
  IconSparkles,
} from '@tabler/icons-react';
import CoverLetterMockExample from './CoverLetterMockExample';
import DiffMockExample from './DiffMockExample';
import LandingFaqSection from './LandingFaqSection';
import LegalModal from './LegalModal';
import ProFeatureList from './ProFeatureList';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { PRIVACY_POLICY } from '../lib/legalContent';
import type { LegalDocument } from '../lib/legalContent';
import { proAccent } from '../lib/proAccent';
import { useProPlan } from '../hooks/useProPlan';

type LandingStripProps = {
  collapsible: boolean;
  freeCreditTotal: number | null;
  showUpgradeButton: boolean;
  onUpgradeClick: () => void;
  onStartClick?: () => void;
  heroVariant?: string;
};

type HowItWorksStep = {
  title: string;
  description: string;
};

const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    title: 'Add your resume',
    description: 'Upload a .docx or .pdf, or paste the text. No account needed to try it.',
  },
  {
    title: 'Paste the job post',
    description: 'Drop in the job description you\u2019re applying for, straight from the listing.',
  },
  {
    title: 'Review every change',
    description:
      'Your resume bullets are rewritten to match the role. You see each edit as an inline diff and keep or revert it.',
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
    title: 'Guest runs stay off our servers',
    description:
      'Your resume and the job post are processed in memory to generate suggestions, then discarded. Guest runs never touch a database.',
  },
  {
    icon: IconFolders,
    title: 'Saved only with an account',
    description:
      'When you\u2019re signed in, we save your resume, tailor results, cover letter, and application history so you can re-open and export later. Rename or delete anytime.',
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
    ? `1 tailor run as a guest, ${freeCreditTotal} with a free account`
    : 'Free tailor runs, no card required',
  'Every change shown as a diff you approve',
  'Matching cover letter on every run',
  'DOCX and PDF export on a clean template',
  'Fit to one page',
  'Your last 3 applications saved',
];

const LandingStrip = ({
  collapsible,
  freeCreditTotal,
  showUpgradeButton,
  onUpgradeClick,
  onStartClick,
  heroVariant,
}: LandingStripProps) => {
  const [openDocument, setOpenDocument] = useState<LegalDocument | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { monthlyPrice, annualMonthlyPrice, isLoading: isLoadingProPrice } = useProPlan();
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
    trackEvent(AnalyticsEvents.LandingCta, {
      placement: 'bottom',
      variant: heroVariant ?? 'default',
    });
    onStartClick?.();
  };

  const handleFreeStartClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, {
      placement: 'pricing_free',
      variant: heroVariant ?? 'default',
    });
    onStartClick?.();
  };

  const handleProStartClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, {
      placement: 'pricing_pro',
      variant: heroVariant ?? 'default',
    });
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
                  Your resume stays yours
                </Title>
                <Text size="sm" c="dimmed" ta="center" maw={520}>
                  Never trust the AI blindly: every change is yours to keep or reject, and your
                  documents stay private.
                </Text>
              </Stack>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" w="100%">
                {PRIVACY_POINTS.map((point) => {
                  const PointIcon = point.icon;
                  return (
                    <Card key={point.title} withBorder padding="lg" radius="md" h="100%">
                      <Stack gap="sm">
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon size={28} radius="xl" variant="light" color="teal">
                            <PointIcon size={15} />
                          </ThemeIcon>
                          <Text fw={600}>{point.title}</Text>
                        </Group>
                        <Text size="sm" c="dimmed" lh={1.5}>
                          {point.description}
                        </Text>
                      </Stack>
                    </Card>
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
                  How it works
                </Title>
                <Text size="sm" c="dimmed" ta="center" maw={520}>
                  Three steps from job post to tailored resume. Every run also writes a matching
                  cover letter.
                </Text>
              </Stack>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" w="100%">
                {HOW_IT_WORKS_STEPS.map((step, index) => (
                  <Card key={step.title} withBorder padding="lg" radius="md" h="100%">
                    <Stack gap="sm">
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon size={28} radius="xl" variant="light" color="cyan">
                          <Text size="sm" fw={700}>
                            {index + 1}
                          </Text>
                        </ThemeIcon>
                        <Text fw={600}>{step.title}</Text>
                      </Group>
                      <Text size="sm" c="dimmed" lh={1.5}>
                        {step.description}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
              <Stack gap="xl" align="center" w="100%">
                {!onStartClick && (
                  <Stack gap={6} align="center" w="100%">
                    <DiffMockExample />
                    <Text size="sm" c="dimmed" ta="center">
                      Every rewrite is shown as an inline diff. Revert anything you don't like with
                      one click.
                    </Text>
                  </Stack>
                )}
                <CoverLetterMockExample />
              </Stack>
            </Stack>

            <Divider />

            <Stack gap="xl" align="center">
              <Stack gap={4} align="center">
                <Title order={2} ta="center">
                  Simple pricing
                </Title>
                <Text size="sm" c="dimmed" ta="center" maw={520}>
                  Try it free, no account needed. Upgrade when you want the full requirements list,
                  draft bullets, original Word formatting, and unlimited history.
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
                    {onStartClick && (
                      <Button
                        mt="auto"
                        size="md"
                        fullWidth
                        variant="light"
                        color="teal"
                        leftSection={<IconSparkles size={18} />}
                        onClick={handleFreeStartClick}
                      >
                        Start for free
                      </Button>
                    )}
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
                      <Stack gap={6}>
                        <Group gap={6} align="baseline">
                          {monthlyPrice ? (
                            <Text fw={700} size="1.75rem" lh={1}>
                              {monthlyPrice}
                            </Text>
                          ) : isLoadingProPrice ? (
                            <Skeleton width={64} height={28} />
                          ) : null}
                          {(monthlyPrice || isLoadingProPrice) && (
                            <Text size="sm" c="dimmed">
                              / month
                            </Text>
                          )}
                        </Group>
                        {(annualMonthlyPrice || isLoadingProPrice) && (
                          <Group gap={6} align="baseline">
                            {annualMonthlyPrice ? (
                              <Text fw={600} size="md">
                                {annualMonthlyPrice}
                              </Text>
                            ) : (
                              <Skeleton width={48} height={18} />
                            )}
                            <Text size="sm" c="dimmed">
                              / month, billed annually
                            </Text>
                          </Group>
                        )}
                      </Stack>
                    </Stack>
                    <ProFeatureList compact={false} />
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
                    {!showUpgradeButton && onStartClick && (
                      <Button
                        mt="auto"
                        size="md"
                        fullWidth
                        variant="default"
                        onClick={handleProStartClick}
                      >
                        Start free, upgrade anytime
                      </Button>
                    )}
                  </Stack>
                </Paper>
              </SimpleGrid>
              <Text size="xs" c="dimmed" ta="center">
                Cancel anytime. Pro credits renew every month.
              </Text>
            </Stack>

            <Divider />

            <LandingFaqSection />

            {onStartClick && (
              <Stack gap="sm" align="center">
                <Button
                  size="lg"
                  fullWidth
                  maw={420}
                  leftSection={<IconSparkles size={18} />}
                  onClick={handleStartClick}
                >
                  Tailor my resume for free
                </Button>
                <Text size="xs" c="dimmed" ta="center">
                  One free run to start. No sign-up, no card required.
                </Text>
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

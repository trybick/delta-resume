import { useState } from 'react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
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
  IconClipboardText,
  IconDatabaseOff,
  IconFileText,
  IconFolders,
  IconGitCompare,
  IconRobotOff,
  IconSparkles,
} from '@tabler/icons-react';
import { LegalModal } from './AppFooter';
import { ProFeatureList } from './ProPlanShowcase';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { PRIVACY_POLICY } from '../lib/legalContent';
import type { LegalDocument } from '../lib/legalContent';
import { proAccent } from '../lib/proAccent';
import { useProPlan } from '../lib/proPlan';

type LandingStripProps = {
  onUpgradeClick: () => void;
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
      'Claude rewrites your bullets to match the role. You see each edit as an inline diff and keep or revert it.',
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

const FREE_PLAN_FEATURES = [
  '3 free tailor runs \u2014 no account needed',
  'Inline diff review of every change',
  'Copy your tailored resume',
  '1 saved resume with a free account',
];

const DiffMockExample = () => (
  <Paper
    withBorder
    p="sm"
    radius="md"
    maw={560}
    w="100%"
    style={{ borderLeft: '3px solid var(--mantine-color-green-6)' }}
  >
    <Text component="div" size="sm" style={{ lineHeight: 1.6 }}>
      Led a team{' '}
      <span
        style={{
          backgroundColor: 'rgba(250, 82, 82, 0.14)',
          color: 'var(--mantine-color-red-3)',
          textDecoration: 'line-through',
          borderRadius: 3,
          padding: '0 2px',
        }}
      >
        working on internal tools
      </span>{' '}
      <span
        style={{
          backgroundColor: 'rgba(64, 192, 87, 0.16)',
          color: 'var(--mantine-color-green-3)',
          borderRadius: 3,
          padding: '0 2px',
        }}
      >
        of 5 engineers shipping React dashboards used by 2,000+ internal users
      </span>
      , cutting report turnaround{' '}
      <span
        style={{
          backgroundColor: 'rgba(64, 192, 87, 0.16)',
          color: 'var(--mantine-color-green-3)',
          borderRadius: 3,
          padding: '0 2px',
        }}
      >
        from days to hours
      </span>
      .
    </Text>
  </Paper>
);

const LandingStrip = ({ onUpgradeClick }: LandingStripProps) => {
  const [openDocument, setOpenDocument] = useState<LegalDocument | null>(null);
  const { monthlyPrice, annualMonthlyPrice } = useProPlan();
  const proPrice = annualMonthlyPrice ?? monthlyPrice;

  const handleOpenPrivacyPolicy = () => {
    trackEvent(AnalyticsEvents.LandingPrivacyPolicy);
    setOpenDocument(PRIVACY_POLICY);
  };

  const handleUpgradeClick = () => {
    trackEvent(AnalyticsEvents.LandingUpgradeClick);
    onUpgradeClick();
  };

  return (
    <Box component="section" pb="xl">
      <Container size="lg">
        <Stack gap={56} py="xl">
          <Divider />

          <Stack gap="xl" align="center">
            <Stack gap={4} align="center">
              <Title order={2} ta="center">
                How it works
              </Title>
              <Text size="sm" c="dimmed" ta="center" maw={520}>
                Tailor your resume to any job description in under a minute, and stay in control
                of every word.
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
                        <Badge size="sm" variant="light" color="gray">
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
            <Stack gap={6} align="center" w="100%">
              <DiffMockExample />
              <Text size="xs" c="dimmed" ta="center">
                Every rewrite is shown as an inline diff — keep it or revert it with one click.
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
                We built Delta Resume so you don&apos;t have to trust a stranger with your work
                history.
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
                    {FREE_PLAN_FEATURES.map((feature) => (
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
                      ) : (
                        <Skeleton width={64} height={28} />
                      )}
                      <Text size="sm" c="dimmed">
                        / month
                      </Text>
                    </Group>
                  </Stack>
                  <ProFeatureList />
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
                </Stack>
              </Paper>
            </SimpleGrid>
            <Text size="xs" c="dimmed" ta="center">
              Cancel anytime. Pro credits renew every month.
            </Text>
          </Stack>
        </Stack>
      </Container>
      <LegalModal document={openDocument} onClose={() => setOpenDocument(null)} />
    </Box>
  );
};

export default LandingStrip;

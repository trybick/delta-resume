import { ActionIcon, Button, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconGift, IconX } from '@tabler/icons-react';
import { extraFreeRunsAfterSignup } from '../lib/constants';

type SignupBannerProps = {
  freeAccountTotal: number;
  onSignUpClick: () => void;
  onDismiss: () => void;
};

const SignupBanner = ({ freeAccountTotal, onSignUpClick, onDismiss }: SignupBannerProps) => {
  const extraRuns = extraFreeRunsAfterSignup(freeAccountTotal);
  const perks = [
    `${extraRuns} more free runs`,
    'This result saved to Your applications',
    'DOCX and PDF export',
  ];

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        position: 'relative',
        border: '1px solid rgba(34, 184, 207, 0.35)',
        background:
          'linear-gradient(135deg, rgba(34, 184, 207, 0.12) 0%, rgba(34, 139, 230, 0.05) 55%, transparent 100%)',
      }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label="Dismiss sign-up prompt"
        onClick={onDismiss}
        style={{ position: 'absolute', top: 8, right: 8 }}
      >
        <IconX size={14} />
      </ActionIcon>
      <Group align="flex-start" wrap="nowrap" gap="md" pr="lg">
        <ThemeIcon
          size={40}
          radius="md"
          variant="gradient"
          gradient={{ from: 'cyan.5', to: 'blue.5', deg: 45 }}
          style={{ flexShrink: 0 }}
        >
          <IconGift size={20} />
        </ThemeIcon>
        <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
          <Stack gap={2}>
            <Text fw={700} lh={1.3}>
              Like what you see? Get {extraRuns} more free runs.
            </Text>
            <Text size="sm" c="dimmed" lh={1.45}>
              A free account takes seconds with Google. No card required.
            </Text>
          </Stack>
          <Group gap="md" wrap="wrap">
            {perks.map((perk) => (
              <Group key={perk} gap={6} wrap="nowrap">
                <IconCheck size={14} color="var(--mantine-color-teal-4)" stroke={2.2} />
                <Text size="xs" c="gray.3" fw={500}>
                  {perk}
                </Text>
              </Group>
            ))}
          </Group>
          <Button size="sm" w={{ base: '100%', xs: 'fit-content' }} onClick={onSignUpClick}>
            Create a free account
          </Button>
        </Stack>
      </Group>
    </Paper>
  );
};

export default SignupBanner;

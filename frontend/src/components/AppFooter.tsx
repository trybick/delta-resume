import { useState } from 'react';
import { Anchor, Box, Container, Group, Text } from '@mantine/core';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { PRIVACY_POLICY, SUPPORT_EMAIL, TERMS_OF_SERVICE } from '../lib/legalContent';
import type { LegalDocument } from '../lib/legalContent';
import LegalModal from './LegalModal';

const AppFooter = () => {
  const [openDocument, setOpenDocument] = useState<LegalDocument | null>(null);

  const handleCloseModal = () => {
    if (openDocument) {
      trackEvent(AnalyticsEvents.CloseLegalModal, { document: openDocument.title });
    }
    setOpenDocument(null);
  };

  return (
    <Box
      component="footer"
      py="lg"
      px="xl"
      mt="auto"
      style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}
    >
      <Container size="xl">
        <Group justify="space-between" gap="sm">
          <Text size="sm" c="dimmed">
            © {new Date().getFullYear()} Delta Resume. All rights reserved.
          </Text>
          <Group gap="lg">
            <Anchor
              size="sm"
              c="dimmed"
              component="button"
              type="button"
              onClick={() => {
                trackEvent(AnalyticsEvents.TermsOfService);
                setOpenDocument(TERMS_OF_SERVICE);
              }}
            >
              Terms of Service
            </Anchor>
            <Anchor
              size="sm"
              c="dimmed"
              component="button"
              type="button"
              onClick={() => {
                trackEvent(AnalyticsEvents.PrivacyPolicy);
                setOpenDocument(PRIVACY_POLICY);
              }}
            >
              Privacy Policy
            </Anchor>
            <Anchor
              size="sm"
              c="dimmed"
              href={`mailto:${SUPPORT_EMAIL}`}
              onClick={() => trackEvent(AnalyticsEvents.SupportEmailClick)}
            >
              {SUPPORT_EMAIL}
            </Anchor>
          </Group>
        </Group>
      </Container>
      <LegalModal document={openDocument} onClose={handleCloseModal} />
    </Box>
  );
};

export default AppFooter;

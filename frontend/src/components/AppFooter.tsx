import { useState } from 'react'
import {
  Anchor,
  Box,
  Container,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  PRIVACY_POLICY,
  SUPPORT_EMAIL,
  TERMS_OF_SERVICE,
} from '../lib/legalContent'
import type { LegalDocument } from '../lib/legalContent'

type LegalModalProps = {
  document: LegalDocument | null
  onClose: () => void
}

const LegalModal = ({ document, onClose }: LegalModalProps) => (
  <Modal
    opened={document !== null}
    onClose={onClose}
    title={
      <Text fw={600} size="lg">
        {document?.title}
      </Text>
    }
    size="lg"
  >
    {document && (
      <Stack gap="md" pb="sm">
        <Text size="xs" c="dimmed">
          Last updated: {document.lastUpdated}
        </Text>
        {document.sections.map((section) => (
          <Stack key={section.heading} gap={6}>
            <Title order={5}>{section.heading}</Title>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} size="sm" c="gray.4">
                {paragraph}
              </Text>
            ))}
          </Stack>
        ))}
      </Stack>
    )}
  </Modal>
)

const AppFooter = () => {
  const [openDocument, setOpenDocument] = useState<LegalDocument | null>(null)

  const handleCloseModal = () => setOpenDocument(null)

  return (
    <Box
      component="footer"
      py="md"
      px="xl"
      mt="auto"
      style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}
    >
      <Container size="xl">
        <Group justify="space-between" gap="sm">
          <Text size="xs" c="dimmed">
            © {new Date().getFullYear()} Delta Resume. All rights reserved.
          </Text>
          <Group gap="lg">
            <Anchor
              size="xs"
              c="dimmed"
              component="button"
              type="button"
              onClick={() => setOpenDocument(TERMS_OF_SERVICE)}
            >
              Terms of Service
            </Anchor>
            <Anchor
              size="xs"
              c="dimmed"
              component="button"
              type="button"
              onClick={() => setOpenDocument(PRIVACY_POLICY)}
            >
              Privacy Policy
            </Anchor>
            <Text size="xs" c="dimmed">
              {SUPPORT_EMAIL}
            </Text>
          </Group>
        </Group>
      </Container>
      <LegalModal document={openDocument} onClose={handleCloseModal} />
    </Box>
  )
}

export default AppFooter

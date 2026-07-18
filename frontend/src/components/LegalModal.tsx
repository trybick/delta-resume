import { Modal, Stack, Text, Title } from '@mantine/core';
import type { LegalDocument } from '../lib/legalContent';

type LegalModalProps = {
  document: LegalDocument | null;
  onClose: () => void;
};

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
);

export default LegalModal;

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconCheck,
  IconFileDescription,
  IconFileTypePdf,
  IconInfoCircle,
} from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import DocxPane from './DocxPane';

export type PreviewVariant = 'keep' | 'clean';

type PreviewView = 'after' | 'before';

type ExportFormat = 'docx' | 'pdf';

type DocumentPreviewModalProps = {
  opened: boolean;
  onClose: () => void;
  originalFile: File | null;
  canPatchOriginal: boolean;
  buildDocx: (variant: PreviewVariant) => Promise<Blob>;
  onExport: (variant: PreviewVariant, format: ExportFormat) => Promise<boolean>;
};

const DocumentPreviewModal = ({
  opened,
  onClose,
  originalFile,
  canPatchOriginal,
  buildDocx,
  onExport,
}: DocumentPreviewModalProps) => {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [view, setView] = useState<PreviewView>('after');
  const [variant, setVariant] = useState<PreviewVariant>(canPatchOriginal ? 'keep' : 'clean');
  const [afterBlob, setAfterBlob] = useState<Blob | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildFailed, setBuildFailed] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [downloadedFormat, setDownloadedFormat] = useState<ExportFormat | null>(null);
  const downloadedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildDocxRef = useRef(buildDocx);
  buildDocxRef.current = buildDocx;

  const effectiveVariant: PreviewVariant = canPatchOriginal ? variant : 'clean';
  const effectiveView: PreviewView = originalFile === null ? 'after' : view;

  useEffect(() => {
    return () => {
      if (downloadedTimeoutRef.current) clearTimeout(downloadedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!opened) {
      setAfterBlob(null);
      setDownloadedFormat(null);
      return;
    }
    let cancelled = false;
    setIsBuilding(true);
    setBuildFailed(false);
    buildDocxRef
      .current(effectiveVariant)
      .then((blob) => {
        if (!cancelled) setAfterBlob(blob);
      })
      .catch(() => {
        if (!cancelled) setBuildFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, effectiveVariant]);

  const handleDownload = async (format: ExportFormat) => {
    setExportingFormat(format);
    setDownloadedFormat(null);
    if (downloadedTimeoutRef.current) clearTimeout(downloadedTimeoutRef.current);
    try {
      const didExport = await onExport(effectiveVariant, format);
      if (!didExport) return;
      setDownloadedFormat(format);
      downloadedTimeoutRef.current = setTimeout(() => setDownloadedFormat(null), 2500);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleVariantChange = (value: string) => {
    const next = value as PreviewVariant;
    trackEvent(AnalyticsEvents.ResumePreviewVariantChange, { variant: next });
    setVariant(next);
  };

  const handleViewChange = (value: string) => {
    const next = value as PreviewView;
    trackEvent(AnalyticsEvents.ResumePreviewViewChange, { view: next });
    setView(next);
  };

  const viewOptions = [
    { value: 'after', label: 'Tailored' },
    { value: 'before', label: 'Original' },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Export preview"
      size="90%"
      fullScreen={isMobile}
      centered
    >
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Text size="sm" c="dimmed">
            This is exactly what your downloaded file will look like.
          </Text>
          <Group gap="sm" wrap="nowrap">
            {canPatchOriginal && (
              <SegmentedControl
                size="xs"
                value={variant}
                onChange={handleVariantChange}
                data={[
                  { value: 'keep', label: 'Keep my formatting' },
                  { value: 'clean', label: 'Clean template' },
                ]}
              />
            )}
            {originalFile !== null && (
              <SegmentedControl
                size="xs"
                value={effectiveView}
                onChange={handleViewChange}
                data={viewOptions}
              />
            )}
          </Group>
        </Group>

        {originalFile === null && (
          <Alert
            color="blue"
            variant="light"
            icon={<IconInfoCircle size={18} />}
            py={8}
          >
            Upload your resume as a .docx to compare with the original and keep your formatting on
            export.
          </Alert>
        )}

        <Stack gap={4} h="65vh">
          {effectiveView === 'before' && originalFile !== null ? (
            <DocxPane source={originalFile} isLoading={false} hasError={false} />
          ) : (
            <DocxPane source={afterBlob} isLoading={isBuilding} hasError={buildFailed} />
          )}
        </Stack>

        <Group justify="flex-end" align="center" wrap="wrap" gap="sm">
          <Group gap="xs" wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              color={downloadedFormat === 'pdf' ? 'teal' : undefined}
              leftSection={
                downloadedFormat === 'pdf' ? (
                  <IconCheck size={16} />
                ) : (
                  <IconFileTypePdf size={16} />
                )
              }
              loading={exportingFormat === 'pdf'}
              disabled={exportingFormat === 'docx' || buildFailed}
              onClick={() => void handleDownload('pdf')}
            >
              {downloadedFormat === 'pdf' ? 'Downloaded' : 'PDF (.pdf)'}
            </Button>
            <Button
              size="xs"
              color={downloadedFormat === 'docx' ? 'teal' : undefined}
              leftSection={
                downloadedFormat === 'docx' ? (
                  <IconCheck size={16} />
                ) : (
                  <IconFileDescription size={16} />
                )
              }
              loading={exportingFormat === 'docx'}
              disabled={exportingFormat === 'pdf' || buildFailed}
              onClick={() => void handleDownload('docx')}
            >
              {downloadedFormat === 'docx' ? 'Downloaded' : 'Word (.docx)'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DocumentPreviewModal;

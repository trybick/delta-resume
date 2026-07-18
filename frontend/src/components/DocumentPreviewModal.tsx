import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconCheck,
  IconFileDescription,
  IconFileTypePdf,
  IconInfoCircle,
} from '@tabler/icons-react';
import { renderAsync } from 'docx-preview';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';

export type PreviewVariant = 'keep' | 'clean';

type PreviewView = 'after' | 'before';

type ExportFormat = 'docx' | 'pdf';

type DocumentPreviewModalProps = {
  opened: boolean;
  onClose: () => void;
  originalFile: File | null;
  canPatchOriginal: boolean;
  buildDocx: (variant: PreviewVariant) => Promise<Blob>;
  onExport: (variant: PreviewVariant, format: ExportFormat) => Promise<void>;
};

type DocxPaneProps = {
  source: Blob | null;
  isLoading: boolean;
  hasError: boolean;
};

const DocxPane = ({ source, isLoading, hasError }: DocxPaneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !source) return;
    let cancelled = false;
    setIsRendering(true);
    setRenderFailed(false);
    renderAsync(source, container, container, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      experimental: true,
    })
      .catch(() => {
        if (!cancelled) setRenderFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const showError = hasError || renderFailed;
  const showLoader = !showError && (isLoading || isRendering);

  return (
    <Box
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        borderRadius: 8,
        border: '1px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-default-hover)',
      }}
    >
      {showError ? (
        <Center h="100%" p="md">
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            Could not render this preview. You can still export the document.
          </Alert>
        </Center>
      ) : (
        <>
          <div ref={containerRef} />
          {showLoader && (
            <Center
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 60%, transparent)',
              }}
            >
              <Loader size="sm" />
            </Center>
          )}
        </>
      )}
    </Box>
  );
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
      await onExport(effectiveVariant, format);
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

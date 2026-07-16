import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { IconAlertCircle, IconFileDescription, IconFileTypePdf } from '@tabler/icons-react';
import { renderAsync } from 'docx-preview';

export type PreviewVariant = 'keep' | 'clean';

type PreviewView = 'after' | 'before' | 'sideBySide';

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

type LabeledPaneProps = {
  label: string | null;
  children: ReactNode;
};

const LabeledPane = ({ label, children }: LabeledPaneProps) => (
  <Stack gap={4} style={{ flex: 1, minWidth: 0, height: '100%' }}>
    {label && (
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.6}>
        {label}
      </Text>
    )}
    {children}
  </Stack>
);

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
  const buildDocxRef = useRef(buildDocx);
  buildDocxRef.current = buildDocx;

  const effectiveVariant: PreviewVariant = canPatchOriginal ? variant : 'clean';
  const effectiveView: PreviewView =
    originalFile === null ? 'after' : isMobile && view === 'sideBySide' ? 'after' : view;

  useEffect(() => {
    if (!opened) {
      setAfterBlob(null);
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
    try {
      await onExport(effectiveVariant, format);
    } finally {
      setExportingFormat(null);
    }
  };

  const viewOptions = [
    { value: 'after', label: 'Tailored' },
    { value: 'before', label: 'Original' },
    ...(isMobile ? [] : [{ value: 'sideBySide', label: 'Side by side' }]),
  ];

  const showBefore = effectiveView === 'before' || effectiveView === 'sideBySide';
  const showAfter = effectiveView === 'after' || effectiveView === 'sideBySide';
  const paneLabelsVisible = effectiveView === 'sideBySide';

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
                onChange={(value) => setVariant(value as PreviewVariant)}
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
                onChange={(value) => setView(value as PreviewView)}
                data={viewOptions}
              />
            )}
          </Group>
        </Group>

        <Group gap="md" align="stretch" wrap="nowrap" h="65vh">
          {showBefore && originalFile !== null && (
            <LabeledPane label={paneLabelsVisible ? 'Original' : null}>
              <DocxPane source={originalFile} isLoading={false} hasError={false} />
            </LabeledPane>
          )}
          {showAfter && (
            <LabeledPane label={paneLabelsVisible ? 'Tailored' : null}>
              <DocxPane source={afterBlob} isLoading={isBuilding} hasError={buildFailed} />
            </LabeledPane>
          )}
        </Group>

        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Text size="xs" c="dimmed">
            {canPatchOriginal
              ? 'Downloads use the layout option selected above.'
              : 'Downloads use the clean template layout.'}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconFileTypePdf size={16} />}
              loading={exportingFormat === 'pdf'}
              disabled={exportingFormat === 'docx' || buildFailed}
              onClick={() => void handleDownload('pdf')}
            >
              PDF (.pdf)
            </Button>
            <Button
              size="xs"
              leftSection={<IconFileDescription size={16} />}
              loading={exportingFormat === 'docx'}
              disabled={exportingFormat === 'pdf' || buildFailed}
              onClick={() => void handleDownload('docx')}
            >
              Word (.docx)
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DocumentPreviewModal;

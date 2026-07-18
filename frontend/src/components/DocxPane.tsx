import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Center, Loader } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { renderAsync } from 'docx-preview';

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
    if (!container) return;

    if (!source) {
      container.replaceChildren();
      setIsRendering(false);
      setRenderFailed(false);
      return;
    }

    let cancelled = false;
    const mount = document.createElement('div');
    container.replaceChildren(mount);
    setIsRendering(true);
    setRenderFailed(false);

    void renderAsync(source, mount, mount, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      experimental: true,
    })
      .then(() => {
        if (cancelled) return;
        setIsRendering(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRenderFailed(true);
        setIsRendering(false);
      });

    return () => {
      cancelled = true;
      mount.remove();
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

export default DocxPane;

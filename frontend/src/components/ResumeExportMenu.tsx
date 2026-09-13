import { Badge, Group, Menu, Text } from '@mantine/core';
import {
  IconCopy,
  IconFileDescription,
  IconFileTypePdf,
  IconLock,
  IconUserPlus,
} from '@tabler/icons-react';
import { ExportScaleControl } from './ExportScaleControl';
import { proAccent } from '../lib/proAccent';

type ResumeExportMenuProps = {
  isExample: boolean;
  isGuest: boolean;
  isProPlan: boolean;
  canPatchOriginal: boolean;
  exportScale: number;
  onExportScaleChange: (scale: number) => void;
  fitToOnePage: boolean;
  onFitToOnePageChange: (enabled: boolean) => void;
  isComputingFit: boolean;
  onCopy: () => void;
  onExport: (variant: 'keep' | 'clean', format: 'docx' | 'pdf') => void;
  onExportGate: () => void;
};

const proBadge = (
  <Badge size="xs" variant="gradient" gradient={{ ...proAccent.gradient, deg: 45 }}>
    Pro
  </Badge>
);

const ResumeExportMenu = ({
  isExample,
  isGuest,
  isProPlan,
  canPatchOriginal,
  exportScale,
  onExportScaleChange,
  fitToOnePage,
  onFitToOnePageChange,
  isComputingFit,
  onCopy,
  onExport,
  onExportGate,
}: ResumeExportMenuProps) => {
  const handleExportClick = (variant: 'keep' | 'clean', format: 'docx' | 'pdf') => {
    if (isGuest) {
      onExportGate();
      return;
    }
    onExport(variant, format);
  };

  const fileIcon = (format: 'docx' | 'pdf') => {
    if (isGuest) return <IconLock size={16} />;
    return format === 'docx' ? <IconFileDescription size={16} /> : <IconFileTypePdf size={16} />;
  };

  return (
    <>
      <Menu.Item leftSection={<IconCopy size={16} />} disabled={isExample} onClick={onCopy}>
        Copy to clipboard
      </Menu.Item>
      <Menu.Divider />
      {isExample && (
        <>
          <Menu.Label>Example preview — export unavailable</Menu.Label>
          <Menu.Divider />
        </>
      )}
      {isGuest && !isExample && (
        <>
          <Menu.Item
            leftSection={<IconUserPlus size={16} color="var(--mantine-color-cyan-4)" />}
            onClick={onExportGate}
          >
            <Text size="sm" fw={600} c="cyan.4">
              Create a free account to export
            </Text>
            <Text size="xs" c="dimmed">
              DOCX and PDF downloads. Takes seconds with Google.
            </Text>
          </Menu.Item>
          <Menu.Divider />
        </>
      )}
      <Menu.Label>Settings</Menu.Label>
      <ExportScaleControl
        scale={exportScale}
        onChange={onExportScaleChange}
        fitToOnePage={fitToOnePage}
        onFitToOnePageChange={onFitToOnePageChange}
        isComputingFit={isComputingFit}
        disabled={isExample}
      />
      <Menu.Divider />
      {canPatchOriginal && (
        <>
          <Menu.Label>
            <Group gap={6} wrap="nowrap">
              Keep my formatting
              {!isGuest && !isProPlan && proBadge}
            </Group>
          </Menu.Label>
          <Menu.Item
            leftSection={fileIcon('docx')}
            rightSection={
              !isGuest && isProPlan ? (
                <Badge size="xs" variant="light" color="teal">
                  Recommended
                </Badge>
              ) : undefined
            }
            disabled={isExample}
            onClick={() => handleExportClick('keep', 'docx')}
          >
            Word (.docx)
          </Menu.Item>
          <Menu.Item
            leftSection={fileIcon('pdf')}
            disabled={isExample}
            onClick={() => handleExportClick('keep', 'pdf')}
          >
            PDF (.pdf)
          </Menu.Item>
          <Menu.Divider />
        </>
      )}
      {!canPatchOriginal && !isExample && (
        <>
          <Menu.Label>
            <Group gap={6} wrap="nowrap">
              Keep my formatting
              {!isProPlan && proBadge}
            </Group>
          </Menu.Label>
          <Text size="xs" c="dimmed" px={12} pb={8} maw={240}>
            Upload your resume as a .docx to export with your original formatting preserved.
          </Text>
          <Menu.Divider />
        </>
      )}
      <Menu.Label>Clean template</Menu.Label>
      <Menu.Item
        leftSection={fileIcon('docx')}
        disabled={isExample}
        onClick={() => handleExportClick('clean', 'docx')}
      >
        Word (.docx)
      </Menu.Item>
      <Menu.Item
        leftSection={fileIcon('pdf')}
        disabled={isExample}
        onClick={() => handleExportClick('clean', 'pdf')}
      >
        PDF (.pdf)
      </Menu.Item>
    </>
  );
};

export default ResumeExportMenu;

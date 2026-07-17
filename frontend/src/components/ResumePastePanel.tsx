import { useMemo, useState } from 'react';
import { Stack, Text, Textarea } from '@mantine/core';
import { AnalyticsEvents, createDebouncedTracker } from '../lib/analytics';
import { RESUME_TEXT_MAX_LENGTH } from '../lib/constants';

type ResumePastePanelProps = {
  pasteFieldText: string;
  onResumeTextChange: (text: string) => void;
};

const ResumePastePanel = ({ pasteFieldText, onResumeTextChange }: ResumePastePanelProps) => {
  const [pasteFieldEditable, setPasteFieldEditable] = useState(false);
  const trackPasteResumeText = useMemo(
    () => createDebouncedTracker(AnalyticsEvents.PasteResumeText),
    [],
  );

  return (
    <Stack gap={4} h="100%">
      <Textarea
        aria-label="Resume text"
        name="resume-paste"
        autoComplete="off"
        readOnly={!pasteFieldEditable}
        onFocus={() => setPasteFieldEditable(true)}
        value={pasteFieldText}
        onChange={(event) => {
          trackPasteResumeText();
          onResumeTextChange(event.currentTarget.value.slice(0, RESUME_TEXT_MAX_LENGTH));
        }}
        placeholder="Paste your resume text here…"
        maxLength={RESUME_TEXT_MAX_LENGTH}
        style={{ flex: 1 }}
        styles={{
          root: { flex: 1, display: 'flex', flexDirection: 'column' },
          wrapper: { flex: 1 },
          input: {
            height: '100%',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 'var(--mantine-font-size-xs)',
          },
        }}
      />
      <Text
        size="xs"
        c={RESUME_TEXT_MAX_LENGTH - pasteFieldText.length <= 0 ? 'red' : 'dimmed'}
        ta="right"
        style={{ visibility: pasteFieldText.length > 0 ? 'visible' : 'hidden' }}
      >
        {(RESUME_TEXT_MAX_LENGTH - pasteFieldText.length).toLocaleString()} characters left
      </Text>
    </Stack>
  );
};

export default ResumePastePanel;

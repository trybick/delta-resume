import { useEffect, useRef, useState } from 'react';
import { cleanupOriginalDocxStore, loadOriginalDocx, saveOriginalDocx } from '../lib/docxStore';
import { normalizeResumeTextForComparison } from '../lib/exportDocx';
import type { SavedResume } from '../lib/types';

export type AttachedFile = {
  name: string;
  size: number;
};

export type OriginalDocx = {
  file: File;
  parsedText: string;
};

type UseResumeDocumentOptions = {
  savedResumes: SavedResume[];
  hasLoadedSavedResumes: boolean;
  isLoadingSavedResumes: boolean;
};

type UseResumeDocumentResult = {
  resumeText: string;
  pasteFieldText: string;
  setResumeText: (text: string) => void;
  attachedFile: AttachedFile | null;
  originalDocx: OriginalDocx | null;
  handleResumeTextChange: (text: string) => void;
  handleFileAttach: (file: AttachedFile, text: string, sourceFile: File) => void;
  handleClearResume: () => void;
  handleSelectSaved: (resume: SavedResume) => void;
  persistOriginalDocx: () => void;
};

export const useResumeDocument = ({
  savedResumes,
  hasLoadedSavedResumes,
  isLoadingSavedResumes,
}: UseResumeDocumentOptions): UseResumeDocumentResult => {
  const [resumeText, setResumeText] = useState('');
  const [pasteFieldText, setPasteFieldText] = useState('');
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [originalDocx, setOriginalDocx] = useState<OriginalDocx | null>(null);
  const pendingDocxRestoreRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasLoadedSavedResumes || isLoadingSavedResumes) return;
    const keepTexts = savedResumes.map((resume) => resume.resumeText);
    if (originalDocx) keepTexts.push(originalDocx.parsedText);
    void cleanupOriginalDocxStore(keepTexts);
  }, [hasLoadedSavedResumes, isLoadingSavedResumes, savedResumes, originalDocx]);

  const handleResumeTextChange = (text: string) => {
    pendingDocxRestoreRef.current = null;
    setAttachedFile(null);
    setOriginalDocx(null);
    setPasteFieldText(text);
    setResumeText(text);
  };

  const handleFileAttach = (file: AttachedFile, text: string, sourceFile: File) => {
    pendingDocxRestoreRef.current = null;
    setAttachedFile(file);
    setResumeText(text);
    setPasteFieldText('');
    const isDocx = sourceFile.name.toLowerCase().endsWith('.docx');
    setOriginalDocx(isDocx ? { file: sourceFile, parsedText: text } : null);
    if (isDocx) {
      void saveOriginalDocx(text, sourceFile);
    }
  };

  const handleClearResume = () => {
    pendingDocxRestoreRef.current = null;
    setAttachedFile(null);
    setOriginalDocx(null);
    setResumeText('');
    setPasteFieldText('');
  };

  const restoreSavedDocx = async (savedResumeText: string) => {
    const file = await loadOriginalDocx(savedResumeText);
    if (!file || pendingDocxRestoreRef.current !== savedResumeText) return;
    pendingDocxRestoreRef.current = null;
    setAttachedFile({ name: file.name, size: file.size });
    setOriginalDocx({ file, parsedText: savedResumeText });
  };

  const handleSelectSaved = (resume: SavedResume) => {
    const matchesAttachedDocx =
      originalDocx !== null &&
      normalizeResumeTextForComparison(originalDocx.parsedText) ===
        normalizeResumeTextForComparison(resume.resumeText);

    setResumeText(resume.resumeText);
    setPasteFieldText(resume.resumeText);
    if (matchesAttachedDocx) {
      pendingDocxRestoreRef.current = null;
      return;
    }
    setAttachedFile(null);
    setOriginalDocx(null);
    pendingDocxRestoreRef.current = resume.resumeText;
    void restoreSavedDocx(resume.resumeText);
  };

  const persistOriginalDocx = () => {
    if (originalDocx) {
      void saveOriginalDocx(originalDocx.parsedText, originalDocx.file);
    }
  };

  return {
    resumeText,
    pasteFieldText,
    setResumeText,
    attachedFile,
    originalDocx,
    handleResumeTextChange,
    handleFileAttach,
    handleClearResume,
    handleSelectSaved,
    persistOriginalDocx,
  };
};

import { useEffect, useRef, useState } from 'react';
import { cleanupOriginalDocxStore, loadOriginalDocx, saveOriginalDocx } from '../lib/docxStore';
import { normalizeResumeTextForComparison } from '../lib/exportDocx';
import type { AttachedFile, OriginalDocx, ResumeDocument, SavedResume } from '../lib/types';

type UseResumeDocumentOptions = {
  savedResumes: SavedResume[];
  hasLoadedSavedResumes: boolean;
  isLoadingSavedResumes: boolean;
};

type UseResumeDocumentResult = {
  resumeText: string;
  pasteFieldText: string;
  setResumeText: (text: string) => void;
  resumeDocument: ResumeDocument | null;
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
  const [resumeDocument, setResumeDocument] = useState<ResumeDocument | null>(null);
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
    setResumeDocument(null);
    setPasteFieldText(text);
    setResumeText(text);
  };

  const handleFileAttach = (file: AttachedFile, text: string, sourceFile: File) => {
    pendingDocxRestoreRef.current = null;
    setAttachedFile(file);
    setResumeText(text);
    setPasteFieldText('');
    setResumeDocument(null);
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
    setResumeDocument(null);
    setResumeText('');
    setPasteFieldText('');
  };

  const handleSelectSaved = (resume: SavedResume) => {
    const matchesAttachedDocx =
      originalDocx !== null &&
      normalizeResumeTextForComparison(originalDocx.parsedText) ===
        normalizeResumeTextForComparison(resume.resumeText);

    setResumeText(resume.resumeText);
    setResumeDocument(resume.resumeDocument);

    if (matchesAttachedDocx) {
      pendingDocxRestoreRef.current = null;
      setPasteFieldText('');
      return;
    }

    setAttachedFile(null);
    setOriginalDocx(null);
    setPasteFieldText('');
    pendingDocxRestoreRef.current = resume.resumeText;

    void (async () => {
      const file = await loadOriginalDocx(resume.resumeText);
      if (pendingDocxRestoreRef.current !== resume.resumeText) return;
      pendingDocxRestoreRef.current = null;
      if (file) {
        setAttachedFile({ name: file.name, size: file.size });
        setOriginalDocx({ file, parsedText: resume.resumeText });
        setPasteFieldText('');
        return;
      }
      setPasteFieldText(resume.resumeText);
    })();
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
    resumeDocument,
    attachedFile,
    originalDocx,
    handleResumeTextChange,
    handleFileAttach,
    handleClearResume,
    handleSelectSaved,
    persistOriginalDocx,
  };
};

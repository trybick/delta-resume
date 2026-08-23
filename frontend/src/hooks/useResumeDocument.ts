import { useEffect, useRef, useState } from 'react';
import { cleanupOriginalDocxStore, loadOriginalDocx, saveOriginalDocx } from '../lib/docxStore';
import { readCleanLayout, type DocxCleanLayout } from '../lib/docxLayout';
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
  resumeLayout: DocxCleanLayout | null;
  attachedFile: AttachedFile | null;
  originalDocx: OriginalDocx | null;
  handleResumeTextChange: (text: string) => void;
  handleFileAttach: (file: AttachedFile, text: string, sourceFile: File) => Promise<void>;
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
  const [resumeLayout, setResumeLayout] = useState<DocxCleanLayout | null>(null);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [originalDocx, setOriginalDocx] = useState<OriginalDocx | null>(null);
  const docxRestoreIdRef = useRef(0);

  useEffect(() => {
    if (!hasLoadedSavedResumes || isLoadingSavedResumes) return;
    const keepTexts = savedResumes.map((resume) => resume.resumeText);
    if (originalDocx) keepTexts.push(originalDocx.parsedText);
    void cleanupOriginalDocxStore(keepTexts);
  }, [hasLoadedSavedResumes, isLoadingSavedResumes, savedResumes, originalDocx]);

  const handleResumeTextChange = (text: string) => {
    docxRestoreIdRef.current += 1;
    setAttachedFile(null);
    setOriginalDocx(null);
    setResumeDocument(null);
    setResumeLayout(null);
    setPasteFieldText(text);
    setResumeText(text);
  };

  const handleFileAttach = async (file: AttachedFile, text: string, sourceFile: File) => {
    docxRestoreIdRef.current += 1;
    const restoreId = docxRestoreIdRef.current;
    const isDocx = sourceFile.name.toLowerCase().endsWith('.docx');
    const layout = isDocx ? await readCleanLayout(sourceFile, text).catch(() => null) : null;
    if (docxRestoreIdRef.current !== restoreId) return;
    setAttachedFile(file);
    setResumeText(text);
    setPasteFieldText('');
    setResumeDocument(null);
    setResumeLayout(layout);
    setOriginalDocx(isDocx ? { file: sourceFile, parsedText: text } : null);
    if (isDocx) {
      await saveOriginalDocx(text, sourceFile);
    }
  };

  const handleClearResume = () => {
    docxRestoreIdRef.current += 1;
    setAttachedFile(null);
    setOriginalDocx(null);
    setResumeDocument(null);
    setResumeLayout(null);
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
    setResumeLayout(
      matchesAttachedDocx ? (resumeLayout ?? resume.resumeLayout) : resume.resumeLayout,
    );

    if (matchesAttachedDocx) {
      docxRestoreIdRef.current += 1;
      setPasteFieldText('');
      return;
    }

    setAttachedFile(null);
    setOriginalDocx(null);
    setPasteFieldText('');
    docxRestoreIdRef.current += 1;
    const restoreId = docxRestoreIdRef.current;

    void (async () => {
      const file = await loadOriginalDocx(resume.resumeText);
      if (docxRestoreIdRef.current !== restoreId) return;
      if (file) {
        const restoredLayout = await readCleanLayout(file, resume.resumeText).catch(() => null);
        if (docxRestoreIdRef.current !== restoreId) return;
        setAttachedFile({ name: file.name, size: file.size });
        setOriginalDocx({ file, parsedText: resume.resumeText });
        setResumeLayout(restoredLayout ?? resume.resumeLayout);
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
    resumeLayout,
    attachedFile,
    originalDocx,
    handleResumeTextChange,
    handleFileAttach,
    handleClearResume,
    handleSelectSaved,
    persistOriginalDocx,
  };
};

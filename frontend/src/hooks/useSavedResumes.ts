import { useCallback, useState } from 'react';
import { deleteSavedResume, getSavedResumes, renameSavedResume } from '../lib/api';
import type { SavedResume } from '../lib/types';

type UseSavedResumesResult = {
  savedResumes: SavedResume[];
  isLoadingSavedResumes: boolean;
  hasLoadedSavedResumes: boolean;
  loadSavedResumes: () => Promise<void>;
  renameResume: (resumeId: string, name: string) => Promise<void>;
  deleteResume: (resumeId: string) => Promise<void>;
};

export const useSavedResumes = (): UseSavedResumesResult => {
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [isLoadingSavedResumes, setIsLoadingSavedResumes] = useState(true);
  const [hasLoadedSavedResumes, setHasLoadedSavedResumes] = useState(false);

  const loadSavedResumes = useCallback(async () => {
    setIsLoadingSavedResumes(true);
    try {
      setSavedResumes(await getSavedResumes());
      setHasLoadedSavedResumes(true);
    } catch {
      setSavedResumes([]);
      setHasLoadedSavedResumes(false);
    } finally {
      setIsLoadingSavedResumes(false);
    }
  }, []);

  const renameResume = useCallback(
    async (resumeId: string, name: string) => {
      setSavedResumes((resumes) =>
        resumes.map((resume) => (resume.id === resumeId ? { ...resume, name } : resume)),
      );
      try {
        await renameSavedResume(resumeId, name);
      } catch {
        void loadSavedResumes();
      }
    },
    [loadSavedResumes],
  );

  const deleteResume = useCallback(
    async (resumeId: string) => {
      setSavedResumes((resumes) => resumes.filter((resume) => resume.id !== resumeId));
      try {
        await deleteSavedResume(resumeId);
      } catch {
        void loadSavedResumes();
      }
    },
    [loadSavedResumes],
  );

  return {
    savedResumes,
    isLoadingSavedResumes,
    hasLoadedSavedResumes,
    loadSavedResumes,
    renameResume,
    deleteResume,
  };
};

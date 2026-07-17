import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { getSettings, putSettings } from '../lib/api';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { defaultUserSettings, type CoverLetterSettings } from '../lib/types';

type UseCoverLetterSettingsOptions = {
  enabled: boolean;
};

type UseCoverLetterSettingsResult = {
  settings: CoverLetterSettings;
  isSettingsLoading: boolean;
  settingsOpened: boolean;
  handleToggleSettings: () => void;
  handleSettingsChange: (next: CoverLetterSettings) => Promise<void>;
};

export const useCoverLetterSettings = ({
  enabled,
}: UseCoverLetterSettingsOptions): UseCoverLetterSettingsResult => {
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [settings, setSettings] = useState<CoverLetterSettings>(
    defaultUserSettings.coverLetter,
  );
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsSettingsLoading(true);
    getSettings()
      .then((userSettings) => {
        if (cancelled) return;
        setSettings(userSettings.coverLetter);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const handleToggleSettings = () => {
    setSettingsOpened((current) => {
      const next = !current;
      trackEvent(AnalyticsEvents.CoverLetterSettingsToggle, { open: next });
      return next;
    });
  };

  const handleSettingsChange = async (next: CoverLetterSettings) => {
    const previous = settings;
    setSettings(next);
    try {
      await putSettings({ coverLetter: next });
      trackEvent(AnalyticsEvents.CoverLetterSettingsSave, {
        length: next.length,
        tone: next.tone,
      });
    } catch {
      setSettings(previous);
      notifications.show({
        color: 'red',
        title: 'Could not save settings',
        message: 'Something went wrong. Please try again.',
      });
    }
  };

  return {
    settings,
    isSettingsLoading,
    settingsOpened,
    handleToggleSettings,
    handleSettingsChange,
  };
};

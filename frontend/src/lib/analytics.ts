type GtagCommand = 'config' | 'event' | 'js' | 'set';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (command: GtagCommand, ...args: unknown[]) => void;
  }
}

export type AnalyticsEventParams = Record<string, string | number | boolean>;

export const AnalyticsEvents = {
  UpgradeToProHeader: 'upgrade_to_pro_header',
  SeePlanDetails: 'see_plan_details',
  SignIn: 'sign_in',
  UserButtonOpen: 'user_button_open',

  ResumeModeSwitch: 'resume_mode_switch',
  DropzoneBrowse: 'dropzone_browse',
  DropzoneDrop: 'dropzone_drop',
  DropzoneReject: 'dropzone_reject',
  RemoveAttachedResume: 'remove_attached_resume',
  PasteResumeText: 'paste_resume_text',
  SelectSavedResume: 'select_saved_resume',
  RenameSavedResume: 'rename_saved_resume',
  ConfirmRenameResume: 'confirm_rename_resume',
  CancelRenameResume: 'cancel_rename_resume',
  DeleteSavedResume: 'delete_saved_resume',
  UpgradeToSaveMore: 'upgrade_to_save_more',

  EditJobDescription: 'edit_job_description',

  TailorResumeClick: 'tailor_resume_click',
  GetMoreCredits: 'get_more_credits',

  PreviewExample: 'preview_example',
  DismissExample: 'dismiss_example',

  ResultsTabResume: 'results_tab_resume',
  ResultsTabCoverLetter: 'results_tab_cover_letter',

  ResumeExportMenuOpen: 'resume_export_menu_open',
  ResumeCopy: 'resume_copy',
  ResumeExport: 'resume_export',
  ShowHiddenLines: 'show_hidden_lines',
  RevertChange: 'revert_change',
  ReapplyChange: 'reapply_change',
  CopyBullet: 'copy_bullet',

  CoverLetterUpgradeTeaser: 'cover_letter_upgrade_teaser',
  CoverLetterUpgradeExample: 'cover_letter_upgrade_example',
  CoverLetterRetry: 'cover_letter_retry',
  CoverLetterExportMenuOpen: 'cover_letter_export_menu_open',
  CoverLetterCopy: 'cover_letter_copy',
  CoverLetterExport: 'cover_letter_export',
  EditCandidateName: 'edit_candidate_name',
  SignatureInfoClick: 'signature_info_click',

  PaywallClose: 'paywall_close',
  BillingPeriodChange: 'billing_period_change',
  SubscribeToPro: 'subscribe_to_pro',
  PaywallSignUpAction: 'paywall_signup_action',

  TermsOfService: 'terms_of_service',
  PrivacyPolicy: 'privacy_policy',
  CloseLegalModal: 'close_legal_modal',

  ErrorReload: 'error_reload',

  TailorResume: 'tailor_resume',
  TailorFailure: 'tailor_failure',
  CoverLetterSuccess: 'cover_letter_success',
  CoverLetterFailure: 'cover_letter_failure',
  PaywallOpened: 'paywall_opened',
  SubscriptionComplete: 'subscription_complete',
  FileParseSuccess: 'file_parse_success',
  FileParseFailure: 'file_parse_failure',
  ExportSuccess: 'export_success',
  ExportFailure: 'export_failure',
  CopySuccess: 'copy_success',
  CopyFailure: 'copy_failure',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

let measurementId: string | null = null;

export const initAnalytics = (id: string) => {
  if (measurementId) return;

  measurementId = id;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', id);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
};

export const trackEvent = (
  name: AnalyticsEventName | (string & {}),
  params?: AnalyticsEventParams,
) => {
  if (!measurementId) return;
  window.gtag('event', name, params);
};

export const createDebouncedTracker = (name: AnalyticsEventName, waitMs = 1000) => {
  let timer: number | null = null;

  return (params?: AnalyticsEventParams) => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      trackEvent(name, params);
      timer = null;
    }, waitMs);
  };
};

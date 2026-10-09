type SettingsObject = Record<string, any>;

const TOP_LEVEL_SECRET_FIELDS = [
  'paypalSecret',
  'paypalClientSecret',
  'indiaGpayKeySecret',
  'indiaGpayWebhookSecret',
  'razorpayKeySecret',
  'razorpayWebhookSecret',
  'razorpaySecret',
  'vodafoneMPaisaApiSecret',
  'facebookAppSecret'
] as const;

/** Placeholder/default values are never treated as configured credentials. */
export function hasConfiguredSecret(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const secret = value.trim();
  if (secret.length < 8 || /[•]/.test(secret) || /^\*+$/.test(secret)) return false;
  if (/^(?:astro_sivam_|change[-_ ]?me|replace[-_ ]?me|your[-_ ]?(?:secret|token|key)|placeholder)/i.test(secret)) return false;
  return true;
}

/** Return settings for an authenticated admin UI without disclosing credentials. */
export function redactSettingsSecrets<T extends SettingsObject>(settings: T): T & SettingsObject {
  const safe: SettingsObject = { ...settings };
  for (const field of TOP_LEVEL_SECRET_FIELDS) {
    safe[field] = '';
    safe[`${field}Configured`] = hasConfiguredSecret(settings[field]);
  }

  if (settings.emailSettings && typeof settings.emailSettings === 'object') {
    safe.emailSettings = {
      ...settings.emailSettings,
      smtpPassword: '',
      smtpPasswordConfigured: hasConfiguredSecret(settings.emailSettings.smtpPassword)
    };
  }

  if (settings.chatAlertSettings && typeof settings.chatAlertSettings === 'object') {
    const alerts = settings.chatAlertSettings;
    safe.chatAlertSettings = {
      ...alerts,
      whatsapp: alerts.whatsapp && typeof alerts.whatsapp === 'object'
        ? {
            ...alerts.whatsapp,
            accessToken: '',
            accessTokenConfigured: hasConfiguredSecret(alerts.whatsapp.accessToken),
            webhookUrl: '',
            webhookUrlConfigured: hasConfiguredSecret(alerts.whatsapp.webhookUrl)
          }
        : alerts.whatsapp,
      viber: alerts.viber && typeof alerts.viber === 'object'
        ? {
            ...alerts.viber,
            authToken: '',
            authTokenConfigured: hasConfiguredSecret(alerts.viber.authToken),
            webhookUrl: '',
            webhookUrlConfigured: hasConfiguredSecret(alerts.viber.webhookUrl)
          }
        : alerts.viber
    };
  }

  return safe as T & SettingsObject;
}

/**
 * Blank/masked values in an admin form mean "keep the saved credential". The
 * UI only sends a credential when the operator deliberately enters a new one.
 */
export function omitBlankSecretUpdates<T extends SettingsObject>(updates: T): T {
  const safe: SettingsObject = { ...updates };
  for (const field of TOP_LEVEL_SECRET_FIELDS) {
    if (!hasConfiguredSecret(safe[field])) delete safe[field];
    delete safe[`${field}Configured`];
  }

  if (safe.emailSettings && typeof safe.emailSettings === 'object') {
    safe.emailSettings = { ...safe.emailSettings };
    if (!hasConfiguredSecret(safe.emailSettings.smtpPassword)) delete safe.emailSettings.smtpPassword;
    delete safe.emailSettings.smtpPasswordConfigured;
  }

  if (safe.chatAlertSettings && typeof safe.chatAlertSettings === 'object') {
    safe.chatAlertSettings = { ...safe.chatAlertSettings };
    if (safe.chatAlertSettings.whatsapp && typeof safe.chatAlertSettings.whatsapp === 'object') {
      safe.chatAlertSettings.whatsapp = { ...safe.chatAlertSettings.whatsapp };
      if (!hasConfiguredSecret(safe.chatAlertSettings.whatsapp.accessToken)) delete safe.chatAlertSettings.whatsapp.accessToken;
      if (!hasConfiguredSecret(safe.chatAlertSettings.whatsapp.webhookUrl)) delete safe.chatAlertSettings.whatsapp.webhookUrl;
      delete safe.chatAlertSettings.whatsapp.accessTokenConfigured;
      delete safe.chatAlertSettings.whatsapp.webhookUrlConfigured;
    }
    if (safe.chatAlertSettings.viber && typeof safe.chatAlertSettings.viber === 'object') {
      safe.chatAlertSettings.viber = { ...safe.chatAlertSettings.viber };
      if (!hasConfiguredSecret(safe.chatAlertSettings.viber.authToken)) delete safe.chatAlertSettings.viber.authToken;
      if (!hasConfiguredSecret(safe.chatAlertSettings.viber.webhookUrl)) delete safe.chatAlertSettings.viber.webhookUrl;
      delete safe.chatAlertSettings.viber.authTokenConfigured;
      delete safe.chatAlertSettings.viber.webhookUrlConfigured;
    }
  }

  return safe as T;
}

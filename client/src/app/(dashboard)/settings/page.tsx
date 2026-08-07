import type { Metadata } from 'next';

import { SettingsView } from '@/features/settings/settings-view';
import { getServerAuthToken } from '@/lib/auth-server';
import { getSettings } from '@/services/settings.service';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const token = await getServerAuthToken();
  const settings = await getSettings(token);

  return <SettingsView settings={settings} />;
}

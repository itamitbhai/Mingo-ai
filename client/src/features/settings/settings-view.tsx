'use client';

import { useState } from 'react';
import { useAuth, useClerk, UserProfile } from '@clerk/nextjs';
import { Monitor, Moon, Shield, Sun, Trash2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Theme, type INotificationPreferences, type ISettings, type UpdateSettingsInput } from 'shared';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { deleteAccount } from '@/services/profile.service';
import { updateSettings } from '@/services/settings.service';

const THEME_OPTIONS = [
  { value: Theme.LIGHT, label: 'Light', icon: Sun },
  { value: Theme.DARK, label: 'Dark', icon: Moon },
  { value: Theme.SYSTEM, label: 'System', icon: Monitor },
] as const;

const NOTIFICATION_ITEMS: {
  key: keyof INotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: 'productUpdates',
    label: 'Product updates',
    description: 'New features and improvements to Mingo AI.',
  },
  {
    key: 'securityAlerts',
    label: 'Security alerts',
    description: 'Important notices about your account security.',
  },
  {
    key: 'projectActivity',
    label: 'Project activity',
    description: 'Updates on projects you own or collaborate on.',
  },
  {
    key: 'weeklyDigest',
    label: 'Weekly digest',
    description: 'A weekly summary of your workspace activity.',
  },
  {
    key: 'marketingEmails',
    label: 'Marketing emails',
    description: 'Tips, offers, and news from the Mingo AI team.',
  },
];

export function SettingsView({ settings: initialSettings }: { settings: ISettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { theme, setTheme } = useTheme();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const persistSettings = async (patch: UpdateSettingsInput) => {
    try {
      const token = await getToken();
      const updated = await updateSettings(patch, token);
      setSettings(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to save settings');
    }
  };

  const handleThemeChange = (value: Theme) => {
    setTheme(value);
    void persistSettings({ theme: value });
  };

  const handleNotificationToggle = (key: keyof INotificationPreferences, value: boolean) => {
    setSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));
    void persistSettings({ notifications: { [key]: value } });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const token = await getToken();
      await deleteAccount(token);
      toast.success('Account deleted');
      await signOut({ redirectUrl: '/' });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Tabs defaultValue="general">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how Mingo AI looks on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeChange(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors',
                      theme === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 hover:bg-accent/40'
                    )}
                  >
                    <option.icon className="size-5" />
                    {option.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/60">
              {NOTIFICATION_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <Label htmlFor={item.key}>{item.label}</Label>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    id={item.key}
                    checked={settings.notifications[item.key]}
                    onCheckedChange={(checked) => handleNotificationToggle(item.key, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle>Password & authentication</CardTitle>
              <CardDescription>
                Manage your password, two-factor authentication, and active sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setSecurityOpen(true)}>
                <Shield className="size-4" /> Manage security settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Permanently delete your account and all of its data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogContent showCloseButton className="max-h-[85vh] max-w-3xl overflow-y-auto p-0">
          <UserProfile routing="hash" />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, all projects, and all workspace data. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete my account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

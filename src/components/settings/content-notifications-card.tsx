import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Switch } from '@/components/ui';
import { getContentNotificationStatus, setContentNotificationSwitches } from '@/lib/supabase';
import type { AppContentType, ContentNotificationStatus } from '@/types';

const TYPES: { type: AppContentType; label: string }[] = [
  { type: 'announcements', label: 'Announcements' },
  { type: 'events', label: 'Events' },
  { type: 'posts', label: 'Posts' },
];

export function ContentNotificationsCard() {
  const [status, setStatus] = useState<ContentNotificationStatus | null>(null);
  const [saving, setSaving] = useState<AppContentType | null>(null);

  useEffect(() => {
    getContentNotificationStatus()
      .then(setStatus)
      .catch(error => {
        console.error('Error loading content notification settings:', error);
        toast.error('Failed to load app notification settings');
      });
  }, []);

  const toggle = async (type: AppContentType, checked: boolean) => {
    if (!status) return;
    const next = { ...status, [type]: checked };
    try {
      setSaving(type);
      await setContentNotificationSwitches({
        announcements: next.announcements,
        events: next.events,
        posts: next.posts,
      });
      setStatus(next);
    } catch (error) {
      console.error('Error saving content notification settings:', error);
      toast.error('Failed to save app notification settings');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>App notifications</CardTitle>
        <CardDescription>
          Notify followers when new content first shows in the app. Edits never send a notification.
          {status &&
            ` At most ${status.daily_limit} are sent in 24 hours; anything after that still shows in the app, without a notification.`}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {TYPES.map(({ type, label }) => (
          // Positioned so the hidden input Radix pairs with the Switch stays contained here.
          <div key={type} className='relative flex items-center justify-between gap-4'>
            <label htmlFor={`notify-${type}`} className='text-sm font-medium'>
              {label}
            </label>
            <Switch
              id={`notify-${type}`}
              checked={status?.[type] ?? false}
              onCheckedChange={checked => toggle(type, checked)}
              disabled={!status || saving !== null}
            />
          </div>
        ))}
        {status && !status.in_app && (
          <p className='text-sm text-muted-foreground'>
            Notifications go out once the masjid is verified and listed in the app.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

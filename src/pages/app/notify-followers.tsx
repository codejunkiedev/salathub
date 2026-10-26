import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, formatDistanceToNow } from 'date-fns';
import { Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/ui';
import { DataTable, EmptyState, ErrorAlert, PageHeader, type Column } from '@/components/common';
import { TableSkeleton } from '@/components/skeletons';
import {
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
  followerNotificationSchema,
  type FollowerNotificationData,
} from '@/lib/zod';
import {
  countMasjidFollowers,
  getMasjidNotifications,
  getMasjidProfile,
  notifyFollowers,
  NotificationLimitError,
} from '@/lib/supabase';
import { AppRoutes } from '@/constants';
import { useAuthStore } from '@/store';
import { useTrigger } from '@/hooks';
import type { MasjidNotification } from '@/types';

const DAILY_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function PhonePreview({
  masjidName,
  title,
  body,
}: {
  masjidName: string;
  title: string;
  body: string;
}) {
  return (
    <div className='rounded-[2rem] bg-gradient-to-b from-slate-700 to-slate-900 p-4 pt-10 pb-16'>
      <div className='rounded-2xl bg-white/90 dark:bg-slate-100/90 p-3 shadow-lg text-slate-900'>
        <div className='flex items-center gap-2 text-[11px] text-slate-500'>
          <span className='flex h-5 w-5 items-center justify-center rounded-md bg-teal-600 text-white'>
            <Smartphone className='h-3 w-3' />
          </span>
          <span className='font-medium'>Alkhairia</span>
          <span className='ml-auto'>now</span>
        </div>
        <p className='mt-2 text-[13px] font-semibold break-words'>
          {[masjidName, title || 'Title'].filter(Boolean).join(': ')}
        </p>
        <p className='text-[13px] break-words'>{body || 'Your message to followers'}</p>
      </div>
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const length = value.trim().length;
  return (
    <span className={`text-xs ${length > max ? 'text-destructive' : 'text-muted-foreground'}`}>
      {length}/{max}
    </span>
  );
}

export default function NotifyFollowers() {
  const isAdmin = useAuthStore(s => s.role) === 'admin';
  const [history, setHistory] = useState<MasjidNotification[]>([]);
  const [followers, setFollowers] = useState<number | null>(null);
  const [listed, setListed] = useState<boolean | null>(null);
  const [masjidName, setMasjidName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<FollowerNotificationData | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [trigger, forceUpdate] = useTrigger();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FollowerNotificationData>({
    resolver: zodResolver(followerNotificationSchema),
    defaultValues: { title: '', body: '' },
  });

  const title = watch('title');
  const body = watch('body');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [notifications, count, profile] = await Promise.all([
          getMasjidNotifications(),
          countMasjidFollowers(),
          getMasjidProfile(),
        ]);
        setHistory(notifications);
        setFollowers(count);
        setListed(profile?.listed ?? false);
        setMasjidName(profile?.name ?? '');
        setNow(Date.now());
      } catch (err) {
        console.error(err);
        setError('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trigger]);

  const recent = useMemo(
    () => history.filter(item => now - new Date(item.created_at).getTime() < DAY_MS),
    [history, now]
  );
  const remaining = Math.max(0, DAILY_LIMIT - recent.length);
  const nextSlot =
    remaining === 0
      ? new Date(new Date(recent[DAILY_LIMIT - 1].created_at).getTime() + DAY_MS)
      : null;

  const nextSlotTime = nextSlot?.getTime();
  useEffect(() => {
    if (!nextSlotTime) return;
    const timer = setTimeout(() => setNow(Date.now()), nextSlotTime - Date.now() + 1000);
    return () => clearTimeout(timer);
  }, [nextSlotTime]);

  const canSend = !loading && listed === true && remaining > 0;

  const confirmSend = async () => {
    if (!pending) return;

    try {
      setIsSending(true);
      const sent = await notifyFollowers(pending);
      toast.success(
        `Notification sent to ${sent.devices_reached ?? 0} device${sent.devices_reached === 1 ? '' : 's'}`
      );
      reset({ title: '', body: '' });
      setPending(null);
    } catch (err) {
      if (err instanceof NotificationLimitError) {
        toast.error(
          err.retryAt
            ? `${err.message} You can send again ${format(err.retryAt, "EEE d MMM 'at' h:mm a")}.`
            : err.message
        );
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to send the notification');
      }
      setPending(null);
    } finally {
      setIsSending(false);
      forceUpdate();
    }
  };

  const columns: Column<MasjidNotification>[] = [
    {
      key: 'title',
      name: 'Title',
      width: 'w-[20%]',
      render: value => <span className='font-medium'>{value as string}</span>,
    },
    {
      key: 'body',
      name: 'Message',
      width: 'w-[38%]',
      render: value => <div className='whitespace-pre-wrap break-words'>{value as string}</div>,
    },
    { key: 'sent_by_name', name: 'Sent by', width: 'w-[14%]' },
    {
      key: 'created_at',
      name: 'Sent',
      width: 'w-[16%]',
      render: value => (
        <span title={format(new Date(value as string), 'PPpp')}>
          {formatDistanceToNow(new Date(value as string), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: 'devices_reached',
      name: 'Devices',
      width: 'w-[12%]',
      render: value => (value === null ? 'Sending…' : (value as number)),
    },
  ];

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <PageHeader
        title='Notify Followers'
        description='Send a short message straight to the phones that follow the masjid in the Alkhairia app'
        showAddButton={false}
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {listed === false && (
        <Card>
          <CardContent className='text-sm text-muted-foreground'>
            {isAdmin ? (
              <>
                The masjid isn't listed in the Alkhairia app, so it has no followers to notify.{' '}
                <Link
                  to={AppRoutes.SettingsAlkhairiaApp}
                  className='text-foreground underline underline-offset-2'
                >
                  List the masjid
                </Link>{' '}
                first.
              </>
            ) : (
              "The masjid isn't listed in the Alkhairia app, so it has no followers to notify. Ask an admin to list it."
            )}
          </CardContent>
        </Card>
      )}

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]'>
        <Card>
          <CardHeader>
            <CardTitle>New notification</CardTitle>
            <CardDescription>
              Shown on followers' phones only, never on a display screen. A masjid can send{' '}
              {DAILY_LIMIT} in any 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(data => setPending(data))} className='space-y-4'>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='title'>Title</Label>
                  <CharCount value={title} max={NOTIFICATION_TITLE_MAX} />
                </div>
                <Input
                  id='title'
                  placeholder='Taraweeh tonight'
                  className={errors.title ? 'border-destructive' : ''}
                  {...register('title')}
                />
                {errors.title && <p className='text-destructive text-sm'>{errors.title.message}</p>}
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='body'>Message</Label>
                  <CharCount value={body} max={NOTIFICATION_BODY_MAX} />
                </div>
                <Textarea
                  id='body'
                  placeholder='Taraweeh starts tonight after Isha'
                  className={`resize-none h-24 ${errors.body ? 'border-destructive' : ''}`}
                  {...register('body')}
                />
                {errors.body && <p className='text-destructive text-sm'>{errors.body.message}</p>}
              </div>

              <div className='flex flex-wrap items-center justify-between gap-3 pt-2'>
                <div className='text-sm text-muted-foreground space-y-0.5'>
                  <p>
                    Reaches about{' '}
                    <span className='font-medium text-foreground'>{followers ?? '—'}</span>{' '}
                    {followers === 1 ? 'device' : 'devices'}
                  </p>
                  <p>
                    {nextSlot
                      ? `Limit reached. You can send again ${format(nextSlot, "EEE d MMM 'at' h:mm a")}.`
                      : `${remaining} of ${DAILY_LIMIT} left in the last 24 hours`}
                  </p>
                </div>
                <Button type='submit' disabled={!canSend}>
                  <Send className='mr-2 h-4 w-4' />
                  Review and send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Roughly how it appears on Android and iPhone</CardDescription>
          </CardHeader>
          <CardContent>
            <PhonePreview masjidName={masjidName} title={title.trim()} body={body.trim()} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sent notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={columns} />
          ) : history.length === 0 ? (
            <EmptyState
              icon={<Send className='h-6 w-6 text-muted-foreground' />}
              title='No notifications sent yet'
              description='Messages you send to followers will be listed here.'
            />
          ) : (
            <DataTable columns={columns} data={history} keyField='id' />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={open => !open && !isSending && setPending(null)}>
        <DialogContent className='sm:max-w-[420px]'>
          <DialogHeader>
            <DialogTitle>Send this notification?</DialogTitle>
            <DialogDescription>
              It goes to about {followers ?? 0} {followers === 1 ? 'device' : 'devices'} straight
              away and can't be taken back.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <PhonePreview masjidName={masjidName} title={pending.title} body={pending.body} />
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setPending(null)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={confirmSend} disabled={isSending} loading={isSending}>
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

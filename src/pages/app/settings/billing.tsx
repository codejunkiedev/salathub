import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CircleCheck,
  CreditCard,
  Gift,
  Sparkles,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { TaxExemptionCard } from '@/components/settings';
import { countMasjidScreens, getBillingUrl, getPlanRules } from '@/lib/supabase';
import { useMasjidBilling } from '@/hooks';
import { AppRoutes } from '@/constants';
import type { MasjidBilling, PlanRules } from '@/types';
import { trialDaysLeft } from '@/utils';

const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 40;

const date = (value: string | null) => (value ? format(new Date(value), 'd MMM yyyy') : '—');

const isPaid = (billing: MasjidBilling) =>
  billing.status === 'active' ||
  billing.status === 'cancelled' ||
  billing.status === 'payment_failed';

function StatusCard({ billing }: { billing: MasjidBilling }) {
  switch (billing.status) {
    case 'trial': {
      const days = trialDaysLeft(billing.trial_ends_at);
      return (
        <StatusLayout icon={<Sparkles className='h-6 w-6 text-amber-600' />} title='Pro trial'>
          <p>
            {days === 1 ? '1 day' : `${days} days`} left. The trial ends on{' '}
            {date(billing.trial_ends_at)}.
          </p>
          <p>
            Upgrade to keep Pro. Otherwise the masjid moves to the Free plan when the trial ends.
            Nothing is deleted.
          </p>
        </StatusLayout>
      );
    }
    case 'granted':
      return (
        <StatusLayout
          icon={<Gift className='h-6 w-6 text-emerald-600' />}
          title='Pro, free from SalatHub'
        >
          <p>The masjid has Pro at no cost until {date(billing.granted_until)}.</p>
          <p>
            To keep Pro after that, upgrade before then. Upgrading starts a paid year straight away.
          </p>
        </StatusLayout>
      );
    case 'active':
      return (
        <StatusLayout icon={<CircleCheck className='h-6 w-6 text-emerald-600' />} title='Pro'>
          <p>Renews on {date(billing.renews_at)}.</p>
        </StatusLayout>
      );
    case 'cancelled':
      return (
        <StatusLayout
          icon={<CalendarClock className='h-6 w-6 text-amber-600' />}
          title='Pro, not renewing'
        >
          <p>
            Pro stays active until {date(billing.renews_at)}, then the masjid moves to the Free
            plan. To keep Pro, renew from Manage billing.
          </p>
        </StatusLayout>
      );
    case 'payment_failed':
      return (
        <StatusLayout
          icon={<AlertTriangle className='h-6 w-6 text-destructive' />}
          title='Payment failed'
          tone='danger'
        >
          <p>
            We couldn't take the renewal payment. Update the card in Manage billing by{' '}
            <strong>{date(billing.grace_ends_at)}</strong> to keep Pro.
          </p>
          <p>After that date the masjid moves to the Free plan. Nothing is deleted.</p>
        </StatusLayout>
      );
    default:
      return (
        <StatusLayout icon={<CreditCard className='h-6 w-6 text-muted-foreground' />} title='Free'>
          <p>Upgrade to Pro for more screens and every Pro feature.</p>
        </StatusLayout>
      );
  }
}

function StatusLayout({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  return (
    <Card className={tone === 'danger' ? 'border-destructive/40 bg-destructive/5' : undefined}>
      <CardHeader>
        <div className='flex items-start gap-3'>
          {icon}
          <div className='space-y-1.5'>
            <CardTitle>{title}</CardTitle>
            <div className='text-sm text-muted-foreground space-y-1'>{children}</div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-4 py-2 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='font-medium text-right'>{value}</dd>
    </div>
  );
}

const STATUS_LABELS: Record<MasjidBilling['status'], string> = {
  none: 'Free plan',
  trial: 'Trial',
  active: 'Active',
  cancelled: 'Ends at the end of the year',
  payment_failed: 'Payment failed',
  granted: 'Free from SalatHub',
};

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { billing, refresh } = useMasjidBilling();
  const [rules, setRules] = useState<PlanRules[] | null>(null);
  const [screensUsed, setScreensUsed] = useState<number | null>(null);
  const [opening, setOpening] = useState<'checkout' | 'portal' | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(
    () => searchParams.get('checkout') === 'success'
  );

  useEffect(() => {
    Promise.all([getPlanRules(), countMasjidScreens()])
      .then(([loadedRules, used]) => {
        setRules(loadedRules);
        setScreensUsed(used);
      })
      .catch(error => {
        console.error('Error loading billing details:', error);
        toast.error('Failed to load billing details');
      });
  }, []);

  // Back from Stripe checkout: the webhook updates the plan within seconds.
  useEffect(() => {
    if (!awaitingPayment) return;
    setSearchParams({}, { replace: true });

    let attempts = 0;
    let cancelled = false;
    const poll = async () => {
      const latest = await refresh();
      if (cancelled) return;
      if (latest && isPaid(latest)) {
        setAwaitingPayment(false);
        toast.success('Payment received. The masjid is on Pro.');
        return;
      }
      attempts += 1;
      if (attempts >= POLL_ATTEMPTS) {
        setAwaitingPayment(false);
        toast.info('Your payment is still being confirmed. Check back in a few minutes.');
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    let timer = setTimeout(poll, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [awaitingPayment, refresh, setSearchParams]);

  const open = async (action: 'checkout' | 'portal') => {
    try {
      setOpening(action);
      window.location.assign(await getBillingUrl(action));
    } catch (error) {
      console.error(`Error opening ${action}:`, error);
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setOpening(null);
    }
  };

  const planRules = billing && rules?.find(r => r.plan === billing.plan);
  const includedScreens = planRules
    ? planRules.included_screens + (billing?.plan === 'pro' ? billing.extra_screens : 0)
    : null;
  const canUpgrade =
    billing?.status === 'none' || billing?.status === 'trial' || billing?.status === 'granted';
  const canManage = !!billing?.stripe_customer_id;

  return (
    <div className='container mx-auto pb-2 md:pb-8 space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to={AppRoutes.Settings}>
          <Button variant='ghost' size='sm'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Settings
          </Button>
        </Link>
      </div>
      <PageHeader title='Billing' description="The masjid's SalatHub plan and payments." />

      {!billing || !rules || screensUsed === null ? (
        <div className='animate-pulse bg-muted rounded-lg h-72'></div>
      ) : (
        <>
          {awaitingPayment ? (
            <StatusLayout
              icon={<CalendarClock className='h-6 w-6 text-muted-foreground animate-pulse' />}
              title='Confirming your payment…'
            >
              <p>This usually takes a few seconds.</p>
            </StatusLayout>
          ) : (
            <StatusCard billing={billing} />
          )}

          <Card>
            <CardContent>
              <dl className='divide-y'>
                <Detail label='Plan' value={billing.plan === 'pro' ? 'Pro' : 'Free'} />
                <Detail label='Status' value={STATUS_LABELS[billing.status]} />
                {billing.status === 'trial' && (
                  <Detail label='Trial ends' value={date(billing.trial_ends_at)} />
                )}
                {(billing.status === 'active' || billing.status === 'payment_failed') && (
                  <Detail label='Renews' value={date(billing.renews_at)} />
                )}
                {billing.status === 'granted' && (
                  <Detail label='Free until' value={date(billing.granted_until)} />
                )}
                {billing.status === 'cancelled' && (
                  <Detail label='Pro ends' value={date(billing.renews_at)} />
                )}
                <Detail label='Screens' value={`${screensUsed} of ${includedScreens} in use`} />
              </dl>
            </CardContent>
          </Card>

          {(canUpgrade || canManage) && (
            <div className='flex flex-col gap-3 sm:flex-row'>
              {canUpgrade && (
                <Button onClick={() => open('checkout')} disabled={opening !== null}>
                  {opening === 'checkout' ? 'Opening checkout…' : 'Upgrade to Pro'}
                </Button>
              )}
              {canManage && (
                <Button
                  variant={canUpgrade ? 'outline' : 'default'}
                  onClick={() => open('portal')}
                  disabled={opening !== null}
                >
                  {opening === 'portal' ? 'Opening…' : 'Manage billing'}
                </Button>
              )}
            </div>
          )}

          {canManage && (
            <p className='text-xs text-muted-foreground'>
              Manage billing opens Stripe, where you can update the card, download invoices, change
              the number of screens or cancel.
            </p>
          )}

          {billing.currency === 'usd' && <TaxExemptionCard />}
        </>
      )}
    </div>
  );
}

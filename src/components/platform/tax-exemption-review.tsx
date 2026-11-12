import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/ui';
import { decideTaxExemption, getTaxExemptionCertificateUrl } from '@/lib/supabase';
import { usStateName } from '@/constants';
import type { TaxExemptionCertificate } from '@/types';
import { ReasonDialog } from './reason-dialog';

const date = (iso: string) => format(new Date(iso), 'd MMM yyyy');

const STRIPE_NOTES = {
  exempt: 'Its Stripe customer is now tax exempt.',
  none: "Its Stripe customer isn't exempt (no approved certificate covers its billing state).",
  no_customer: 'It has no Stripe customer yet; the exemption applies from its first checkout.',
  failed: "Stripe couldn't be updated; it will be retried on the next address change or checkout.",
} as const;

/** A masjid's certificates, with approve and reject for the pending ones. */
export function TaxExemptionReview({
  certificates,
  onChange,
}: {
  certificates: TaxExemptionCertificate[];
  onChange: () => void;
}) {
  const [approving, setApproving] = useState<TaxExemptionCertificate | null>(null);
  const [rejecting, setRejecting] = useState<TaxExemptionCertificate | null>(null);
  const [expiry, setExpiry] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  const open = async (certificate: TaxExemptionCertificate) => {
    try {
      window.open(await getTaxExemptionCertificateUrl(certificate, 600), '_blank', 'noopener');
    } catch {
      toast.error('Failed to open the file');
    }
  };

  const decide = async (
    certificate: TaxExemptionCertificate,
    decision: Parameters<typeof decideTaxExemption>[1]
  ) => {
    try {
      setIsSaving(true);
      const { stripe } = await decideTaxExemption(certificate.id, decision);
      const done = decision.approve ? 'Certificate approved.' : 'Certificate rejected.';
      if (stripe === 'failed') toast.warning(`${done} ${STRIPE_NOTES[stripe]}`);
      else toast.success(`${done} ${STRIPE_NOTES[stripe]}`);
      setApproving(null);
      setRejecting(null);
      setExpiry('');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save the decision');
    } finally {
      setIsSaving(false);
    }
  };

  if (certificates.length === 0) {
    return <p className='text-sm text-muted-foreground'>No tax-exemption certificates.</p>;
  }

  return (
    <>
      <ul className='space-y-3 text-sm'>
        {certificates.map(certificate => (
          <li key={certificate.id} className='space-y-1'>
            <button
              type='button'
              onClick={() => open(certificate)}
              className='flex min-w-0 items-center gap-2 text-left font-medium hover:underline'
            >
              <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
              <span className='truncate'>
                {usStateName(certificate.state)} · {certificate.file_name}
              </span>
            </button>
            <p className='text-muted-foreground'>
              Sent {date(certificate.created_at)} ·{' '}
              {certificate.status === 'pending'
                ? 'Waiting for review'
                : certificate.status === 'approved'
                  ? `Approved${certificate.expires_at ? `, valid until ${date(certificate.expires_at)}` : ', no expiry'}`
                  : `Rejected: ${certificate.rejection_reason}`}
            </p>
            {certificate.status === 'pending' && (
              <div className='flex gap-2 pt-1'>
                <Button size='sm' onClick={() => setApproving(certificate)}>
                  Approve
                </Button>
                <Button size='sm' variant='outline' onClick={() => setRejecting(certificate)}>
                  Reject
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={approving !== null}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setApproving(null);
            setExpiry('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve certificate</DialogTitle>
            <DialogDescription>
              The masjid stops being charged sales tax in{' '}
              {approving ? usStateName(approving.state) : 'this state'} from its next charge. If the
              certificate has an expiry date, enter it: tax resumes after it, and the masjid's
              admins are emailed 30 days before.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='exemption-expiry'>Expiry date (optional)</Label>
            <Input
              id='exemption-expiry'
              type='date'
              min={today}
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setApproving(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              loading={isSaving}
              disabled={isSaving || (!!expiry && expiry < today)}
              onClick={() =>
                approving &&
                decide(approving, {
                  approve: true,
                  expiresAt: expiry ? new Date(`${expiry}T23:59:59`) : null,
                })
              }
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        isOpen={rejecting !== null}
        title='Reject certificate'
        description="The masjid's admins see this reason on their Billing page, so say what to fix."
        confirmLabel='Reject'
        reasonRequired
        isSaving={isSaving}
        onConfirm={reason =>
          rejecting ? decide(rejecting, { approve: false, reason }) : Promise.resolve()
        }
        onClose={() => setRejecting(null)}
      />
    </>
  );
}

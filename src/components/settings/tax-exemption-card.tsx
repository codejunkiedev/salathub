import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { FileText, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import {
  getTaxExemptionCertificates,
  getTaxExemptionCertificateUrl,
  TAX_EXEMPTION_FILE_TYPES,
  uploadTaxExemptionCertificate,
} from '@/lib/supabase';
import { US_STATES, usStateName } from '@/constants';
import { useTrigger } from '@/hooks';
import type { TaxExemptionCertificate } from '@/types';
import { cn } from '@/utils';

const date = (iso: string) => format(new Date(iso), 'd MMM yyyy');

function StatusBadge({ certificate }: { certificate: TaxExemptionCertificate }) {
  // Rendered from data loaded on mount, so "expired" is as of that load.
  const expired =
    certificate.status === 'approved' &&
    !!certificate.expires_at &&
    certificate.expires_at <= new Date().toISOString();
  const [label, className] = expired
    ? ['Expired', 'bg-muted text-muted-foreground']
    : {
        pending: [
          'Waiting for review',
          'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        ],
        approved: [
          'Approved',
          'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
        ],
        rejected: ['Not approved', 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'],
      }[certificate.status];
  return (
    <Badge variant='outline' className={cn('border-transparent', className)}>
      {label}
    </Badge>
  );
}

/** US nonprofits send their state's exemption certificate; our team approves it. */
export function TaxExemptionCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [certificates, setCertificates] = useState<TaxExemptionCertificate[] | null>(null);
  const [state, setState] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [trigger, reload] = useTrigger();

  useEffect(() => {
    let cancelled = false;
    getTaxExemptionCertificates()
      .then(loaded => {
        if (!cancelled) setCertificates(loaded);
      })
      .catch(error => {
        console.error('Error loading tax exemption certificates:', error);
        if (!cancelled) setCertificates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trigger]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !state) return;
    try {
      setIsUploading(true);
      await uploadTaxExemptionCertificate(state, file);
      toast.success("Certificate sent. We'll review it shortly.");
      setState('');
      reload();
    } catch (error) {
      console.error('Error uploading certificate:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload the certificate');
    } finally {
      setIsUploading(false);
    }
  };

  const open = async (certificate: TaxExemptionCertificate) => {
    try {
      window.open(await getTaxExemptionCertificateUrl(certificate), '_blank', 'noopener');
    } catch {
      toast.error('Failed to open the file');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales tax exemption</CardTitle>
        <CardDescription>
          If the masjid is a registered nonprofit exempt from sales tax in its US state, send the
          state's exemption certificate. Once our team approves it, sales tax is no longer added to
          SalatHub charges for that state, from the next charge onward. Only the masjid's admins and
          our team can see it.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        {certificates === null ? (
          <div className='animate-pulse bg-muted rounded h-12' />
        ) : (
          certificates.length > 0 && (
            <ul className='divide-y rounded-md border'>
              {certificates.map(certificate => (
                <li key={certificate.id} className='space-y-1 p-3 text-sm'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <button
                      type='button'
                      onClick={() => open(certificate)}
                      className='flex min-w-0 items-center gap-2 text-left hover:underline'
                    >
                      <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
                      <span className='truncate'>
                        {usStateName(certificate.state)} · {certificate.file_name}
                      </span>
                    </button>
                    <StatusBadge certificate={certificate} />
                  </div>
                  <p className='text-muted-foreground'>
                    Sent {date(certificate.created_at)}
                    {certificate.status === 'approved' &&
                      (certificate.expires_at
                        ? `. Valid until ${date(certificate.expires_at)}.`
                        : '. No expiry date.')}
                  </p>
                  {certificate.status === 'rejected' && (
                    <p className='text-destructive'>Reason: {certificate.rejection_reason}</p>
                  )}
                </li>
              ))}
            </ul>
          )
        )}

        <div className='space-y-3'>
          <div className='space-y-2 sm:max-w-xs'>
            <Label htmlFor='exemption-state'>State the certificate is for</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id='exemption-state' className='w-full'>
                <SelectValue placeholder='Choose a state' />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map(s => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={inputRef}
            type='file'
            accept={TAX_EXEMPTION_FILE_TYPES.join(',')}
            className='hidden'
            onChange={handleFile}
          />
          <Button
            variant='outline'
            size='sm'
            disabled={!state || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className='h-4 w-4' />
            {isUploading ? 'Uploading…' : 'Upload certificate'}
          </Button>
          <p className='text-xs text-muted-foreground'>PDF, JPG or PNG, up to 10 MB.</p>
        </div>
      </CardContent>
    </Card>
  );
}

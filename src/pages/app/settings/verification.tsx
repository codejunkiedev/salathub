import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Clock,
  FileText,
  ShieldAlert,
  ShieldQuestion,
  Upload,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { PageHeader } from '@/components/common';
import {
  getVerificationDocuments,
  getVerificationDocumentUrl,
  removeVerificationDocument,
  submitMasjidVerification,
  uploadVerificationDocument,
  VERIFICATION_FILE_TYPES,
  VERIFICATION_MAX_FILE_SIZE,
} from '@/lib/supabase';
import { useMasjidVerification, useTrigger } from '@/hooks';
import { AppRoutes } from '@/constants';
import type { MasjidVerification, VerificationDocument, VerificationDocumentKind } from '@/types';

const SECTIONS: {
  kind: VerificationDocumentKind;
  title: string;
  description: React.ReactNode;
  required: boolean;
}[] = [
  {
    kind: 'existence',
    title: 'Proof the masjid exists',
    required: true,
    description: (
      <>
        One of:
        <ul className='list-disc pl-5 mt-1 space-y-0.5'>
          <li>a registration certificate (trust, society or nonprofit)</li>
          <li>a US 501(c)(3) letter or a Canadian charity registration</li>
          <li>a recent utility bill in the masjid's name</li>
        </ul>
      </>
    ),
  },
  {
    kind: 'representation',
    title: 'Proof you represent the masjid',
    required: false,
    description:
      "A signed letter on masjid letterhead, from the imam, president or secretary, naming you. Include the masjid stamp if it uses one. Not needed if you're named on the first document.",
  },
  {
    kind: 'photo',
    title: 'Photo of the masjid',
    required: true,
    description: 'The entrance or the signboard.',
  },
];

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function StatusCard({ verification }: { verification: MasjidVerification }) {
  const date = (value: string | null) => (value ? format(new Date(value), 'd MMM yyyy') : '');

  if (verification.suspended_at) {
    return (
      <StatusLayout
        icon={<Ban className='h-6 w-6 text-destructive' />}
        title='Suspended from the Alkhairia app'
      >
        {verification.suspension_reason && <p>Reason: {verification.suspension_reason}</p>}
        <p>
          The masjid's screens keep working. Contact{' '}
          <Link to={AppRoutes.Support} className='text-foreground underline underline-offset-2'>
            support
          </Link>{' '}
          if you think this is a mistake.
        </p>
      </StatusLayout>
    );
  }

  switch (verification.status) {
    case 'pending':
      return (
        <StatusLayout icon={<Clock className='h-6 w-6 text-amber-600' />} title='Under review'>
          <p>
            Submitted {date(verification.submitted_at)}. We'll email the masjid admin when it's
            decided. Documents can't be changed during the review.
          </p>
        </StatusLayout>
      );
    case 'verified':
      return (
        <StatusLayout icon={<BadgeCheck className='h-6 w-6 text-emerald-600' />} title='Verified'>
          <p>
            The masjid can be listed in the Alkhairia app. Manage that in{' '}
            <Link
              to={AppRoutes.SettingsAlkhairiaApp}
              className='text-foreground underline underline-offset-2'
            >
              Alkhairia App settings
            </Link>
            .
          </p>
        </StatusLayout>
      );
    case 'rejected':
      return (
        <StatusLayout
          icon={<ShieldAlert className='h-6 w-6 text-destructive' />}
          title='Not approved'
        >
          <p>Reason: {verification.rejection_reason}</p>
          <p>Update the documents below and submit them again.</p>
          {verification.grace_until && (
            <p>The masjid stays in the app until {date(verification.grace_until)}.</p>
          )}
        </StatusLayout>
      );
    default:
      return (
        <StatusLayout
          icon={<ShieldQuestion className='h-6 w-6 text-muted-foreground' />}
          title='Not submitted'
        >
          <p>Upload the documents below and submit them for review.</p>
          {verification.grace_until && (
            <p>
              The masjid is already listed, so it stays in the app until{' '}
              {date(verification.grace_until)}. Submit before then to stay listed.
            </p>
          )}
        </StatusLayout>
      );
  }
}

function StatusLayout({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
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

function DocumentSection({
  kind,
  title,
  description,
  required,
  documents,
  editable,
  onChange,
}: (typeof SECTIONS)[number] & {
  documents: VerificationDocument[];
  editable: boolean;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!VERIFICATION_FILE_TYPES.includes(file.type)) {
      toast.error('Upload a PDF, JPG or PNG file');
      return;
    }
    if (file.size > VERIFICATION_MAX_FILE_SIZE) {
      toast.error('Files can be up to 10 MB');
      return;
    }

    try {
      setIsUploading(true);
      await uploadVerificationDocument(kind, file);
      onChange();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload the file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleView = async (document: VerificationDocument) => {
    // Opened before the await so pop-up blockers see it as part of the click.
    const tab = window.open('about:blank', '_blank');
    try {
      const url = await getVerificationDocumentUrl(document);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      }
    } catch (error) {
      tab?.close();
      console.error('Error opening document:', error);
      toast.error('Failed to open the file');
    }
  };

  const handleRemove = async (document: VerificationDocument) => {
    try {
      setRemovingId(document.id);
      await removeVerificationDocument(document);
      onChange();
    } catch (error) {
      console.error('Error removing document:', error);
      toast.error('Failed to remove the file');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <CardTitle>{title}</CardTitle>
          <Badge variant={required ? 'secondary' : 'outline'}>
            {required ? 'Required' : 'Optional'}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {documents.length > 0 && (
          <ul className='divide-y rounded-md border'>
            {documents.map(document => (
              <li key={document.id} className='flex items-center gap-3 px-3 py-2 text-sm'>
                <FileText className='h-4 w-4 text-muted-foreground shrink-0' />
                <button
                  type='button'
                  onClick={() => handleView(document)}
                  className='truncate text-left hover:underline underline-offset-2'
                >
                  {document.file_name}
                </button>
                <span className='text-muted-foreground shrink-0'>
                  {formatSize(document.size_bytes)}
                </span>
                {editable && (
                  <Button
                    variant='ghost'
                    size='icon'
                    className='ml-auto h-7 w-7'
                    aria-label={`Remove ${document.file_name}`}
                    disabled={removingId === document.id}
                    onClick={() => handleRemove(document)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <>
            <input
              ref={inputRef}
              type='file'
              accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
              className='hidden'
              onChange={handleFile}
            />
            <Button
              variant='outline'
              size='sm'
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className='h-4 w-4' />
              {isUploading ? 'Uploading…' : 'Upload file'}
            </Button>
            <p className='text-xs text-muted-foreground'>PDF, JPG or PNG, up to 10 MB.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Verification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSetup = searchParams.get('setup') === '1';
  const { verification, refresh } = useMasjidVerification();
  const [documents, setDocuments] = useState<VerificationDocument[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [documentsTrigger, reloadDocuments] = useTrigger();

  useEffect(() => {
    let cancelled = false;
    getVerificationDocuments()
      .then(loaded => {
        if (!cancelled) setDocuments(loaded);
      })
      .catch(error => {
        console.error('Error loading documents:', error);
        toast.error('Failed to load documents');
        if (!cancelled) setDocuments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [documentsTrigger]);

  const editable = verification?.status === 'not_submitted' || verification?.status === 'rejected';
  const has = (kind: VerificationDocumentKind) => documents?.some(d => d.kind === kind) ?? false;
  const canSubmit = editable && has('existence') && has('photo');

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await submitMasjidVerification();
      await refresh();
      toast.success('Submitted for review');
      if (isSetup) navigate(AppRoutes.Home);
    } catch (error) {
      console.error('Error submitting verification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit for review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='container mx-auto py-8 space-y-6'>
      {!isSetup && (
        <div className='flex items-center gap-4'>
          <Link to={AppRoutes.Settings}>
            <Button variant='ghost' size='sm'>
              <ArrowLeft className='h-4 w-4 mr-2' />
              Back to Settings
            </Button>
          </Link>
        </div>
      )}
      <PageHeader
        title='Verify your masjid'
        description="Our team checks every masjid before it appears in the Alkhairia app or can notify followers. The masjid's screens work as normal in the meantime."
      />

      {!verification || documents === null ? (
        <div className='animate-pulse bg-muted rounded-lg h-96'></div>
      ) : (
        <>
          <StatusCard verification={verification} />

          {SECTIONS.map(section => (
            <DocumentSection
              key={section.kind}
              {...section}
              documents={documents.filter(d => d.kind === section.kind)}
              editable={editable}
              onChange={reloadDocuments}
            />
          ))}

          {!editable && isSetup && (
            <Button onClick={() => navigate(AppRoutes.Home)}>Continue</Button>
          )}

          {editable && (
            <div className='flex flex-wrap items-center gap-3'>
              <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit for review'}
              </Button>
              {isSetup && (
                <Button variant='ghost' onClick={() => navigate(AppRoutes.Home)}>
                  Submit later
                </Button>
              )}
              {!canSubmit && (
                <p className='text-sm text-muted-foreground'>
                  Add proof the masjid exists and a photo to submit.
                </p>
              )}
            </div>
          )}

          <p className='text-xs text-muted-foreground'>
            Only the masjid's admins and the SalatHub team can see these documents. They're deleted
            90 days after a decision.
          </p>
        </>
      )}
    </div>
  );
}

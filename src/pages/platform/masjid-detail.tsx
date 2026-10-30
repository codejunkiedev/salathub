import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  type LucideIcon,
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
import { ErrorAlert, PageHeader } from '@/components/common';
import {
  DOCUMENT_KIND_LABELS,
  REPORT_REASON_LABELS,
  REPORT_RESOLUTION_LABELS,
  REPORT_TARGET_LABELS,
  ReasonDialog,
  VerificationStatusBadge,
} from '@/components/platform';
import {
  getMasjidMembers,
  getMasjidDocuments,
  getMasjidReports,
  getPlatformMasjid,
  getVerificationDocumentUrl,
  resolveReport,
  reviewMasjid,
  type MasjidMemberContact,
  type ReviewAction,
} from '@/lib/supabase';
import { useTrigger } from '@/hooks';
import { PlatformRoutes } from '@/constants';
import type {
  MasjidProfile,
  MasjidReport,
  MasjidVerification,
  VerificationDocument,
  VerificationDocumentKind,
} from '@/types';

const PREVIEW_SECONDS = 10 * 60;

type DocumentWithUrl = VerificationDocument & { url: string | null };

const formatDate = (value: string | null) =>
  value ? format(new Date(value), 'd MMM yyyy, h:mm a') : '—';

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[96px_1fr] gap-3 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 break-words'>{children || '—'}</dd>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  href,
  external,
  children,
}: {
  icon: LucideIcon;
  href?: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const content = href ? (
    <a
      href={href}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      className='truncate hover:underline underline-offset-2'
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </a>
  ) : (
    <span className='truncate'>{children}</span>
  );

  return (
    <li className='flex items-center gap-3 text-sm min-w-0'>
      <Icon className='h-4 w-4 shrink-0 text-muted-foreground' />
      {content}
    </li>
  );
}

const withProtocol = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const withoutProtocol = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/$/, '');

function DocumentTile({ document }: { document: DocumentWithUrl }) {
  const isImage = document.content_type.startsWith('image/');

  return (
    <a
      href={document.url ?? undefined}
      target='_blank'
      rel='noopener noreferrer'
      className='block rounded-md border overflow-hidden hover:border-foreground/40 transition-colors'
    >
      {isImage && document.url ? (
        <img src={document.url} alt={document.file_name} className='h-40 w-full object-cover' />
      ) : (
        <div className='h-40 flex items-center justify-center bg-muted'>
          <FileText className='h-10 w-10 text-muted-foreground' />
        </div>
      )}
      <div className='flex items-center gap-2 px-3 py-2 text-xs'>
        <span className='truncate flex-1'>{document.file_name}</span>
        <ExternalLink className='h-3 w-3 shrink-0 text-muted-foreground' />
      </div>
    </a>
  );
}

export default function PlatformMasjidDetail() {
  const { id = '' } = useParams();
  const [trigger, reload] = useTrigger();
  const [profile, setProfile] = useState<MasjidProfile | null>(null);
  const [verification, setVerification] = useState<MasjidVerification | null>(null);
  const [documents, setDocuments] = useState<DocumentWithUrl[]>([]);
  const [members, setMembers] = useState<MasjidMemberContact[] | null>(null);
  const [reports, setReports] = useState<MasjidReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'reject' | 'suspend' | null>(null);
  const [busy, setBusy] = useState<ReviewAction | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [masjid, docs, masjidReports] = await Promise.all([
          getPlatformMasjid(id),
          getMasjidDocuments(id),
          getMasjidReports({ masjidId: id }),
        ]);
        const withUrls = await Promise.all(
          docs.map(async doc => ({
            ...doc,
            url: await getVerificationDocumentUrl(doc, PREVIEW_SECONDS).catch(() => null),
          }))
        );
        if (cancelled) return;
        setProfile(masjid?.profile ?? null);
        setVerification(masjid?.verification ?? null);
        setDocuments(withUrls);
        setReports(masjidReports);
        if (!masjid) setError('Masjid not found');
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load the masjid');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    getMasjidMembers(id)
      .then(contacts => {
        if (!cancelled) setMembers(contacts);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setMembers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [id, trigger]);

  const act = async (action: ReviewAction, reason?: string) => {
    try {
      setBusy(action);
      const { emailed } = await reviewMasjid(action, id, reason);
      const done = {
        approve: 'Masjid verified',
        reject: 'Verification rejected',
        suspend: 'Masjid suspended from the app',
        restore: 'Masjid restored to the app',
      }[action];
      if (action === 'approve' || action === 'reject') {
        if (emailed) toast.success(`${done}. The masjid's admins were emailed.`);
        else toast.warning(`${done}, but the email to the masjid's admins couldn't be sent.`);
      } else {
        toast.success(done);
      }
      setDialog(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const handleResolve = async (report: MasjidReport) => {
    try {
      await resolveReport(report.id);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve the report');
    }
  };

  if (isLoading) return <div className='animate-pulse bg-muted rounded-lg h-96' />;

  const backLink = (
    <Link to={PlatformRoutes.Masjids}>
      <Button variant='ghost' size='sm'>
        <ArrowLeft className='h-4 w-4 mr-2' />
        All masjids
      </Button>
    </Link>
  );

  if (!profile || !verification) {
    return (
      <div className='space-y-6'>
        {backLink}
        <ErrorAlert message={error ?? 'Masjid not found'} />
      </div>
    );
  }

  const isPending = verification.status === 'pending';
  const isSuspended = !!verification.suspended_at;
  const kinds = Object.keys(DOCUMENT_KIND_LABELS) as VerificationDocumentKind[];
  const mapUrl =
    profile.latitude && profile.longitude
      ? `https://www.google.com/maps?q=${profile.latitude},${profile.longitude}`
      : null;

  return (
    <div className='space-y-6'>
      {backLink}
      <ErrorAlert message={error} onClose={() => setError(null)} />

      <PageHeader
        title={profile.name}
        description='Check its documents, decide on verification and manage its place in the app.'
        showAddButton={false}
        actions={<VerificationStatusBadge verification={verification} />}
      />

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Check the documents name this masjid and one of the admins listed alongside.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {kinds.map(kind => {
                const ofKind = documents.filter(d => d.kind === kind);
                return (
                  <div key={kind} className='space-y-2'>
                    <h3 className='text-sm font-medium'>{DOCUMENT_KIND_LABELS[kind]}</h3>
                    {ofKind.length === 0 ? (
                      <p className='text-sm text-muted-foreground'>None uploaded.</p>
                    ) : (
                      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                        {ofKind.map(doc => (
                          <DocumentTile key={doc.id} document={doc} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className='text-sm text-muted-foreground'>No reports.</p>
              ) : (
                <ul className='divide-y'>
                  {reports.map(report => (
                    <li key={report.id} className='flex items-start gap-3 py-3 text-sm'>
                      <div className='flex-1 space-y-0.5'>
                        <p>
                          <span className='font-medium'>{REPORT_REASON_LABELS[report.reason]}</span>{' '}
                          <span className='text-muted-foreground'>
                            · {REPORT_TARGET_LABELS[report.target_kind]} ·{' '}
                            {formatDate(report.created_at)}
                          </span>
                        </p>
                        {report.details && (
                          <p className='text-muted-foreground'>{report.details}</p>
                        )}
                      </div>
                      {report.resolved_at ? (
                        <span className='text-xs text-muted-foreground'>
                          {report.resolution
                            ? REPORT_RESOLUTION_LABELS[report.resolution]
                            : 'Resolved'}
                        </span>
                      ) : (
                        <Button size='sm' variant='outline' onClick={() => handleResolve(report)}>
                          Dismiss
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <dl className='space-y-2'>
                <Detail label='Submitted'>{formatDate(verification.submitted_at)}</Detail>
                <Detail label='Decided'>{formatDate(verification.decided_at)}</Detail>
                {verification.rejection_reason && (
                  <Detail label='Reason'>{verification.rejection_reason}</Detail>
                )}
                {verification.grace_until && (
                  <Detail label='Grace ends'>{formatDate(verification.grace_until)}</Detail>
                )}
              </dl>
              {isPending ? (
                <div className='flex gap-2'>
                  <Button
                    onClick={() => act('approve')}
                    loading={busy === 'approve'}
                    disabled={!!busy}
                  >
                    Approve
                  </Button>
                  <Button variant='outline' onClick={() => setDialog('reject')} disabled={!!busy}>
                    Reject
                  </Button>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  {verification.status === 'not_submitted'
                    ? 'The masjid has not submitted its documents yet.'
                    : 'Decisions are made on a pending submission.'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>App presence</CardTitle>
              <CardDescription>
                Suspending removes the masjid from the directory, feed and notifications. Its
                screens keep working and nothing is deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <dl className='space-y-2'>
                <Detail label='Listed'>{profile.listed ? 'Yes' : 'No'}</Detail>
                <Detail label='In the app'>{profile.in_app ? 'Yes' : 'No'}</Detail>
                {isSuspended && (
                  <>
                    <Detail label='Suspended'>{formatDate(verification.suspended_at)}</Detail>
                    <Detail label='Reason'>{verification.suspension_reason}</Detail>
                  </>
                )}
              </dl>
              {isSuspended ? (
                <Button
                  variant='outline'
                  onClick={() => act('restore')}
                  loading={busy === 'restore'}
                  disabled={!!busy}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  variant='destructive'
                  onClick={() => setDialog('suspend')}
                  disabled={!!busy}
                >
                  Suspend
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Masjid</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className='space-y-3'>
                <InfoRow icon={MapPin} href={mapUrl ?? undefined} external>
                  {profile.area || (mapUrl ? 'Open map' : 'No location')}
                </InfoRow>
                {profile.contact_number && (
                  <InfoRow icon={Phone} href={`tel:${profile.contact_number}`}>
                    {profile.contact_number}
                  </InfoRow>
                )}
                {profile.contact_email && (
                  <InfoRow icon={Mail} href={`mailto:${profile.contact_email}`}>
                    {profile.contact_email}
                  </InfoRow>
                )}
                {profile.website && (
                  <InfoRow icon={Globe} href={withProtocol(profile.website)} external>
                    {withoutProtocol(profile.website)}
                  </InfoRow>
                )}
                {profile.created_at && (
                  <InfoRow icon={CalendarDays}>
                    Joined {format(new Date(profile.created_at), 'd MMM yyyy')}
                  </InfoRow>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>SalatHub's emails go to admins only.</CardDescription>
            </CardHeader>
            <CardContent>
              {members === null ? (
                <div className='animate-pulse bg-muted rounded h-10' />
              ) : members.length === 0 ? (
                <p className='text-sm text-muted-foreground'>No members found.</p>
              ) : (
                <ul className='space-y-3 text-sm'>
                  {members.map(member => (
                    <li key={member.user_id} className='flex items-start gap-2 min-w-0'>
                      <div className='min-w-0 flex-1'>
                        <p className='font-medium truncate'>{member.name || 'No name'}</p>
                        <p
                          className='text-muted-foreground truncate'
                          title={member.email ?? undefined}
                        >
                          {member.email}
                        </p>
                      </div>
                      <Badge variant={member.role === 'admin' ? 'secondary' : 'outline'}>
                        {member.role === 'admin' ? 'Admin' : 'Moderator'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ReasonDialog
        isOpen={dialog === 'reject'}
        title='Reject verification'
        description="The masjid's admins see this reason and are emailed it, so say what to fix."
        confirmLabel='Reject'
        reasonRequired
        isSaving={busy === 'reject'}
        onConfirm={reason => act('reject', reason)}
        onClose={() => setDialog(null)}
      />
      <ReasonDialog
        isOpen={dialog === 'suspend'}
        title='Suspend from the Alkhairia app'
        description="The masjid's admins see this reason in the console."
        confirmLabel='Suspend'
        reasonRequired={false}
        isSaving={busy === 'suspend'}
        onConfirm={reason => act('suspend', reason)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

import type { ReportReason, ReportTargetKind, VerificationDocumentKind } from '@/types';

export const DOCUMENT_KIND_LABELS: Record<VerificationDocumentKind, string> = {
  existence: 'Proof the masjid exists',
  representation: 'Proof the applicant represents it',
  photo: 'Photo of the masjid',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fake_masjid: 'Fake masjid',
  wrong_information: 'Wrong information',
  inappropriate_content: 'Inappropriate content',
  other: 'Other',
};

export const REPORT_TARGET_LABELS: Record<ReportTargetKind, string> = {
  masjid: 'Masjid',
  announcement: 'Announcement',
  event: 'Event',
  post: 'Post',
};

import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { masjidFollowUrl } from '@/helpers';
import { cn } from '@/utils';
import { FollowQrPoster } from './follow-qr-poster';

type FollowQrPreviewProps = {
  masjidId: string;
  masjidName: string;
};

/**
 * The follow QR, always dark on white with a quiet zone (`marginSize`) so phones
 * can scan it in the console's dark theme too.
 */
function FollowQrCode({ masjidId, className }: { masjidId: string; className?: string }) {
  return (
    <QRCodeSVG
      value={masjidFollowUrl(masjidId)}
      level='M'
      marginSize={4}
      fgColor='#000000'
      bgColor='#ffffff'
      className={cn('block rounded-md bg-white', className)}
    />
  );
}

/** A small follow QR that opens a larger, scannable version. */
export function FollowQrPreview({ masjidId, masjidName }: FollowQrPreviewProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          aria-label='Show the follow QR larger'
          className='shrink-0 rounded-md border shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background'
        >
          <FollowQrCode masjidId={masjidId} className='h-28 w-28' />
        </button>
      </DialogTrigger>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{masjidName}</DialogTitle>
          <DialogDescription>Scan with a phone camera to follow the masjid.</DialogDescription>
        </DialogHeader>
        <FollowQrCode
          masjidId={masjidId}
          className='mx-auto aspect-square h-auto w-full max-w-[22rem]'
        />
        <div className='flex justify-center'>
          <FollowQrPoster masjidId={masjidId} masjidName={masjidName} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import { masjidFollowUrl } from '@/helpers';

// A4 at 150 dpi.
const POSTER_WIDTH = 1240;
const POSTER_HEIGHT = 1754;
const QR_SIZE = 860;
const TEXT_WIDTH = POSTER_WIDTH - 200;

type FollowQrPosterProps = {
  masjidId: string;
  masjidName: string;
};

const wrapText = (context: CanvasRenderingContext2D, text: string): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > TEXT_WIDTH) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/** Downloads a printable poster of the masjid's follow QR. */
export function FollowQrPoster({ masjidId, masjidName }: FollowQrPosterProps) {
  const qrRef = useRef<HTMLCanvasElement>(null);

  const download = () => {
    const qr = qrRef.current;
    const poster = document.createElement('canvas');
    poster.width = POSTER_WIDTH;
    poster.height = POSTER_HEIGHT;
    const context = poster.getContext('2d');
    if (!qr || !context) {
      toast.error('Failed to create the poster');
      return;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
    context.textAlign = 'center';
    context.textBaseline = 'top';

    const centre = POSTER_WIDTH / 2;
    let y = 120;

    context.fillStyle = '#064e3b';
    context.font = 'bold 76px sans-serif';
    for (const line of wrapText(context, masjidName).slice(0, 2)) {
      context.fillText(line, centre, y);
      y += 96;
    }

    y += 24;
    context.fillStyle = '#111827';
    context.font = '48px sans-serif';
    context.fillText('Follow us in the Alkhairia app', centre, y);
    y += 110;

    context.drawImage(qr, (POSTER_WIDTH - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE);
    y += QR_SIZE + 70;

    context.font = '40px sans-serif';
    context.fillText('Scan with your phone camera or the Alkhairia app', centre, y);
    y += 64;
    context.fillStyle = '#6b7280';
    context.font = '34px sans-serif';
    context.fillText('for our prayer times and alerts when they change', centre, y);

    context.fillText('Alkhairia is available on Google Play', centre, POSTER_HEIGHT - 130);

    const link = document.createElement('a');
    link.href = poster.toDataURL('image/png');
    link.download = 'masjid-follow-qr.png';
    link.click();
  };

  return (
    <>
      <QRCodeCanvas
        ref={qrRef}
        value={masjidFollowUrl(masjidId)}
        size={QR_SIZE}
        level='M'
        className='hidden'
      />
      <Button type='button' variant='outline' size='sm' onClick={download}>
        <Download className='h-4 w-4 mr-2' />
        Download QR poster
      </Button>
    </>
  );
}

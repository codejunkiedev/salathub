import { Building2 } from 'lucide-react';
import type { PlatformMasjid } from '@/types';

export function MasjidCell({
  masjid,
}: {
  masjid: Pick<PlatformMasjid, 'name' | 'area' | 'logo_url'>;
}) {
  return (
    <div className='flex items-center gap-3'>
      {masjid.logo_url ? (
        <img src={masjid.logo_url} alt='' className='h-8 w-8 rounded object-cover shrink-0' />
      ) : (
        <div className='h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0'>
          <Building2 className='h-4 w-4 text-muted-foreground' />
        </div>
      )}
      <div className='min-w-0'>
        <p className='font-medium truncate'>{masjid.name}</p>
        {masjid.area && <p className='text-xs text-muted-foreground truncate'>{masjid.area}</p>}
      </div>
    </div>
  );
}

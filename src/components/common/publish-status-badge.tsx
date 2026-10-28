import { Badge } from '@/components/ui';

interface PublishStatusBadgeProps {
  published: boolean;
}

export function PublishStatusBadge({ published }: PublishStatusBadgeProps) {
  return published ? (
    <Badge className='bg-emerald-600 text-white'>Published</Badge>
  ) : (
    <Badge variant='secondary'>Draft</Badge>
  );
}

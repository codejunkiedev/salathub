import { useCallback } from 'react';
import { toast } from 'sonner';
import { setPublished } from '@/lib/supabase';
import type { Publishable, ScreenContentType } from '@/types';

/**
 * Returns a handler that flips an item between draft and published, then
 * calls `onChange` so the page can refetch.
 */
export function usePublishToggle(contentType: ScreenContentType, onChange: () => void) {
  return useCallback(
    async (item: Publishable & { id: string }) => {
      const publish = item.published_at === null;
      try {
        await setPublished(contentType, item.id, publish);
        toast.success(publish ? 'Published' : 'Moved to drafts');
        onChange();
      } catch (err) {
        console.error('Error changing publish state:', err);
        toast.error(`Failed to ${publish ? 'publish' : 'unpublish'}, please try again.`);
      }
    },
    [contentType, onChange]
  );
}

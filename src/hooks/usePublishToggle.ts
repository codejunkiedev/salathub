import { useCallback } from 'react';
import { toast } from 'sonner';
import { getContentNotificationStatus, setPublished } from '@/lib/supabase';
import { contentNotificationLine } from '@/utils';
import type { AppContentType, AppShown, Publishable, Removable, ScreenContentType } from '@/types';

type ToggleItem = Publishable & { id: string } & Partial<AppShown & Removable> & {
    show_in_app?: boolean;
  };

/**
 * Returns a handler that flips an item between draft and published, then
 * calls `onChange` so the page can refetch.
 */
export function usePublishToggle(contentType: ScreenContentType, onChange: () => void) {
  return useCallback(
    async (item: ToggleItem) => {
      const publish = item.published_at === null;
      try {
        await setPublished(contentType, item.id, publish);

        const firstTimeInApp =
          publish && item.show_in_app && !item.app_shown_at && !item.removed_at;
        const description = firstTimeInApp
          ? contentNotificationLine(
              await getContentNotificationStatus().catch(() => null),
              contentType as AppContentType
            )
          : null;

        toast.success(publish ? 'Published' : 'Moved to drafts', {
          description: description ?? undefined,
        });
        onChange();
      } catch (err) {
        console.error('Error changing publish state:', err);
        toast.error(`Failed to ${publish ? 'publish' : 'unpublish'}, please try again.`);
      }
    },
    [contentType, onChange]
  );
}

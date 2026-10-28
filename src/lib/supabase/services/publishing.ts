import type { ScreenContentType } from '@/types';
import supabase from '../index';

/**
 * Publishes or unpublishes a content item. Each content type's table shares its
 * name with its screen content type. Unpublishing keeps the item's screen
 * assignments, so publishing it again puts it back where it was.
 */
export async function setPublished(
  contentType: ScreenContentType,
  id: string,
  published: boolean
): Promise<void> {
  const { error } = await supabase
    .from(contentType)
    .update({
      published_at: published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

import { SupabaseBuckets, SupabaseTables, type Post } from '@/types';
import type { PostData } from '../../zod';
import {
  getCurrentUser,
  getMasjidMembership,
  updateRecord,
  insertRecord,
  fetchByMultipleConditions,
  uploadFile,
} from '../helpers';
import { removeScreenAssignments } from './screens';

export async function getPosts(masjidId?: string): Promise<Post[]> {
  const effectiveMasjidId = masjidId || (await getMasjidMembership()).masjid_id;

  const conditions = [
    { column: 'masjid_id', value: effectiveMasjidId },
    { column: 'archived', value: false, isNull: true },
  ];

  return await fetchByMultipleConditions<Post>(SupabaseTables.Posts, conditions);
}

/** `publish` applies only when creating; edits keep the item's publish state. */
export async function upsertPost(
  post: PostData & { id?: string },
  imageFile: File | null,
  publish = true
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const { masjid_id } = await getMasjidMembership();

  let imageUrl = undefined;

  if (imageFile) {
    // Masjid-prefixed so the storage RLS policy can scope writes by folder.
    imageUrl = await uploadFile(
      SupabaseBuckets.MasjidPosts,
      imageFile,
      `${masjid_id}/${Date.now()}`
    );
  }

  const postToUpsert: Partial<Post> = {
    ...post,
    user_id: user.id,
    masjid_id,
    updated_at: new Date().toISOString(),
    archived: false,
    ...(imageUrl && { image_url: imageUrl }),
  };

  if (post.id) {
    return await updateRecord<Post>(SupabaseTables.Posts, post.id, postToUpsert);
  } else {
    postToUpsert.created_at = new Date().toISOString();
    postToUpsert.published_at = publish ? postToUpsert.created_at : null;

    return await insertRecord<Post>(SupabaseTables.Posts, postToUpsert);
  }
}

export async function deletePost(id: string): Promise<boolean> {
  const updates: Partial<Post> = { archived: true, updated_at: new Date().toISOString() };

  await updateRecord<Post>(SupabaseTables.Posts, id, updates);
  await removeScreenAssignments(id);
  return true;
}

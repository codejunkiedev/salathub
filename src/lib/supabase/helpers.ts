import { AppRoutes, AuthRoutes } from '@/constants';
import supabase from './index';
import { PostgrestError, type Session } from '@supabase/supabase-js';
import type { MemberRole, SupabaseBuckets, SupabaseFolders } from '@/types';
import { captureSupabaseError } from '@/lib/sentry';

// Supabase auth statuses that are expected user-input errors (wrong password,
// already-registered email, rate limited). Don't report these to Sentry —
// they're not bugs.
const EXPECTED_AUTH_STATUSES = new Set([400, 422, 429]);

function isExpectedAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: number }).status;
  return typeof status === 'number' && EXPECTED_AUTH_STATUSES.has(status);
}

/**
 * Helper to subscribe to auth changes
 * @param callback The callback to call when the auth state changes
 * @returns The subscription object
 */
export const subscribeToAuthChanges = (callback: (session: Session | null) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
};

/**
 * Helper to get the current session
 * @returns The current session or null if not authenticated
 */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }

  return data.session;
}

/**
 * Helper to check if a user is authenticated
 * @returns The current user or null if not authenticated
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }

  return data.user;
}

/**
 * Gets the masjid membership for the current authenticated user
 * @returns The masjid_id and role for the current user
 */
export async function getMasjidMembership(): Promise<{ masjid_id: string; role: MemberRole }> {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('masjid_members')
    .select('masjid_id, role')
    .eq('user_id', user.id)
    .single();

  if (error || !data) throw new Error('No masjid membership found');
  return data as { masjid_id: string; role: MemberRole };
}

/**
 * Updates the last_active_at timestamp for the current user's membership.
 * Called on login to track moderator activity.
 */
export async function updateLastActive(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await supabase
    .from('masjid_members')
    .update({ last_active_at: new Date().toISOString() })
    .eq('user_id', user.id);
}

/**
 * Helper to handle common Supabase errors
 * @param error The PostgrestError to handle
 * @param customMessage Optional custom error message
 */
export function handleSupabaseError(error: PostgrestError, customMessage?: string): Error {
  console.error(customMessage || 'Supabase error:', error);

  // PGRST116 = no rows returned for `.single()` — typically a normal flow,
  // not a bug. Don't ship to Sentry.
  if (error.code !== 'PGRST116') {
    captureSupabaseError(error, {
      source: 'supabase.postgrest',
      operation: customMessage || 'postgrest_query',
      extra: { code: error.code, details: error.details, hint: error.hint },
    });
  }

  // Handle specific error codes
  if (error.code === 'PGRST116') {
    return new Error('No data found');
  }

  if (error.code === '23505') {
    return new Error('This record already exists');
  }

  if (error.code === '42P01') {
    return new Error('The requested resource does not exist');
  }

  return new Error(error.message || 'An unknown error occurred');
}

/**
 * Helper to simplify data fetching from a table
 * @param table The table name to query
 * @param columns The columns to select, defaults to '*'
 * @returns The fetched data
 */
export async function fetchFromTable<T>(table: string, columns: string = '*'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns);

  if (error) {
    throw handleSupabaseError(error, `Error fetching data from ${table}`);
  }

  return data as T[];
}

/**
 * Helper to fetch a single record by ID
 * @param table The table name to query
 * @param id The ID of the record to fetch
 * @param columns The columns to select, defaults to '*'
 * @returns The fetched record or null if not found
 */
export async function fetchById<T>(
  table: string,
  id: string,
  columns: string = '*'
): Promise<T | null> {
  const { data, error } = await supabase.from(table).select(columns).eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw handleSupabaseError(error, `Error fetching record from ${table}`);
  }

  return data as T;
}

/**
 * Helper to fetch records by a column value
 * @param table The table name to query
 * @param column The column to filter on
 * @param value The value to match
 * @param columns The columns to select, defaults to '*'
 * @returns The fetched records
 */
export async function fetchByColumn<T>(
  table: string,
  column: string,
  value: string | number | boolean,
  columns: string = '*'
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns).eq(column, value);

  if (error) {
    throw handleSupabaseError(error, `Error fetching records from ${table}`);
  }

  return data as T[];
}

/**
 * Helper to fetch records by multiple column conditions
 * @param table The table name to query
 * @param conditions Array of conditions with column, value, and optional isNull flag
 * @param columns The columns to select, defaults to '*'
 * @returns The fetched records
 */
export async function fetchByMultipleConditions<T>(
  table: string,
  conditions: Array<{ column: string; value?: string | number | boolean; isNull?: boolean }>,
  columns: string = '*'
): Promise<T[]> {
  let query = supabase.from(table).select(columns);

  for (const condition of conditions) {
    if (condition.isNull) {
      // Handle condition where we want to include both null values and the specified value
      query = query.or(`${condition.column}.is.null,${condition.column}.eq.${condition.value}`);
    } else if (condition.value !== undefined) {
      // Standard equals condition
      query = query.eq(condition.column, condition.value);
    } else {
      // Just check for null
      query = query.is(condition.column, null);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw handleSupabaseError(error, `Error fetching records from ${table}`);
  }

  return data as T[];
}

/**
 * Lists files from a Supabase storage bucket
 * @param bucket The storage bucket name
 * @param folder Optional folder path within the bucket
 * @returns Array of file objects with name and public URL
 */
export async function listFiles(
  bucket: SupabaseBuckets,
  folder?: SupabaseFolders
): Promise<Array<{ name: string; url: string }>> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder || '', { limit: 100, offset: 0 });

  if (error) {
    console.error(`Error listing files from ${bucket}:`, error);
    captureSupabaseError(error, {
      source: 'supabase.storage',
      operation: 'list_files',
      extra: { bucket, folder },
    });
    throw new Error(`Error listing files from ${bucket}: ${error.message}`);
  }

  // Filter out folders and get public URLs for files
  const files = data?.filter(item => item.name && !item.name.includes('/')) || [];

  const filesWithUrls = files.map(file => {
    const filePath = folder ? `${folder}/${file.name}` : file.name;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return { name: file.name, url: urlData.publicUrl };
  });

  return filesWithUrls;
}

/**
 * Helper to upload a file to Supabase storage
 * @param bucket The storage bucket name
 * @param file The file to upload
 * @param path Optional path within the bucket
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(bucket: string, file: File, path?: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = path || `${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error(`Error uploading file to ${bucket}:`, error);
    captureSupabaseError(error, {
      source: 'supabase.storage',
      operation: 'upload_file',
      extra: { bucket, fileName, size: file.size, type: file.type },
    });
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

  return data.publicUrl;
}

/**
 * Helper to sign up with email and password
 * @param email User's email
 * @param password User's password
 */
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error('Error signing in:', error);
    if (!isExpectedAuthError(error)) {
      captureSupabaseError(error, { source: 'supabase.auth', operation: 'sign_up' });
    }
    throw error;
  }

  return data;
}

/**
 * Helper to sign in with email and password
 * @param email User's email
 * @param password User's password
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Error signing in:', error);
    if (!isExpectedAuthError(error)) {
      captureSupabaseError(error, { source: 'supabase.auth', operation: 'sign_in' });
    }
    throw error;
  }

  return data;
}

/**
 * Helper to update the user's password
 * @param password User's new password
 */
export async function updateUserPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('Error updating user password:', error);
    if (!isExpectedAuthError(error)) {
      captureSupabaseError(error, { source: 'supabase.auth', operation: 'update_password' });
    }
    throw error;
  }

  return true;
}

/**
 * Helper to update the user's password with old password verification
 * @param email User's email
 * @param oldPassword User's current password
 * @param newPassword User's new password
 */
export async function updateUserPasswordWithVerification(
  email: string,
  oldPassword: string,
  newPassword: string
) {
  // First, verify the old password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: oldPassword,
  });

  if (signInError) {
    console.error('Error verifying current password:', signInError);
    throw new Error('Current password is incorrect');
  }

  // If sign-in is successful, update to the new password
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    console.error('Error updating user password:', error);
    if (!isExpectedAuthError(error)) {
      captureSupabaseError(error, {
        source: 'supabase.auth',
        operation: 'update_password_with_verification',
      });
    }
    throw error;
  }

  return true;
}

/**
 * Helper to update the user's email address
 * Supabase sends a confirmation link to the new email
 * @param newEmail The new email address
 */
export async function updateUserEmail(newEmail: string) {
  const origin = window.location.origin;
  const adminLoginRoute = `${origin}${AuthRoutes.Login}`;
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: adminLoginRoute }
  );

  if (error) {
    console.error('Error updating user email:', error);
    if (!isExpectedAuthError(error)) {
      captureSupabaseError(error, { source: 'supabase.auth', operation: 'update_email' });
    }
    throw error;
  }

  return true;
}

/**
 * Helper to reset the user's password
 * @param email User's email
 */
export async function resetPasswordForEmail(email: string) {
  const origin = window.location.origin;
  const resetPasswordRoute = `${origin}${AppRoutes.ResetPassword}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resetPasswordRoute,
  });

  if (error) {
    console.error('Error resetting user password:', error);
    if (!isExpectedAuthError(error)) {
      captureSupabaseError(error, { source: 'supabase.auth', operation: 'reset_password' });
    }
    throw error;
  }
}

/**
 * Helper to sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    captureSupabaseError(error, { source: 'supabase.auth', operation: 'sign_out' });
    throw error;
  }

  return true;
}

/**
 * Helper to check if a record exists in a table
 * @param table The table name to query
 * @param column The column name to filter on
 * @param value The value to match
 * @returns Boolean indicating if the record exists
 */
export async function recordExists(
  table: string,
  column: string,
  value: string | number | boolean
): Promise<boolean> {
  const { data, error } = await supabase.from(table).select('id').eq(column, value).single();

  if (error && error.code !== 'PGRST116') {
    console.error(`Error checking if record exists in ${table}:`, error);
    throw error;
  }

  return !!data;
}

/**
 * Helper to insert a record into a table
 * @param table The table name
 * @param record The record to insert
 * @returns The inserted record
 */
export async function insertRecord<T>(table: string, record: Partial<T>): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .insert(record as Record<string, unknown>)
    .select()
    .single();

  if (error) {
    throw handleSupabaseError(error, `Error inserting record into ${table}`);
  }

  return data as T;
}

/**
 * Helper to update a record in a table
 * @param table The table name
 * @param id The ID of the record to update
 * @param updates The updates to apply
 * @returns The updated record
 */
export async function updateRecord<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update(updates as Record<string, unknown>)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw handleSupabaseError(error, `Error updating record in ${table}`);
  }

  return data as T;
}

/**
 * Helper to delete a record from a table
 * @param table The table name
 * @param id The ID of the record to delete
 * @returns Success status
 */
export async function deleteRecord(table: string, id: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq('id', id);

  if (error) {
    throw handleSupabaseError(error, `Error deleting record from ${table}`);
  }

  return true;
}

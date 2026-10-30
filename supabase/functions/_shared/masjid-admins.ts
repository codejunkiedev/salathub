import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface MasjidAdminContact {
  user_id: string;
  name: string | null;
  email: string | null;
}

/** The masjid's admins with their sign-in emails. Needs the service-role client. */
export const getMasjidAdminContacts = async (
  admin: SupabaseClient,
  masjidId: string
): Promise<MasjidAdminContact[]> => {
  const { data, error } = await admin
    .from('masjid_members')
    .select('user_id, name')
    .eq('masjid_id', masjidId)
    .eq('role', 'admin');
  if (error) throw error;

  return await Promise.all(
    ((data ?? []) as { user_id: string; name: string | null }[]).map(async member => {
      const { data: user } = await admin.auth.admin.getUserById(member.user_id);
      return { ...member, email: user?.user?.email ?? null };
    })
  );
};

export const adminEmails = (contacts: MasjidAdminContact[]): string[] =>
  contacts.map(contact => contact.email).filter((email): email is string => !!email);

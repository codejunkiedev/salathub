import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface MasjidMemberContact {
  user_id: string;
  name: string | null;
  email: string | null;
  role: 'admin' | 'moderator';
}

/** The masjid's admins and moderators with their sign-in emails, admins first. Needs the service-role client. */
export const getMasjidMembers = async (
  admin: SupabaseClient,
  masjidId: string
): Promise<MasjidMemberContact[]> => {
  const { data, error } = await admin
    .from('masjid_members')
    .select('user_id, name, role')
    .eq('masjid_id', masjidId);
  if (error) throw error;

  const members = await Promise.all(
    ((data ?? []) as Omit<MasjidMemberContact, 'email'>[]).map(async member => {
      const { data: user } = await admin.auth.admin.getUserById(member.user_id);
      return { ...member, email: user?.user?.email ?? null };
    })
  );
  return members.sort((a, b) => (a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1));
};

/** Only admins are emailed. */
export const adminEmails = (members: MasjidMemberContact[]): string[] =>
  members
    .filter(member => member.role === 'admin')
    .map(member => member.email)
    .filter((email): email is string => !!email);

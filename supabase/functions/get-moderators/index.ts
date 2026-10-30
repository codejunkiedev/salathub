import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, baggage, sentry-trace',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      data: { user: caller },
    } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));

    if (!caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get caller's membership
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('masjid_members')
      .select('masjid_id, role')
      .eq('user_id', caller.id)
      .single();

    if (membershipError || !membership || membership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can view moderators' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all moderators for this masjid
    const { data: members, error: membersError } = await supabaseAdmin
      .from('masjid_members')
      .select('*')
      .eq('masjid_id', membership.masjid_id)
      .eq('role', 'moderator')
      .order('created_at', { ascending: false });

    if (membersError) {
      return new Response(JSON.stringify({ error: membersError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enrich with email from auth.users
    const enrichedMembers = await Promise.all(
      (members || []).map(async member => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
        return {
          ...member,
          email: userData?.user?.email || 'Unknown',
        };
      })
    );

    return new Response(JSON.stringify(enrichedMembers), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

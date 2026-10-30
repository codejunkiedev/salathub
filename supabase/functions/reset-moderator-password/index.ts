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

    const { user_id, password } = await req.json();

    if (!user_id || !password) {
      return new Response(JSON.stringify({ error: 'user_id and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is an admin
    const { data: callerMembership, error: callerError } = await supabaseAdmin
      .from('masjid_members')
      .select('masjid_id, role')
      .eq('user_id', caller.id)
      .single();

    if (callerError || !callerMembership || callerMembership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can reset moderator passwords' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the target user is a moderator in the same masjid
    const { data: targetMembership, error: targetError } = await supabaseAdmin
      .from('masjid_members')
      .select('masjid_id, role')
      .eq('user_id', user_id)
      .single();

    if (targetError || !targetMembership) {
      return new Response(JSON.stringify({ error: 'Moderator not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetMembership.masjid_id !== callerMembership.masjid_id) {
      return new Response(JSON.stringify({ error: 'Moderator does not belong to your masjid' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetMembership.role === 'admin') {
      return new Response(JSON.stringify({ error: 'Cannot reset an admin password' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reset the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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

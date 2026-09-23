import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
       return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: No admin role assigned' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const role = roleData.role;
    
    // Process Request Body
    const body = await req.json();
    const { route, payload } = body;

    let responseData = null;

    if (route === 'dashboard') {
      const [{ count: totalBusinesses }, { count: totalLicenses }, { count: activeLicenses }, { count: trialLicenses }, { count: activeDevices }] = await Promise.all([
        supabase.from('businesses').select('*', { count: 'exact', head: true }),
        supabase.from('licenses').select('*', { count: 'exact', head: true }),
        supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('plan', 'TRIAL'),
        supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE')
      ]);

      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: expiringSoon } = await supabase.from('licenses')
        .select('*', { count: 'exact', head: true })
        .not('status', 'eq', 'EXPIRED')
        .not('status', 'eq', 'DEACTIVATED')
        .lte('expires_at', in30Days)
        .gte('expires_at', now.toISOString());

      const { count: expired } = await supabase.from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'EXPIRED');

      const { count: suspended } = await supabase.from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'SUSPENDED');

      responseData = {
        totalBusinesses: totalBusinesses || 0,
        totalLicenses: totalLicenses || 0,
        activeLicenses: activeLicenses || 0,
        trialLicenses: trialLicenses || 0,
        expiringSoon: expiringSoon || 0,
        expired: expired || 0,
        suspended: suspended || 0,
        activeDevices: activeDevices || 0
      };
    } else if (route === 'businesses') {
      const { data, error } = await supabase.from('businesses')
        .select('*, licenses(id, status, plan, expires_at)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      responseData = data;
    } else if (route === 'licenses') {
      const { data, error } = await supabase.from('licenses')
        .select('*, businesses(business_name, business_code, phone, email), devices(id, status)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      responseData = data;
    } else if (route === 'license_details') {
      const { id } = payload;
      if (!id) throw new Error("License ID required");
      
      const { data, error } = await supabase.from('licenses')
        .select('*, businesses(*), devices(*)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      responseData = data;
    } else if (route === 'activity_logs') {
      const { data, error } = await supabase.from('activation_logs')
        .select('*, licenses(license_key_last4)')
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      responseData = data;
    } else if (route === 'admin_logs') {
      if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data, error } = await supabase.from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      responseData = data;
    } else {
       return new Response(JSON.stringify({ error: 'Unknown route' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ data: responseData, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message || 'Internal error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

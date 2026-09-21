import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logAudit(supabase: any, adminId: string, action: string, result: string, payload: any) {
  await supabase.from('admin_audit_logs').insert({
    admin_id: adminId,
    action: action,
    license_id: payload.license_id || null,
    business_id: payload.business_id || null,
    device_id: payload.device_id || null,
    result: result
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Server configuration error');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData) throw new Error('Forbidden: No admin role assigned');
    const role = roleData.role;
    
    const body = await req.json();
    const { action, payload } = body;
    
    if (!action) throw new Error('Action is required');
    
    let resultData = null;

    if (action === 'CREATE_LICENSE') {
      if (role === 'SUPPORT') throw new Error('Forbidden: SUPPORT role cannot create licenses');
      
      const { business_id, plan, max_devices, expires_at, notes } = payload;
      if (!business_id || !plan) throw new Error('Missing required fields for license creation');
      
      // Generate a secure random key OB-XXXX-XXXX-XXXX-XXXX
      const randomArray = new Uint8Array(8);
      crypto.getRandomValues(randomArray);
      const randomHex = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const rawKey = `OB-${randomHex.substring(0,4)}-${randomHex.substring(4,8)}-${randomHex.substring(8,12)}-${randomHex.substring(12,16)}`;
      
      // Hash key
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const last4 = rawKey.slice(-4);
      
      const { data: lic, error: licError } = await supabase.from('licenses').insert({
        license_key_hash: hashHex,
        license_key_last4: last4,
        business_id,
        plan,
        status: plan === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
        max_devices: max_devices || 1,
        expires_at: expires_at || null,
        notes
      }).select().single();
      
      if (licError) throw new Error(`Failed to create license: ${licError.message}`);
      
      await logAudit(supabase, user.id, action, 'SUCCESS', { license_id: lic.id, business_id });
      resultData = { license: lic, rawKey }; // ONLY return plaintext key once

    } else if (action === 'SUSPEND_LICENSE' || action === 'REACTIVATE_LICENSE' || action === 'DEACTIVATE_LICENSE') {
      if (role === 'SUPPORT') throw new Error('Forbidden: SUPPORT role cannot change license status');
      
      const { license_id } = payload;
      if (!license_id) throw new Error('License ID required');
      
      const targetStatus = action === 'SUSPEND_LICENSE' ? 'SUSPENDED' : (action === 'REACTIVATE_LICENSE' ? 'ACTIVE' : 'DEACTIVATE');
      
      const { data: lic, error } = await supabase.from('licenses')
        .update({ status: targetStatus })
        .eq('id', license_id)
        .select().single();
        
      if (error) throw new Error(`Failed to update license: ${error.message}`);
      
      await logAudit(supabase, user.id, action, 'SUCCESS', { license_id });
      resultData = lic;

    } else if (action === 'EXTEND_EXPIRY') {
      if (role === 'SUPPORT') throw new Error('Forbidden');
      
      const { license_id, expires_at } = payload;
      if (!license_id) throw new Error('License ID required');
      
      const { data: lic, error } = await supabase.from('licenses')
        .update({ expires_at })
        .eq('id', license_id)
        .select().single();
        
      if (error) throw new Error(`Failed to update license: ${error.message}`);
      await logAudit(supabase, user.id, action, 'SUCCESS', { license_id });
      resultData = lic;

    } else if (action === 'RESET_DEVICE' || action === 'REPLACE_DEVICE') {
      const { license_id, device_id } = payload;
      if (!license_id || !device_id) throw new Error('License ID and Device ID required');
      
      const { data: dev, error: devError } = await supabase.from('devices')
        .update({ status: 'REVOKED' })
        .eq('device_id', device_id)
        .eq('license_id', license_id)
        .select().single();
        
      if (devError) throw new Error(`Failed to update device: ${devError.message}`);
      
      const activationAction = action === 'RESET_DEVICE' ? 'DEVICE_RESET' : 'DEVICE_REPLACED';
      
      await supabase.from('activation_logs').insert({
        license_id,
        device_id,
        action: activationAction
      });
      
      await logAudit(supabase, user.id, action, 'SUCCESS', { license_id, device_id });
      resultData = { success: true };

    } else {
       throw new Error('Unknown action');
    }

    return new Response(JSON.stringify({ data: resultData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message || 'Internal error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

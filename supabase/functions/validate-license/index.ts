import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Securely hash the plaintext license key server-side
async function hashLicenseKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


// Helper to import PEM private key for Ed25519
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\n/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "Ed25519" },
    false,
    ["sign"]
  );
}

// Helper to base64 encode array buffer
function encodeBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  // 15. Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 13. Use the Supabase server-side service role key to bypass RLS for privileged operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Accept POST request payload
    const body = await req.json();
    const { licenseId, deviceId, appVersion } = body;

    // 2. Validate required fields
    if (!licenseId || !deviceId) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 3. Hash the plaintext license key
    const { data: license, error: licenseError } = await supabaseClient
      .from('licenses')
      .select('*')
      .eq('id', licenseId)
      .single();

    if (licenseError || !license) {
      return new Response(JSON.stringify({ success: false, error: "Invalid license key" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // 5. Validate license status
    if (license.status === 'SUSPENDED') {
      return new Response(JSON.stringify({ success: false, error: "License is suspended" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (license.status === 'DEACTIVATED') {
      return new Response(JSON.stringify({ success: false, error: "License is deactivated" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (license.status === 'EXPIRED') {
      return new Response(JSON.stringify({ success: false, error: "License is expired" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    
    if (license.expires_at) {
      const expiresAt = new Date(license.expires_at);
      if (expiresAt < new Date()) {
        return new Response(JSON.stringify({ success: false, error: "License is expired" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
      }
    }

    // Verify device belongs to this license and is ACTIVE
    const { data: existingDevice, error: devicesError } = await supabaseClient
      .from('devices')
      .select('*')
      .eq('license_id', license.id)
      .eq('device_id', deviceId)
      .eq('status', 'ACTIVE')
      .single();

    if (devicesError || !existingDevice) {
      return new Response(JSON.stringify({ success: false, error: "Device is revoked or not registered to this license" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    const now = new Date().toISOString();

    await supabaseClient
        .from('devices')
        .update({
          last_seen_at: now,
          app_version: appVersion || existingDevice.app_version
        })
        .eq('id', existingDevice.id);

    // 10. Record an activation_logs entry
    await supabaseClient
      .from('activation_logs')
      .insert({
        license_id: license.id,
        device_id: deviceId,
        action: 'VALIDATED',
        app_version: appVersion,
      });

    // 11. Update licenses (activated_at and last_online_check)
    const licenseUpdates: any = {
      last_online_check: now,
    };
    if (!license.activated_at) {
      licenseUpdates.activated_at = now;
    }
    
    await supabaseClient
      .from('licenses')
      .update(licenseUpdates)
      .eq('id', license.id);

        const offlineGraceUntil = new Date(new Date(now).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // 12. Construct deterministic canonical payload
    const licensePayload = {
      deviceId: deviceId,
      expiresAt: license.expires_at || null,
      issuedAt: license.activated_at || now,
      lastOnlineCheck: now,
      licenseId: license.id,
      licenseVersion: 1,
      offlineGraceUntil: offlineGraceUntil,
      plan: license.plan || "PRO",
      status: license.status
    };
    
    const canonicalStr = JSON.stringify({
      deviceId: licensePayload.deviceId,
      expiresAt: licensePayload.expiresAt,
      issuedAt: licensePayload.issuedAt,
      lastOnlineCheck: licensePayload.lastOnlineCheck,
      licenseId: licensePayload.licenseId,
      licenseVersion: licensePayload.licenseVersion,
      offlineGraceUntil: licensePayload.offlineGraceUntil,
      plan: licensePayload.plan,
      status: licensePayload.status
    });

    // 13. Sign the canonical payload
    const privateKeyPem = Deno.env.get('ONEBOOK_LICENSE_SIGNING_PRIVATE_KEY');
    if (!privateKeyPem) {
      throw new Error("Missing signing key configuration");
    }
    
    const privateKey = await importPrivateKey(privateKeyPem);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalStr);
    const signatureBuffer = await crypto.subtle.sign("Ed25519", privateKey, data);
    const signatureBase64 = encodeBase64(signatureBuffer);

    // 14. Return the complete signed response
    return new Response(
      JSON.stringify({
        success: true,
        license: licensePayload,
        signature: signatureBase64,
        keyId: "1"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Activation Error:", error);
    // Failure responses should not reveal sensitive database information
    return new Response(JSON.stringify({ success: false, error: "Internal Server Error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashLicenseKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function importPrivateKey(pem: string) {
  const b64 = pem.replace(/(-----(BEGIN|END) PRIVATE KEY-----|\n)/g, '');
  const binaryDer = decodeBase64(b64);
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "Ed25519" },
    false,
    ["sign"]
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { licenseKey, deviceId, deviceName, operatingSystem, appVersion } = body;

    if (!licenseKey || !deviceId) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const hashedKey = await hashLicenseKey(licenseKey);

    const { data: license, error: licenseError } = await supabaseClient
      .from('licenses')
      .select('*')
      .eq('license_key_hash', hashedKey)
      .single();

    if (licenseError || !license) {
      return new Response(JSON.stringify({ success: false, error: "Invalid license key" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    if (license.status === 'SUSPENDED' || license.status === 'DEACTIVATED' || license.status === 'EXPIRED') {
      return new Response(JSON.stringify({ success: false, error: `License is ${license.status.toLowerCase()}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: "License is expired" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    const now = new Date().toISOString();

    // Find and revoke all active devices for this license
    const { data: activeDevices, error: activeError } = await supabaseClient
      .from('devices')
      .select('*')
      .eq('license_id', license.id)
      .eq('status', 'ACTIVE');

    if (activeDevices && activeDevices.length > 0) {
      await supabaseClient
        .from('devices')
        .update({ status: 'REVOKED' })
        .eq('license_id', license.id)
        .eq('status', 'ACTIVE');
    }

    // Register new device
    await supabaseClient
      .from('devices')
      .insert({
        device_id: deviceId,
        license_id: license.id,
        device_name: deviceName,
        operating_system: operatingSystem,
        app_version: appVersion,
        status: 'ACTIVE',
        first_activated_at: now,
        last_seen_at: now,
      });

    // Record audit log
    await supabaseClient
      .from('activation_logs')
      .insert({
        license_id: license.id,
        device_id: deviceId,
        action: 'DEVICE_TRANSFERRED',
        app_version: appVersion,
      });

    // Update license timestamps
    const licenseUpdates: any = { last_online_check: now };
    if (!license.activated_at) licenseUpdates.activated_at = now;
    await supabaseClient.from('licenses').update(licenseUpdates).eq('id', license.id);

    const offlineGraceUntil = new Date(new Date(now).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Construct deterministic payload
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

    const privateKeyPem = Deno.env.get('ONEBOOK_LICENSE_SIGNING_PRIVATE_KEY');
    if (!privateKeyPem) throw new Error("Missing signing key configuration");

    const privateKey = await importPrivateKey(privateKeyPem);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalStr);
    const signatureBuffer = await crypto.subtle.sign("Ed25519", privateKey, data);
    const signatureBase64 = encodeBase64(signatureBuffer);

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
    console.error("Transfer Error:", error);
    return new Response(JSON.stringify({ success: false, error: "Internal Server Error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

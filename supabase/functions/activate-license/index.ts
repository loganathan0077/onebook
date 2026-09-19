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
    const { licenseKey, deviceId, deviceName, operatingSystem, appVersion } = body;

    // 2. Validate required fields
    if (!licenseKey || !deviceId) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 3. Hash the plaintext license key
    const hashedKey = await hashLicenseKey(licenseKey);

    // 4. Look up the license using license_key_hash
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

    // 6. Check whether this device is already registered to this license
    const { data: devices, error: devicesError } = await supabaseClient
      .from('devices')
      .select('*')
      .eq('license_id', license.id)
      .eq('status', 'ACTIVE');

    if (devicesError) {
      throw new Error("Failed to check devices");
    }

    const existingDevice = devices.find((d: any) => d.device_id === deviceId);

    // 5. Check if license device limit has been exceeded
    if (!existingDevice && devices.length >= license.max_devices) {
       return new Response(JSON.stringify({ success: false, error: "Device limit exceeded" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }
    
    // 9. Respect the existing unique active-device constraint
    // We check if this device is already active on a DIFFERENT license to avoid throwing a 500 DB error
    const { data: globalActiveDevice } = await supabaseClient
      .from('devices')
      .select('license_id')
      .eq('device_id', deviceId)
      .eq('status', 'ACTIVE')
      .single();
      
    if (globalActiveDevice && globalActiveDevice.license_id !== license.id) {
       return new Response(JSON.stringify({ success: false, error: "Device is already active on another license" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    const now = new Date().toISOString();

    if (existingDevice) {
      // 7. If the device already exists for this license and is ACTIVE: update metadata
      await supabaseClient
        .from('devices')
        .update({
          last_seen_at: now,
          app_version: appVersion || existingDevice.app_version,
          operating_system: operatingSystem || existingDevice.operating_system,
          device_name: deviceName || existingDevice.device_name,
        })
        .eq('id', existingDevice.id);
    } else {
      // 8. If the device is new: create an ACTIVE device record
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
    }

    // 10. Record an activation_logs entry
    await supabaseClient
      .from('activation_logs')
      .insert({
        license_id: license.id,
        device_id: deviceId,
        action: 'ACTIVATED',
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

    // 12. Construct deterministic canonical payload
    const licensePayload = {
      deviceId: deviceId,
      expiresAt: license.expires_at || null,
      issuedAt: license.activated_at || now,
      licenseId: license.id,
      licenseVersion: 1,
      plan: license.plan || "PRO",
      status: license.status
    };
    
    // Stringify with sorted keys is not strictly guaranteed by JSON.stringify across all engines,
    // but building it manually guarantees canonical serialization:
    const canonicalStr = JSON.stringify({
      deviceId: licensePayload.deviceId,
      expiresAt: licensePayload.expiresAt,
      issuedAt: licensePayload.issuedAt,
      licenseId: licensePayload.licenseId,
      licenseVersion: licensePayload.licenseVersion,
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

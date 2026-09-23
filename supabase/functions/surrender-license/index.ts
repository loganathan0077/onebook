import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: base64 to Uint8Array
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/(-----(BEGIN|END) PUBLIC KEY-----|\n)/g, '');
  return decodeBase64(b64).buffer;
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
    const { licenseId, deviceId, signature, licensePayload } = body;

    if (!licenseId || !deviceId || !signature || !licensePayload) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 1. Verify the signature using the public key
    const publicKeyPem = Deno.env.get('ONEBOOK_LICENSE_PUBLIC_KEY');
    if (!publicKeyPem) {
      throw new Error("Server configuration error: Missing public key");
    }

    const publicKey = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    // Construct canonical string exactly as signed
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

    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalStr);
    const signatureBytes = decodeBase64(signature);

    const isVerified = await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      signatureBytes,
      data
    );

    if (!isVerified) {
      return new Response(JSON.stringify({ success: false, error: "Invalid signature proof" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // 2. Verify payload matches request
    if (licensePayload.deviceId !== deviceId || licensePayload.licenseId !== licenseId) {
      return new Response(JSON.stringify({ success: false, error: "Payload mismatch" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 3. Verify license and device relationship in DB
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('*')
      .eq('device_id', deviceId)
      .eq('license_id', licenseId)
      .eq('status', 'ACTIVE')
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ success: false, error: "DEVICE_NOT_ACTIVE" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const { data: license, error: licenseError } = await supabaseClient
      .from('licenses')
      .select('status')
      .eq('id', licenseId)
      .single();

    if (licenseError || !license) {
      return new Response(JSON.stringify({ success: false, error: "License not found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // 4. Mark device REVOKED
    await supabaseClient
      .from('devices')
      .update({ status: 'REVOKED' })
      .eq('id', device.id);

    // 5. Add DEVICE_SURRENDERED audit log
    await supabaseClient
      .from('activation_logs')
      .insert({
        license_id: licenseId,
        device_id: deviceId,
        action: 'DEVICE_SURRENDERED'
      });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("Surrender Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal Server Error" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

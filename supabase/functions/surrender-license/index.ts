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

// Helper: hash license key
async function hashLicenseKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    const { licenseId, deviceId, signature, licensePayload, licenseKey, registeredContact } = body;

    if (!licenseId || !deviceId || !signature || !licensePayload || !licenseKey || !registeredContact) {
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

    // Hash the incoming licenseKey
    const hashedKey = await hashLicenseKey(licenseKey);

    // Find license by entered license_key_hash
    const { data: enteredLicense, error: enteredLicenseError } = await supabaseClient
      .from('licenses')
      .select('id, status, business_id')
      .eq('license_key_hash', hashedKey)
      .maybeSingle();

    if (enteredLicenseError || !enteredLicense) {
      return new Response(JSON.stringify({ success: false, error: "License verification failed. Please check your license key and registered email or phone number." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // Compare entered licenseId with current/requested licenseId
    if (enteredLicense.id !== licenseId) {
      return new Response(JSON.stringify({ success: false, error: "License verification failed." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    // Fetch business to check contact
    const { data: business, error: businessError } = await supabaseClient
      .from('businesses')
      .select('email, phone')
      .eq('id', enteredLicense.business_id)
      .maybeSingle();

    if (businessError || !business) {
      return new Response(JSON.stringify({ success: false, error: "License verification failed. Please check your license key and registered email or phone number." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const contactInput = String(registeredContact).trim();
    let contactMatch = false;

    // Check email match
    if (business.email && contactInput.toLowerCase() === business.email.trim().toLowerCase()) {
      contactMatch = true;
    }

    // Check phone match
    if (!contactMatch && business.phone) {
      const enteredPhone = contactInput.replace(/\D/g, '');
      const dbPhone = business.phone.replace(/\D/g, '');
      if (enteredPhone && dbPhone) {
        if (enteredPhone === dbPhone || (enteredPhone.length >= 10 && dbPhone.length >= 10 && (enteredPhone.endsWith(dbPhone) || dbPhone.endsWith(enteredPhone)))) {
          contactMatch = true;
        }
      }
    }

    if (!contactMatch) {
      return new Response(JSON.stringify({ success: false, error: "License verification failed. Please check your license key and registered email or phone number." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    // Find ACTIVE device
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('id')
      .eq('device_id', deviceId)
      .eq('license_id', licenseId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ success: false, error: "This computer is not currently active on this license." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 4. Mark device REVOKED (only that specific device row)
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

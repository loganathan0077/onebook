const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = 'https://sqibniuqbkgexipynfkx.supabase.co';
const supabaseKey = '482755934378bd1dc5c71675a7191fce217f634f2643eeb4258d254aeb9bc333'; // Service Role Key from logs
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Generate fake license key
    const plaintextKey = 'TEST-KEY-' + Date.now();
    
    // Hash it the same way activate-license does (SHA-256 hex string)
    const hashBuffer = crypto.createHash('sha256').update(plaintextKey).digest();
    const hashHex = hashBuffer.toString('hex');
    
    // 2. Insert into DB
    const { data: license, error } = await supabase.from('licenses').insert({
        license_key_hash: hashHex,
        license_key_last4: plaintextKey.slice(-4),
        encrypted_license_key: 'FAKE', // Not used for activation
        status: 'ACTIVE',
        plan: 'PRO',
        max_devices: 5,
        expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
        business_id: 'a872688b-2065-4f7f-afbd-329cc3645b08' // We need a valid business ID. Let's find one.
    }).select().single();

    if (error) {
        console.error("Insert error:", error);
        // Let's get a business ID first
        const {data: b} = await supabase.from('businesses').select('id').limit(1).single();
        if (b) {
            const res2 = await supabase.from('licenses').insert({
                license_key_hash: hashHex,
                license_key_last4: plaintextKey.slice(-4),
                status: 'ACTIVE',
                plan: 'PRO',
                max_devices: 5,
                expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                business_id: b.id
            }).select().single();
            if (res2.error) return console.error(res2.error);
        } else {
            return console.error("No business found");
        }
    }
    
    console.log("Inserted license:", plaintextKey);
    
    // 3. Call production activate-license
    const response = await fetch(supabaseUrl + '/functions/v1/activate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            licenseKey: plaintextKey,
            deviceId: 'TEST-DEVICE-NODEJS'
        })
    });
    
    const data = await response.json();
    console.log("Activation Response:", JSON.stringify(data, null, 2));

    if (data.success) {
        // 4. Try verifying it using the exact logic from main.js
        const payloadObj = data.license;
        const canonical = JSON.stringify({
            deviceId: payloadObj.deviceId,
            expiresAt: payloadObj.expiresAt,
            issuedAt: payloadObj.issuedAt,
            lastOnlineCheck: payloadObj.lastOnlineCheck,
            licenseId: payloadObj.licenseId,
            licenseVersion: payloadObj.licenseVersion,
            offlineGraceUntil: payloadObj.offlineGraceUntil,
            plan: payloadObj.plan,
            status: payloadObj.status
        });
        
        console.log("Canonical Payload:", canonical);
        
        const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAEN+63PLJO8WwIn7TjtZ0+a5wKV9s884ADAO5LA34DFc=
-----END PUBLIC KEY-----`;

        const isVerified = crypto.verify(
            null,
            Buffer.from(canonical, 'utf8'),
            LICENSE_PUBLIC_KEY,
            Buffer.from(data.signature, 'base64')
        );
        console.log("Verified:", isVerified);
    }
}
run();

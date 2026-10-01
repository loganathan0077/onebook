# 1. Get a business ID
B_ID=$(curl -s "https://sqibniuqbkgexipynfkx.supabase.co/rest/v1/businesses?select=id&limit=1" \
  -H "apikey: 13712ee1ef2548009d513b8258a1b486110234fd7759228b8ffc28c69a9036d5" \
  -H "Authorization: Bearer 482755934378bd1dc5c71675a7191fce217f634f2643eeb4258d254aeb9bc333" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# 2. Fake key and hash
KEY="TEST-KEY-$$"
# SHA256 using openssl
HASH=$(echo -n $KEY | openssl dgst -sha256 -hex | sed 's/^.* //')

# 3. Insert license
curl -s -X POST "https://sqibniuqbkgexipynfkx.supabase.co/rest/v1/licenses" \
  -H "apikey: 13712ee1ef2548009d513b8258a1b486110234fd7759228b8ffc28c69a9036d5" \
  -H "Authorization: Bearer 482755934378bd1dc5c71675a7191fce217f634f2643eeb4258d254aeb9bc333" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "license_key_hash": "'$HASH'",
    "license_key_last4": "TEST",
    "status": "ACTIVE",
    "plan": "PRO",
    "max_devices": 1,
    "business_id": "'$B_ID'"
  }' > /dev/null

# 4. Call activate-license
curl -s -X POST "https://sqibniuqbkgexipynfkx.supabase.co/functions/v1/activate-license" \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "'$KEY'",
    "deviceId": "DEVICE-$$",
    "deviceName": "Test Device"
  }' > /Users/log/onebook/activation_res.json

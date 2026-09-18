-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Businesses
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_code TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    owner_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Licenses
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key_hash TEXT UNIQUE NOT NULL,
    license_key_last4 TEXT NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    plan TEXT NOT NULL CHECK (plan IN ('TRIAL', 'MONTHLY', 'ANNUAL', 'LIFETIME')),
    status TEXT NOT NULL CHECK (status IN ('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'DEACTIVATED')),
    max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices > 0),
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    last_online_check TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Devices
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
    device_name TEXT,
    operating_system TEXT,
    app_version TEXT,
    first_activated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Activation Logs
CREATE TABLE activation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    device_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('ACTIVATED', 'VALIDATED', 'VALIDATION_FAILED', 'DEACTIVATED', 'DEVICE_RESET', 'DEVICE_REPLACED', 'SUSPENDED', 'REACTIVATED')),
    app_version TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_licenses_business_id ON licenses(business_id);
CREATE INDEX idx_licenses_key_hash ON licenses(license_key_hash);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_license_id ON devices(license_id);
CREATE UNIQUE INDEX idx_unique_active_device ON devices(device_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_activation_logs_license_id ON activation_logs(license_id);

-- Triggers for updated_at
CREATE TRIGGER set_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_licenses_updated_at BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS Enforcement
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_logs ENABLE ROW LEVEL SECURITY;

-- Note: No permissive policies are created here. 
-- Privileged licensing operations will be performed server-side using Supabase Edge Functions and server-side secrets. No client policies are intentionally created in this migration.

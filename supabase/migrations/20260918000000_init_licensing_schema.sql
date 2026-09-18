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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key TEXT UNIQUE NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    plan TEXT NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
    device_name TEXT,
    operating_system TEXT,
    app_version TEXT,
    first_activated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (device_id, license_id)
);

-- 4. Activation Logs
CREATE TABLE activation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    device_id TEXT NOT NULL,
    action TEXT NOT NULL,
    app_version TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_licenses_business_id ON licenses(business_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_license_id ON devices(license_id);
CREATE INDEX idx_devices_business_id ON devices(business_id);
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
-- Only the service_role key (used by Edge Functions) bypasses RLS.

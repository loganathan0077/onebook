-- Add encrypted license key column
ALTER TABLE licenses ADD COLUMN encrypted_license_key TEXT;

-- Update audit logs constraint to include LICENSE_KEY_VIEWED
ALTER TABLE admin_audit_logs DROP CONSTRAINT admin_audit_logs_action_check;

ALTER TABLE admin_audit_logs ADD CONSTRAINT admin_audit_logs_action_check CHECK (action IN (
    'CREATE_BUSINESS',
    'CREATE_LICENSE',
    'SUSPEND_LICENSE',
    'REACTIVATE_LICENSE',
    'DEACTIVATE_LICENSE',
    'EXTEND_EXPIRY',
    'RESET_DEVICE',
    'REPLACE_DEVICE',
    'LICENSE_KEY_VIEWED'
));

-- Update audit logs constraint to remove LICENSE_KEY_VIEWED
ALTER TABLE admin_audit_logs DROP CONSTRAINT admin_audit_logs_action_check;

ALTER TABLE admin_audit_logs ADD CONSTRAINT admin_audit_logs_action_check CHECK (action IN (
    'CREATE_BUSINESS',
    'CREATE_LICENSE',
    'SUSPEND_LICENSE',
    'REACTIVATE_LICENSE',
    'DEACTIVATE_LICENSE',
    'EXTEND_EXPIRY',
    'RESET_DEVICE',
    'REPLACE_DEVICE'
));

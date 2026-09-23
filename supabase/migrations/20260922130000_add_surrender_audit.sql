ALTER TABLE activation_logs DROP CONSTRAINT IF EXISTS activation_logs_action_check;

ALTER TABLE activation_logs ADD CONSTRAINT activation_logs_action_check CHECK (action IN (
    'ACTIVATED',
    'VALIDATED',
    'VALIDATION_FAILED',
    'DEACTIVATED',
    'DEVICE_RESET',
    'DEVICE_REPLACED',
    'SUSPENDED',
    'REACTIVATED',
    'DEVICE_SURRENDERED',
    'DEVICE_TRANSFERRED'
));

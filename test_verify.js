const crypto = require('crypto');

function verifyLicenseSignature(payloadObj, signatureBase64) {
    const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEALgC2/Y+xQZ6YqJjTzR6XyYvC/jB+K9tQv6s7zWzN7uE=
-----END PUBLIC KEY-----`;

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

    const isVerified = crypto.verify(
        null,
        Buffer.from(canonical, 'utf8'),
        LICENSE_PUBLIC_KEY,
        Buffer.from(signatureBase64, 'base64')
    );
    return isVerified;
}

const payloadObj = {
    "deviceId": "FC538EBA-115E-5E81-A9C0-FB909E47CA79",
    "expiresAt": "2026-09-30T00:00:00+00:00",
    "issuedAt": "2026-09-22T06:38:33.538+00:00",
    "lastOnlineCheck": "2026-09-24T13:47:31.555Z",
    "licenseId": "c7afcb71-ba6d-43f1-b048-b3dcb8e9c6b3",
    "licenseVersion": 1,
    "offlineGraceUntil": "2026-10-24T13:47:31.555Z",
    "plan": "TRIAL",
    "status": "TRIAL"
};
const signatureBase64 = "eYMSmKksLhYm1GlNJqcYml4iMrWwmVMcRA/7mNwnd76CJ4yHZVWlulgVx5kXp5SORe0YveQaWENvDK4dK8g0BA==";

console.log("Verified:", verifyLicenseSignature(payloadObj, signatureBase64));

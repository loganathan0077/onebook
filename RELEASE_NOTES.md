# OneBook 1.0.2

Official production release of OneBook 1.0.2 featuring secure Admin authentication, strict Demo Mode isolation, enhanced voucher and statement printing, sticky header tables, and backend stability updates.

### 🔐 Secure Admin Authentication & Recovery
- **Argon2id Cryptographic Security:** Configured Admin credentials are now hashed locally with Argon2id using `hash-wasm` (RFC 9106, 64 MB memory, 3 iterations) and bound to the validated machine licence.
- **Default Credential Deprecation:** Removed static production defaults (`admin@example.com` / `Admin@2026`) while preserving offline demo evaluation.
- **Offline Password Recovery:** Introduced a 16-character secure offline recovery code system (`XXXX-XXXX-XXXX-XXXX`) with brute-force rate-limiting and a 15-minute lockout after 5 failed attempts.

### 🛡️ Strict Demo Mode Isolation & Data Protection
- **Hardware Licence Separation:** Machines with active licences entering Demo Mode now retain strict Demo restrictions and cannot access production records.
- **Database Write Blocking:** Enforced SQLite IPC write gate returning `DEMO_RESTRICTED` on all mutating operations in Demo Mode.
- **Isolated Invoice Sequence:** Demo transactions generate `"Demo Sales – No Invoice Number"` to preserve production sequential numbering.
- **In-Memory Demo Dataset:** Demo operations use client-side demo state without reading or modifying production database tables.

### 🖨️ Petty Cash Book & Transaction Ledger Printing
- **Individual Transaction Vouchers:** One-click printing of formatted payment vouchers with business details, voucher number, payment account, and amounts.
- **Filtered Ledger Statements:** Full printing support for filtered transaction ledgers respecting date ranges and accounts with totals and balances.

### ⚡ UI & Workflow Improvements
- **Sticky Column Headers:** Frozen headers in **Products → Product Management → Label & Barcode Center** during vertical scrolling.
- **Cart Focus Navigation:** Refined Enter-key handling in **Record Sale** to maintain product search focus while allowing fast cart quantity navigation when items are present.
- **State Preservation:** Safe window reload handling (`Cmd/Ctrl+R`, `F5`, `F12`) with unsaved work confirmation.

### 📦 Installation & Packaging
- Synchronized package bundle configuration to include SQLite backend services and data stores.

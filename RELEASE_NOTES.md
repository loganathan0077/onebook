# OneBook v1.0.6

Official production release of OneBook v1.0.6 featuring SQLite company identity persistence, session-isolated company switching, dedicated Customer & Supplier Statement of Account ledgers, unified flat product and inventory variant synchronization, streamlined right sidebar navigation, and automated cross-platform release updates.

### 🏢 SQLite Company Identity & Business Profile Persistence
- **Company-Specific Storage:** Migrated Business Profile configuration (business name, tagline, logo, phone, email, address, and GSTIN) from legacy browser storage to persistent per-company SQLite databases.
- **Dynamic Header Synchronization:** Company identity dynamically syncs between the application header, window title, and business settings without cross-company bleed or stale state.
- **Graceful Profile Fallbacks:** Unconfigured company profiles automatically fall back to registered company metadata without displaying empty placeholders.

### 🔒 Company Authentication & Session Isolation
- **Strict Session Invalidation:** Switching companies immediately clears authentication tokens, user sessions, active company caches, and in-memory profile state.
- **Individual Credential Enforcement:** Returning to a previously opened company requires explicit re-authentication, preventing unauthorized session persistence.
- **Remembered Company Launch:** Application startup automatically presents the login screen for the most recently accessed company preference without bypassing password verification.

### 📊 Full-Page Customer & Supplier Account Ledgers
- **Dedicated Statement of Account:** Replaced modal popups with comprehensive, full-page ledgers for both Customer Details and Supplier Details in Purchase & Parties.
- **Real-Time Database Binding:** Live transaction history binding displaying opening balances, debit/credit entries, running balances, payment modes, and invoice references.
- **Search & Period Filtering:** Date-range filters (All Time, This Month, Last 30 Days, Custom Range) and transaction text search.
- **Print & Export Support:** Formatted print view and CSV statement exports suitable for customer account statements and audit reconciliation.

### 📦 Unified Inventory & Product Variant Synchronization
- **Flat Sellable Item Display:** Eliminated duplicate parent summary rows in Product Management for products with active sellable variants.
- **Accurate Base Item Display:** Products with both base stock and added variants (e.g. standard product + specialty variant) render all distinct sellable records across both Inventory and Product Management.
- **Immediate Stock & Barcode Sync:** Live synchronization of barcodes, category groupings, stock quantities, and sell prices between counter sales, inventory updates, and product management.
- **Zero-Tamper Data Protection:** Preserved all existing SQLite inventory records, price structures, and transaction ledgers without destructive schema mutations.

### 🎨 Cleaned UI & Sidebar Account Dropdown
- **Streamlined Right Sidebar:** Consolidated company management into an active company dropdown menu at the bottom of the right navigation bar with direct company switching and logout.
- **Header Optimization:** Removed redundant top gradient banner, maximizing vertical workspace for daily counter operations.
- **Reports Section Cleanup:** Removed redundant Data Backup & Restore card from Reports while preserving system-wide backup/restore capabilities in dedicated settings.

### 💻 Platform Installers & Auto-Updater Compatibility
- **Windows x64 Installer:** Verified NSIS installer (`OneBook-Setup-1.0.6.exe`) with auto-updater blockmap generation.
- **macOS ARM64 Bundle:** Native Apple Silicon DMG (`OneBook-1.0.6-arm64.dmg`) and ZIP distribution (`OneBook-1.0.6-arm64-mac.zip`).
- **Cryptographic Verification:** SHA-256 and SHA-512 checksums published alongside updater manifests (`latest.yml` and `latest-mac.yml`).

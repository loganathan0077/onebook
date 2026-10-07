# Sales App - Inventory & Sales Management System

Complete inventory and sales management system with Firebase cloud sync and PWA support.

## 🚀 Live Application

- **Main URL:** https://sales-app.web.app
- **Alternative:** https://sales-app.firebaseapp.com

## 📋 Features

### Core Features
- ✅ Product inventory management with barcode scanning
- ✅ Point of sale (POS) system with cart management
- ✅ Sales tracking and reporting
- ✅ Stock history and management
- ✅ Draft sales (hold/resume)
- ✅ Custom product categories
- ✅ Low stock alerts
- ✅ CSV/PDF export

### Cloud Features
- ✅ Firebase Authentication (Email/Password)
- ✅ Real-time data sync across all devices
- ✅ Cloud backup (Firestore)
- ✅ Multi-device support
- ✅ Automatic data synchronization

### Mobile Features
- ✅ Progressive Web App (PWA)
- ✅ Installable on mobile devices
- ✅ Offline support
- ✅ Mobile-optimized UI
- ✅ Barcode scanner support

## 📁 Project Structure

```
SalesApp/
├── OneBook.html              # Main application
├── login.html              # Login page (also index.html)
├── auth.js                 # Authentication & sync logic
├── firebase-config.js      # Firebase configuration
├── service-worker.js       # PWA service worker
├── manifest.json           # PWA manifest
├── icon-192.png           # App icon (192x192)
├── icon-512.png           # App icon (512x512)
├── deploy.sh              # Deployment script
├── firebase.json          # Firebase hosting config
├── public/                # Deployed files
├── DEPLOYMENT.md          # Deployment guide
├── QUICK_START.md         # Quick start guide
└── PWA_INSTALL_GUIDE.md   # PWA installation guide
```

## 🔧 Setup & Installation

### Prerequisites
- Node.js and npm installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project created (sales-app)

### Initial Setup

1. **Clone/Download the project**
   ```bash
   cd /Users/log/Desktop/SalesApp
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Deploy to Firebase Hosting**
   ```bash
   ./deploy.sh
   ```

### Firebase Console Setup

1. **Enable Authentication:**
   - Go to Firebase Console → Authentication
   - Enable Email/Password sign-in method
   - Create user accounts under "Users" tab

2. **Enable Firestore:**
   - Go to Firestore Database
   - Create database in test mode
   - Update security rules (see below)

3. **Recommended Security Rules:**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

## 🔐 Admin Features

### Delete Sale (Password Protected)
- **Password:** `admin123` (change in `OneBook.html` line 2856)
- **Location:** Dashboard → Recent Sales → Delete button
- **Access:** Only admin with password can delete sales

### Change Admin Password
Edit `OneBook.html` line 2856:
```javascript
const ADMIN_PASSWORD = 'your-new-password'; // Change this
```

## 📱 PWA Installation

### Android
1. Visit https://sales-app.web.app
2. Tap browser menu (⋮)
3. Select "Add to Home screen"
4. Tap "Install"

### iOS
1. Visit https://sales-app.web.app in Safari
2. Tap Share button (□↑)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add"

## 🔄 Data Synchronization

### How It Works
- **Real-time sync:** Changes appear on all devices within 2-4 seconds
- **Automatic backup:** All data saved to Firebase Firestore
- **Multi-device:** Same user sees same data on all devices
- **Offline support:** Works offline, syncs when back online

### Data Storage
- **Local:** localStorage (for offline access)
- **Cloud:** Firebase Firestore (for sync & backup)
- **Structure:** Each user has separate data in `/users/{userId}/`

## 🖥️ Desktop Application (Windows .exe)

This project can be converted into a native Windows executable (`.exe`) file using Electron. 

### How to generate the Windows .exe file:
1. Ensure you have Node.js installed.
2. Open your terminal in the project folder.
3. Run `npm install` (only needed the first time) to install Electron Builder.
4. Run the build command:
   ```bash
   npm run dist -- --win
   ```
5. The compiled file will be saved in the `dist/` folder.
   - **Current Output File:** `sales-app-desktop Setup 1.7.0.exe`

### How to generate the macOS .dmg file:
1. Ensure you have Node.js installed on a Mac.
2. Run the build command:
   ```bash
   npm run dist -- --mac
   ```
3. The compiled file will be saved in the `dist/` folder.
   - **Current Output File:** `sales-app-desktop-1.7.0-arm64.dmg`

## ⌨️ Global Keyboard Shortcuts

The application is optimized for rapid POS navigation. 

**Navigation (Alt Modifiers):**
- `Alt + D` ➔ Dashboard
- `Alt + I` ➔ Inventory
- `Alt + S` ➔ Record Sale
- `Alt + R` ➔ Reports
- `Alt + P` ➔ Products
- `Alt + C` ➔ Calculator
- `Alt + N` ➔ Cash Denomination

**Action Shortcuts:**
- `Ctrl + S` ➔ Save the current record or Day Closing
- `Ctrl + F` ➔ Jump straight to the main search bar
- `Ctrl + Delete` ➔ Delete the currently selected record (Admin only)
- `Alt + X` ➔ Smart Clear: Erase current cart, calculator history, or reset form
- `Esc` ➔ Close modals or cancel actions

**Record Sale / Checkout:**
- `Alt + B` ➔ Focus Quick Sale Barcode scanner
- `Alt + A` ➔ Focus manual Product Search
- `Alt + V` ➔ Quick Add a new Inventory product
- `Enter` ➔ Automatically select the closest product match and move to the quantity field

## 🔑 Default Credentials

**Admin User:**
- **Email:** `admin@example.com`
- **Password:** `Admin@2026`
- **Features:** Full access including deleting records and configuring cost prices.

**Standard User:**
- **Email:** `user@example.com`
- **Password:** `User@123`
- **Features:** Standard POS operations, cannot delete history or manage sensitive data.

## 🚀 Deployment

### Quick Deploy
```bash
./deploy.sh
```

### Manual Deploy
```bash
# Copy files to public directory
cp OneBook.html login.html auth.js firebase-config.js service-worker.js manifest.json icon-*.png public/

# Deploy to Firebase
firebase deploy --only hosting
```

## 📊 Usage

### Adding Products
1. Go to "Product Management" tab
2. Scan or enter barcode
3. Fill in product details
4. Click "Add Product"

### Recording Sales
1. Go to "Point of Sale" tab
2. Select product or scan barcode
3. Enter quantity
4. Add to cart
5. Apply discount (optional)
6. Complete sale

### Viewing Reports
1. Go to "Reports" tab
2. Select date range
3. View charts and statistics
4. Export to CSV if needed

### Deleting Sales (Admin Only)
1. Go to "Dashboard" tab
2. Find sale in "Recent Sales"
3. Click "🗑️ Delete"
4. Enter password: `admin123`
5. Confirm deletion

## 🔍 Troubleshooting

### Cache Issues
If updates don't appear:
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Close and reopen browser

### Sync Issues
If data doesn't sync:
1. Check internet connection
2. Verify logged in with same account on all devices
3. Check browser console for errors (F12)
4. Logout and login again

### Mobile Issues
If mobile app doesn't work:
1. Clear mobile browser cache
2. Uninstall PWA and reinstall
3. Restart phone
4. Try different browser

## 📦 Backup & Restore

### Create Backup
```bash
# Create ZIP backup
cd /Users/log/Desktop
zip -r SalesApp_Backup_$(date +%Y%m%d).zip SalesApp/
```

### Restore from Backup
```bash
# Extract ZIP
unzip SalesApp_Backup_YYYYMMDD.zip

# Redeploy
cd SalesApp
./deploy.sh
```

### Data Export
- **From App:** Reports → Export to CSV
- **From Firebase:** Firestore Console → Export data

## 🔒 Security

### Current Setup
- ✅ Firebase Authentication required
- ✅ Each user has isolated data
- ✅ HTTPS encryption (Firebase Hosting)
- ✅ Password-protected admin features

### Recommendations
1. Use strong passwords for user accounts
2. Update Firestore security rules (see Setup section)
3. Change default admin password
4. Regular data backups
5. Monitor Firebase Console for unusual activity

## 📝 Important Files

### Essential Files (Must Keep)
- `OneBook.html` - Main application
- `login.html` / `index.html` - Login page
- `auth.js` - Authentication logic
- `firebase-config.js` - Firebase settings
- `service-worker.js` - PWA support
- `manifest.json` - PWA configuration
- `icon-192.png` & `icon-512.png` - App icons

### Configuration Files
- `firebase.json` - Firebase hosting config
- `deploy.sh` - Deployment script

### Documentation
- `README.md` - This file
- `DEPLOYMENT.md` - Detailed deployment guide
- `QUICK_START.md` - Quick start guide
- `PWA_INSTALL_GUIDE.md` - PWA installation guide

## 🆘 Support & Maintenance

### Common Tasks

**Update Admin Password:**
Edit `OneBook.html` line 2856

**Add New User:**
Firebase Console → Authentication → Users → Add User

**Clear All Data (Testing):**
Browser Console (F12):
```javascript
localStorage.clear();
location.reload();
```

**Force Sync:**
Browser Console (F12):
```javascript
import('./auth.js').then(m => m.syncDataToFirestore(m.getCurrentUser().uid));
```

## 📊 Firebase Free Tier Limits

- **Hosting:** 10 GB storage, 360 MB/day transfer
- **Firestore:** 1 GB storage, 50K reads/day, 20K writes/day
- **Authentication:** Unlimited users

**Your usage:** Well within free tier limits for a small shop

## 🎯 Future Enhancements

Potential features to add:
- [ ] Multiple user roles (admin, staff, viewer)
- [ ] Advanced reporting with charts
- [ ] Supplier management
- [ ] Purchase orders
- [ ] Profit/loss tracking
- [ ] Email notifications
- [ ] Backup scheduling
- [ ] Data import/export

## 📞 Quick Reference

- **Live App:** https://sales-app.web.app
- **Firebase Console:** https://console.firebase.google.com/project/sales-app
- **Admin Password:** `admin123` (change this!)
- **Deployment:** `./deploy.sh`

## ✅ System Status

- ✅ Firebase Authentication: Working
- ✅ Cloud Sync: Working
- ✅ Real-time Updates: Working
- ✅ PWA: Working
- ✅ Mobile Support: Working
- ✅ Delete Sales: Working
- ✅ Multi-device Sync: Working

---

**Last Updated:** November 25, 2025  
**Version:** 1.0  
**Project:** Sales App Inventory & Sales Management System

import re

files_to_patch = ['OneBook.html', 'final.html']

tracker_code = """
        // --- GLOBAL EVENT LISTENER LIFECYCLE ---
        window._globalEventListeners = [];
        const originalAddEventListener = document.addEventListener;
        document.addEventListener = function(type, listener, options) {
            window._globalEventListeners.push({ type, listener, options });
            return originalAddEventListener.call(document, type, listener, options);
        };
        
        const originalWindowAddEventListener = window.addEventListener;
        window.addEventListener = function(type, listener, options) {
            window._globalEventListeners.push({ type, listener, options, target: 'window' });
            return originalWindowAddEventListener.call(window, type, listener, options);
        };

        window.cleanupGlobalListeners = function() {
            window._globalEventListeners.forEach(({ type, listener, options, target }) => {
                if (target === 'window') {
                    window.removeEventListener(type, listener, options);
                } else {
                    document.removeEventListener(type, listener, options);
                }
            });
            window._globalEventListeners = [];
            
            // Also clean up any active USB scanner buffers/timers
            if (typeof usbScanTimeout !== 'undefined') clearTimeout(usbScanTimeout);
            if (typeof globalUsbScanTimeout !== 'undefined') clearTimeout(globalUsbScanTimeout);
        };
        // ---------------------------------------
"""

for filename in files_to_patch:
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            html = f.read()

        # Inject tracker right after <script> block starts
        if 'window._globalEventListeners' not in html:
            # Find first <script> after <head> or <body>
            html = html.replace("window.hasPermission = hasPermission;", tracker_code + "\n        window.hasPermission = hasPermission;")

        # Inject cleanup inside handleLogout
        old_logout = """        window.handleLogout = async function() {
            if (confirm('Are you sure you want to logout?')) {"""
        new_logout = """        window.handleLogout = async function() {
            if (confirm('Are you sure you want to logout?')) {
                if (typeof window.cleanupGlobalListeners === 'function') {
                    window.cleanupGlobalListeners();
                }"""
        html = html.replace(old_logout, new_logout)

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html)
            
    except Exception as e:
        print(f"Error patching {filename}: {e}")


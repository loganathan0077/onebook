
        // User Management Logic
        const ALL_PERMISSIONS = [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'record_sale', label: 'Record Sale' },
            { id: 'reports', label: 'Reports' },
            { id: 'products', label: 'Products' },
            { id: 'petty_cash', label: 'Petty Cash' },
            { id: 'day_closing', label: 'Day Closing' },
            { id: 'calculator', label: 'Calculator' },
            { id: 'purchase_entry', label: 'Purchase & Parties' },
            { id: 'product_add_edit', label: 'Add / Edit Product' },
            { id: 'delete', label: 'Delete' }
        ];

        function renderUserManagementTable() {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const tbody = document.getElementById('userManagementTableBody');
            if(!tbody) return;
            
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>${u.name}</td>
                    <td>${u.username}</td>
                    <td>${u.userCode || '-'}</td>
                    <td><span style="padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold; color:white; background:${u.role === 'admin' ? '#007bff' : '#6c757d'}">${u.role.toUpperCase()}</span></td>
                    <td><span style="padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold; color:white; background:${u.status === 'active' ? '#28a745' : '#dc3545'}">${u.status.toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="openEditUserModal('${u.id}')">✏️ Edit</button>
                        ${u.id !== 'admin_1' ? `
                            <button class="btn btn-sm btn-info" onclick="openChangeUserPasswordModal('${u.id}')">🔑 Pwd</button>
                            <button class="btn btn-sm btn-${u.status==='active' ? 'danger' : 'success'}" onclick="toggleUserStatus('${u.id}')">${u.status==='active' ? '🔴 Disable' : '🟢 Enable'}</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">🗑️ Del</button>
                        ` : ''}
                    </td>
                </tr>
            `).join('');
        }

        function togglePermissionsList() {
            const role = document.getElementById('addUserRole').value;
            const container = document.getElementById('permissionsGroup');
            if(role === 'admin') {
                container.style.display = 'none';
            } else {
                container.style.display = 'block';
            }
        }

        function renderPermissionsChecklist(selected = []) {
            const list = document.getElementById('permissionsChecklist');
            list.innerHTML = ALL_PERMISSIONS.map(p => `
                <label style="display:flex; align-items:center; gap:10px; font-weight:normal; margin:0; cursor:pointer;">
                    <input type="checkbox" class="user-permission-chk" value="${p.id}" style="width:18px; height:18px; cursor:pointer; flex-shrink:0; margin:0;" ${selected.includes(p.id) ? 'checked' : ''}>
                    <span style="white-space:normal; line-height:1.2;">${p.label}</span>
                </label>
            `).join('');
        }

        function openAddUserModal() {
            document.getElementById('addUserModalTitle').innerText = 'Add User';
            document.getElementById('addUserId').value = '';
            document.getElementById('addUserName').value = '';
            document.getElementById('addUserUsername').value = '';
            document.getElementById('addUserCode').value = '';
            document.getElementById('addUserPassword').value = '';
            document.getElementById('addUserPasswordGroup').style.display = 'block'; // Show for new
            document.getElementById('addUserRole').value = 'user';
            document.getElementById('addUserStatus').value = 'active';
            
            // Default conservative permissions
            renderPermissionsChecklist(['dashboard','inventory','record_sale','reports','products','petty_cash','day_closing','calculator','customer_manage','customer_ledger']);
            togglePermissionsList();
            
            document.getElementById('addUserModal').style.display = 'flex';
        }

        function openEditUserModal(id) {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.id === id);
            if(!user) return;
            
            document.getElementById('addUserModalTitle').innerText = 'Edit User';
            document.getElementById('addUserId').value = user.id;
            document.getElementById('addUserName').value = user.name;
            document.getElementById('addUserUsername').value = user.username;
            document.getElementById('addUserCode').value = user.userCode || '';
            document.getElementById('addUserPasswordGroup').style.display = 'none'; // Hide password on edit
            document.getElementById('addUserRole').value = user.role;
            document.getElementById('addUserStatus').value = user.status;
            
            renderPermissionsChecklist(user.permissions || []);
            togglePermissionsList();
            
            document.getElementById('addUserModal').style.display = 'flex';
        }

        function saveUser() {
            const id = document.getElementById('addUserId').value;
            const name = document.getElementById('addUserName').value.trim();
            const username = document.getElementById('addUserUsername').value.trim();
            const userCode = document.getElementById('addUserCode').value.trim();
            const password = document.getElementById('addUserPassword').value;
            const role = document.getElementById('addUserRole').value;
            const status = document.getElementById('addUserStatus').value;
            
            if(!name || !username) return alert('Name and Username are required.');
            if(!id && !password) return alert('Password is required for new users.');
            
            if(role === 'admin' && !confirm('⚠️ This will give the user full administrative access. Continue?')) {
                return;
            }

            const perms = [];
            document.querySelectorAll('.user-permission-chk:checked').forEach(chk => {
                perms.push(chk.value);
            });

            let users = JSON.parse(localStorage.getItem('users') || '[]');
            
            // Check username uniqueness
            if(users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== id)) {
                return alert('Username already exists!');
            }

            if(id) {
                // Update
                const user = users.find(u => u.id === id);
                if(user) {
                    user.name = name;
                    user.username = username;
                    user.userCode = userCode;
                    user.role = role;
                    user.status = status;
                    user.permissions = perms;
                }
            } else {
                // Add
                users.push({
                    id: 'usr_' + Date.now(),
                    name,
                    username,
                    userCode,
                    password,
                    role,
                    status,
                    permissions: perms
                });
            }
            
            localStorage.setItem('users', JSON.stringify(users));
            document.getElementById('addUserModal').style.display = 'none';
            renderUserManagementTable();
            showAlert('User saved successfully!', '✅');
        }

        function toggleUserStatus(id) {
            if(id === 'admin_1') return alert('Cannot disable primary admin.');
            let users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.id === id);
            if(user) {
                user.status = user.status === 'active' ? 'disabled' : 'active';
                localStorage.setItem('users', JSON.stringify(users));
                renderUserManagementTable();
            }
        }

        function deleteUser(id) {
            if(id === 'admin_1') return alert('Cannot delete primary admin.');
            if(confirm('Are you sure you want to delete this user?')) {
                let users = JSON.parse(localStorage.getItem('users') || '[]');
                users = users.filter(u => u.id !== id);
                localStorage.setItem('users', JSON.stringify(users));
                renderUserManagementTable();
            }
        }

        function openChangeUserPasswordModal(id) {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.id === id);
            if(!user) return;
            
            document.getElementById('changePwdUserId').value = id;
            document.getElementById('changePwdUsername').innerText = user.username;
            document.getElementById('changePwdNew').value = '';
            document.getElementById('changePwdConfirm').value = '';
            document.getElementById('changeUserPasswordModal').style.display = 'flex';
        }

        function saveUserPassword() {
            const id = document.getElementById('changePwdUserId').value;
            const pwd = document.getElementById('changePwdNew').value;
            const confirmPwd = document.getElementById('changePwdConfirm').value;
            
            if(!pwd) return alert('Password cannot be empty.');
            if(pwd !== confirmPwd) return alert('Passwords do not match.');
            
            let users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.id === id);
            if(user) {
                user.password = pwd;
                localStorage.setItem('users', JSON.stringify(users));
                document.getElementById('changeUserPasswordModal').style.display = 'none';
                showAlert('Password changed successfully!', '✅');
            }
        }

        // Settings Module Logic
        function getDefaultSettings() {
            return {
                businessName: 'Business Name',
                tagline: 'Inventory & Sales System',
                logoData: null,
                mobile: '',
                email: '',
                website: '',
                address: '',
                gstin: '',
                receiptSize: '80mm',
                autoPrint: false,
                footerMsg: 'Thank you for your purchase!',
                showCustomer: true,
                showDiscount: true,
                showPayment: true,
                gstEnabled: false,
                businessState: '',
                taxPricingMode: 'exclusive',
                defaultTaxType: 'auto',
                showGST: false,
                usbScannerEnabled: false,
                quickSaleBarcode: true,
                showBarcode: false,
                adminPassword: 'Admin@2026',
                // Label Printing Settings
                labelPreset: 'pen',
                labelWidth: 50,
                labelHeight: 30,
                labelGapX: 2,
                labelGapY: 2,
                labelMarginTop: 2,
                labelMarginRight: 2,
                labelMarginBottom: 2,
                labelMarginLeft: 2,
                labelFontSize: 10,
                labelFontBold: true,
                labelAlignment: 'center',
                labelBarcodeSize: 'medium',
                labelShowBusinessName: true,
                labelShowMonthCode: false,
                labelShowMRP: true,
                labelShowExpiry: false,
                labelShowMfgDate: false,
                labelShowBarcode: true,
                labelMonthCodes: {
                    0: '@', 1: '!', 2: '$', 3: '^', 4: '&', 5: '*',
                    6: '#', 7: '%', 8: '+', 9: '=', 10: '~', 11: '?'
                },
                // Invoice Numbering Settings
                invoicePrefix: 'INV',
                invoiceNextNumber: 1,
                invoiceSeparator: '-',
                invoiceCustomSeparator: '',
                invoiceYear: new Date().getFullYear().toString(),
                invoicePadding: '4'
            };
        }

        // Initialize data structure
        let products = JSON.parse(localStorage.getItem('products')) || [];

        // --- Product Variant Helper Functions ---
        window.hasVariants = function(product) {
            return product && Array.isArray(product.variants) && product.variants.length > 0;
        };
        
        window.getProductVariants = function(product) {
            if (window.hasVariants(product)) {
                return product.variants;
            }
            return [];
        };
        
        window.getVariantById = function(product, variantId) {
            if (window.hasVariants(product)) {
                return product.variants.find(v => String(v.id) === String(variantId)) || null;
            }
            return null;
        };
        
        window.getVariantDisplayName = function(product, variant) {
            if (!product) return 'Unknown Product';
            if (variant && variant.variantName) {
                return `${product.name} - ${variant.variantName}`;
            }
            return product.name || 'Unknown Product';
        };

        let calculatorHistory = JSON.parse(localStorage.getItem('calculatorHistory')) || [];
        let dayClosings = JSON.parse(localStorage.getItem('dayClosings')) || [];
        let sales = JSON.parse(localStorage.getItem('sales')) || [];
        let isDataLoaded = false;
        let stockHistory = JSON.parse(localStorage.getItem('stockHistory')) || [];
        let purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders')) || [];
        let categoryDiscounts = JSON.parse(localStorage.getItem('categoryDiscounts')) || [];
        let draftSales = JSON.parse(localStorage.getItem('draftSales')) || []; // Initialize drafts
        let modalScanner = null;
        let currentScanMode = '';
        let cart = []; // Shopping cart for multi-item sales
        let currentEditingProductId = null;
        let lastSaleData = null; // Store last sale for receipt
        let negativeChangeCount = parseInt(localStorage.getItem('negativeChangeCount')) || 0;

        // Purchase Feature Globals
        let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
        let purchaseCart = [];
        let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
        
        // One-time migration for legacy purchases without supplierId
        if (suppliers.length === 0 && purchases.length > 0) {
            const uniqueSupplierNames = new Set();
            purchases.forEach(p => {
                if (p.supplier && p.supplier.trim() !== '') uniqueSupplierNames.add(p.supplier.trim());
            });
            uniqueSupplierNames.forEach(name => {
                const legacyPurchase = purchases.find(p => p.supplier === name);
                const newId = 'sup_' + Date.now() + Math.random().toString(36).substr(2, 5);
                suppliers.push({
                    id: newId,
                    name: name.toUpperCase(),
                    phone: legacyPurchase ? legacyPurchase.supplierPhone || '' : '',
                    address: legacyPurchase ? legacyPurchase.supplierAddress || '' : '',
                    state: '',
                    country: 'INDIA',
                    notes: ''
                });
                
                // Update purchases to point to new ID
                purchases.forEach(p => {
                    if (p.supplier === name) {
                        p.supplierId = newId;
                        p.supplier = name.toUpperCase();
                    }
                });
            });
            localStorage.setItem('suppliers', JSON.stringify(suppliers));
            localStorage.setItem('purchases', JSON.stringify(purchases));
        }
        // Master Data for Categories and Units
        let customers = JSON.parse(localStorage.getItem('customers')) || [];
        
        // One-time migration for legacy sales without customerId
        if (customers.length === 0 && sales.length > 0) {
            const uniqueCustomerNames = new Set();
            sales.forEach(s => {
                if (s.customerName && s.customerName.trim() !== '' && s.customerName.toUpperCase() !== 'WALK-IN CUSTOMER') {
                    uniqueCustomerNames.add(s.customerName.trim());
                }
            });
            uniqueCustomerNames.forEach(name => {
                const legacySale = sales.find(s => s.customerName === name);
                const newId = 'cus_' + Date.now() + Math.random().toString(36).substr(2, 5);
                customers.push({
                    id: newId,
                    name: name.toUpperCase(),
                    phone: legacySale ? legacySale.customerPhone || '' : '',
                    gstin: '',
                    address: legacySale ? legacySale.customerAddress || '' : '',
                    state: '',
                    country: 'INDIA',
                    notes: ''
                });
                
                // Update sales to point to new ID
                sales.forEach(s => {
                    if (s.customerName === name) {
                        s.customerId = newId;
                        s.customerName = name.toUpperCase();
                        s.customerType = 'existing';
                    }
                });
            });
            
            // Mark others as walk-in explicitly if not already
            sales.forEach(s => {
                if (!s.customerId) {
                    s.customerType = 'walk-in';
                    s.customerName = s.customerName || 'WALK-IN CUSTOMER';
                }
            });
            
            localStorage.setItem('customers', JSON.stringify(customers));
            localStorage.setItem('sales', JSON.stringify(sales));
                if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();
        }

        let masterCategories = JSON.parse(localStorage.getItem('masterCategories')) || [];
        if (masterCategories.length === 0) {
            const defaultCategories = ['Stationery', 'Office Supplies', 'Grocery', 'Food & Beverages', 'Electronics', 'Electrical', 'Hardware', 'Garments', 'Cosmetics', 'Household', 'Toys', 'Books', 'Furniture', 'General', 'Other'];
            masterCategories = defaultCategories.map(name => ({ id: 'cat_' + Math.random().toString(36).substr(2, 9), name: name, active: true }));
            localStorage.setItem('masterCategories', JSON.stringify(masterCategories));
        }

        let masterUnits = JSON.parse(localStorage.getItem('masterUnits')) || [];
        if (masterUnits.length === 0) {
            const defaultUnits = ['Piece', 'Box', 'Pack', 'Set', 'Pair', 'Kg', 'Gram', 'Litre', 'ml', 'Meter', 'Feet', 'Dozen', 'Carton', 'Bundle', 'Roll', 'Bottle', 'Other'];
            masterUnits = defaultUnits.map(name => ({ id: 'unit_' + Math.random().toString(36).substr(2, 9), name: name, active: true }));
            localStorage.setItem('masterUnits', JSON.stringify(masterUnits));
        }

        // Global function to reload data from LocalStorage (invoked by Realtime Sync)
        window.reloadAppData = function () {
            console.log('🔄 Reloading App Data from Storage...');
            products = JSON.parse(localStorage.getItem('products')) || [];
            sales = JSON.parse(localStorage.getItem('sales')) || [];
            stockHistory = JSON.parse(localStorage.getItem('stockHistory')) || [];
            purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders')) || [];
            draftSales = JSON.parse(localStorage.getItem('draftSales')) || [];
            purchases = JSON.parse(localStorage.getItem('purchases')) || [];
            negativeChangeCount = parseInt(localStorage.getItem('negativeChangeCount')) || 0;
            calculatorHistory = JSON.parse(localStorage.getItem('calculatorHistory')) || [];
            dayClosings = JSON.parse(localStorage.getItem('dayClosings')) || [];
            suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
            customers = JSON.parse(localStorage.getItem('customers')) || [];
            masterCategories = JSON.parse(localStorage.getItem('masterCategories')) || masterCategories;
            masterUnits = JSON.parse(localStorage.getItem('masterUnits')) || masterUnits;

            // Refresh dependent UI
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof updateInventoryTable === 'function') updateInventoryTable();
            if (typeof updateTodaysSales === 'function') updateTodaysSales(); // Updates daily sales list
            if (typeof populateProductSelect === 'function') {
                populateSaleProductSelect();
            }
        };
        let selectedPurchaseProduct = null;
        let purchaseSearchHighlightIndex = -1;

        // Function to update UI based on user role
        // Function to update UI based on user role
        function updateUIForRole() {
            // Clear both classes first
            document.body.classList.remove('admin-user', 'sales-user');

            if (window.isUserAdmin) {
                console.log('✅ Admin user - showing all buttons');
                document.body.classList.add('admin-user');
            } else {
                console.log('👤 Sales user - hiding admin buttons');
                document.body.classList.add('sales-user');
            }

            // Hide unauthorized sidebar tabs
            const tabPermissionMap = {
                'dashboard': 'dashboard',
                'inventory': 'inventory',
                'sales': 'record_sale',
                'reports': 'reports',
                'products': 'products',
                'pettycash': 'petty_cash',
                'denomination': 'day_closing',
                'calculator': 'calculator',
                'purchaseparties': 'purchase_entry' // Assuming purchase_entry implies access
            };

            let firstAllowedTab = null;
            document.querySelectorAll('.nav-tab').forEach(nav => {
                const tabId = nav.dataset.tab;
                
                if (tabId === 'settings') {
                    nav.style.display = window.isUserAdmin ? 'block' : 'none';
                    if (window.isUserAdmin && !firstAllowedTab) firstAllowedTab = tabId;
                    return;
                }
                
                const requiredPerm = tabPermissionMap[tabId];
                if (requiredPerm && window.hasPermission && !window.hasPermission(requiredPerm) && !window.isUserAdmin) {
                    nav.style.display = 'none';
                } else {
                    nav.style.display = 'block';
                    if (!firstAllowedTab) firstAllowedTab = tabId;
                }
            });

            // Enforce current tab
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab && activeTab.style.display === 'none' && firstAllowedTab) {
                switchTab(firstAllowedTab);
            }
        }
        // Track count of negative changes

        // ... (existing helper functions) ...

        // Draft Sales Functions
        function holdSale() {
            if (cart.length === 0) {
                showAlert('Cart is empty. Nothing to hold.', '⚠️');
                return;
            }

            let customerName = 'Walk-in Customer';
            const customerId = document.getElementById('activeCustomerId') ? document.getElementById('activeCustomerId').value : '';
            if (customerId) {
                customerName = document.getElementById('displayCustomerName').innerText || 'Walk-in Customer';
            } else if (document.getElementById('saleCustomerSearch')) {
                customerName = document.getElementById('saleCustomerSearch').value || 'Walk-in Customer';
            }

            const draft = {
                id: Date.now(),
                date: new Date().toISOString(),
                cart: [...cart],
                customerName: customerName,
                discount: parseFloat(document.getElementById('discountAmount').value) || 0,
                paymentMethod: document.getElementById('paymentMethod') ? document.getElementById('paymentMethod').value : 'Cash Only'
            };

            draftSales.push(draft);
            localStorage.setItem('draftSales', JSON.stringify(draftSales));
            

            // Clear current cart
            cart = [];
            document.getElementById('addItemForm').reset();
            
            if (typeof clearCustomerSelection === 'function') clearCustomerSelection();
            if (document.getElementById('saleCustomerSearch')) document.getElementById('saleCustomerSearch').value = '';
            
            if (document.getElementById('otherPaymentAmount')) document.getElementById('otherPaymentAmount').value = '0';
            if (document.getElementById('changeAmount')) document.getElementById('changeAmount').value = '';
            if (document.getElementById('discountAmount')) document.getElementById('discountAmount').value = '0';
            
            updateCartDisplay();
            updateDraftsDisplay();

            showAlert('Sale put on hold!', '✅');
        }

        function clearCart() {
            if (cart.length === 0) {
                showAlert('Cart is already empty!', 'ℹ️');
                return;
            }

            showConfirm('Are you sure you want to clear the cart?', () => {
                console.log('Clearing cart...');
                cart = [];
                document.getElementById('addItemForm').reset();
                if(typeof clearCustomerSelection === 'function') clearCustomerSelection();
                if(document.getElementById('customerName')) document.getElementById('customerName').value = '';
                
                document.getElementById('otherPaymentAmount').value = '0';
                document.getElementById('discountAmount').value = '0';
                document.getElementById('courierCharges').value = '0';
                document.getElementById('paymentMethod').value = 'cash';
                
                updateCartDisplay();
                if (typeof togglePaymentFields === 'function') togglePaymentFields();
                
                document.getElementById('customerAmount').value = '';
                document.getElementById('changeAmount').value = '';
                document.getElementById('creditAmountPaid').value = '0';
                document.getElementById('creditOutstanding').value = '0';
                document.getElementById('creditPaymentMethod').value = 'cash';
                document.getElementById('creditDueDate').value = '';
                console.log('Cart cleared successfully');
                if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();
                showAlert('Cart cleared successfully!', '✅');
            });
        }

        function updateDraftsDisplay() {
            const container = document.getElementById('draftSalesSection');
            const list = document.getElementById('draftSalesList');

            if (draftSales.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            list.innerHTML = draftSales.map((draft, index) => {
                const total = draft.cart.reduce((sum, item) => sum + item.total, 0) - draft.discount;
                const itemCount = draft.cart.reduce((sum, item) => sum + item.quantity, 0);
                const time = new Date(draft.date).toLocaleTimeString();

                return `
                    <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${draft.customerName}</strong> <span style="color: #6c757d; font-size: 0.9em;">(${time})</span><br>
                            <span style="font-size: 0.9em;">${itemCount} items | Total: ₹${total.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-sm btn-primary" onclick="resumeDraft(${index})">▶️ Resume</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteDraft(${index})">✖️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function resumeDraft(index) {
            const proceed = () => {
                const draft = draftSales[index];

                // Restore cart and form
                cart = [...draft.cart];
                const searchInput = document.getElementById('saleCustomerSearch');
                if (searchInput) {
                    searchInput.value = draft.customerName === 'Walk-in Customer' ? '' : draft.customerName;
                }
                document.getElementById('discountAmount').value = draft.discount;
                document.getElementById('paymentMethod').value = draft.paymentMethod;

                // Remove from drafts
                draftSales.splice(index, 1);
                localStorage.setItem('draftSales', JSON.stringify(draftSales));
                

                updateCartDisplay();
                updateDraftsDisplay();
                togglePaymentFields(); // Restore payment fields visibility
            };

            if (cart.length > 0) {
                showConfirm('Current cart is not empty. Overwrite with draft?', proceed);
            } else {
                proceed();
            }
        }

        function deleteDraft(index) {
            if (!window.isUserAdmin) return showAlert('Unauthorized: Only Administrators can delete data.', 'error');
            showConfirm('Delete this draft sale?', () => {
                draftSales.splice(index, 1);
                localStorage.setItem('draftSales', JSON.stringify(draftSales));
                
                updateDraftsDisplay();
            });
        }

        // Call this on init to show any saved drafts
        // (Add this call to the end of the script or inside an init function if one exists, 
        // but for now I'll rely on the user reloading or switching tabs to trigger updates if I hook it right.
        // Actually, I should add a call to updateDraftsDisplay() at the end of the script or in switchTab('sales'))


        function formatDateLocal(dateInput) {
            const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
            if (Number.isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function getStartOfDay(dateInput) {
            const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
            date.setHours(0, 0, 0, 0);
            return date;
        }

        function getEndOfDay(dateInput) {
            const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
            date.setHours(23, 59, 59, 999);
            return date;
        }

        function parseDateKey(dateKey) {
            if (!dateKey) return new Date(NaN);
            const parts = dateKey.split('-').map(part => parseInt(part, 10));
            const [year, month, day] = parts;
            return new Date(year || 0, (month ? month - 1 : 0), day || 1);
        }

        // Initialize sample data if empty with barcodes
        if (products.length === 0) {
            products = [
                {
                    id: 1,
                    barcode: "8901030865278",
                    name: "Blue Ballpoint Pen",
                    category: "Pens",
                    price: 10,
                    stock: 100,
                    minStock: 20,
                    supplier: "ABC Suppliers",
                    description: "Smooth writing blue ink pen"
                },
                {
                    id: 2,
                    barcode: "8901030865285",
                    name: "HB Pencil",
                    category: "Pencils",
                    price: 5,
                    stock: 150,
                    minStock: 30,
                    supplier: "XYZ Trading",
                    description: "Standard HB graphite pencil"
                },
                {
                    id: 3,
                    barcode: "8901030865292",
                    name: "A4 Notebook (100 pages)",
                    category: "Notebooks",
                    price: 40,
                    stock: 50,
                    minStock: 10,
                    supplier: "Paper World",
                    description: "Ruled notebook, 100 pages"
                },
                {
                    id: 4,
                    barcode: "8901030865308",
                    name: "Highlighter Set (4 colors)",
                    category: "Art",
                    price: 80,
                    stock: 25,
                    minStock: 5,
                    supplier: "Art Supplies Co",
                    description: "Fluorescent highlighter set"
                },
                {
                    id: 5,
                    barcode: "8901030865315",
                    name: "Stapler",
                    category: "Office",
                    price: 120,
                    stock: 15,
                    minStock: 5,
                    supplier: "Office Mart",
                    description: "Heavy duty stapler"
                }
            ];
            setTimeout(() => saveData(), 0);
        }

        function saveData() {
            localStorage.setItem('products', JSON.stringify(products));
            localStorage.setItem('sales', JSON.stringify(sales));
                if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();
            localStorage.setItem('stockHistory', JSON.stringify(stockHistory));
            localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));
            localStorage.setItem('purchases', JSON.stringify(purchases));
            localStorage.setItem('suppliers', JSON.stringify(suppliers));
            localStorage.setItem('customers', JSON.stringify(customers));
            localStorage.setItem('calculatorHistory', JSON.stringify(calculatorHistory));
            localStorage.setItem('dayClosings', JSON.stringify(dayClosings));

            // Refresh UI immediately
            updateDashboard();
            updateInventoryTable();

            // UI Feedback: Immediately show "Saved Locally"
            if (window.updateSyncStatus) window.updateSyncStatus('offline', 'Saved to Device');

            
        }

        // Backup and Restore Functions
        function backupData() {
            const backupData = {
                backupDate: new Date().toISOString(),
                backupVersion: '1.0',
                products: products,
                sales: sales,
                stockHistory: stockHistory,
                draftSales: draftSales,
                purchases: purchases,
                purchaseOrders: purchaseOrders,
                suppliers: suppliers,
                customers: customers,
                calculatorHistory: calculatorHistory,
                dayClosings: dayClosings,
                customCategories: JSON.parse(localStorage.getItem('customCategories')) || [],
                categoryDiscounts: JSON.parse(localStorage.getItem('categoryDiscounts')) || [],
                receiptCounters: JSON.parse(localStorage.getItem('receiptCounters')) || {},
                negativeChangeCount: negativeChangeCount,
                settings: JSON.parse(localStorage.getItem('settings')) || null,
                users: JSON.parse(localStorage.getItem('users')) || [],
                partyPayments: JSON.parse(localStorage.getItem('partyPayments')) || [],
                masterCategories: JSON.parse(localStorage.getItem('masterCategories')) || [],
                masterUnits: JSON.parse(localStorage.getItem('masterUnits')) || [],
                pettyCashTransactions: JSON.parse(localStorage.getItem('pettyCashTransactions') || '[]'),
                pettyCashOpening: JSON.parse(localStorage.getItem('pettyCashOpening') || '{"cash":0,"bank":0}'),
                pettyCashCategories: JSON.parse(localStorage.getItem('pettyCashCategories') || 'null')
            };

            const jsonString = JSON.stringify(backupData, null, 2);
            
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
            const filename = `OneBook_Backup_${dateStr}_${timeStr}.json`;

            if (window.electronAPI) {
                const folder = localStorage.getItem('database_folder');
                if (folder) {
                    const result = window.electronAPI.createBackupSync({ folder, filename, data: jsonString });
                    if (result && result.success) {
                        showAlert('✅ Backup saved successfully to:<br>' + result.filePath, '💾');
                    } else {
                        showAlert('❌ Backup failed:<br>' + (result ? result.error : 'Unknown error'), '⚠️');
                    }
                } else {
                    showAlert('❌ Backup failed:<br>No database folder selected.', '⚠️');
                }
            } else {
                // Fallback for non-Electron
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showAlert('✅ Backup downloaded successfully!<br>File: ' + filename, '💾');
            }
        }

        function restoreData(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Confirm before restoring
            showConfirm('⚠️ Restore Data?<br><br>This will replace ALL current data with the backup.<br>Current data will be lost!<br><br>Are you sure?',
                function () {
                    const reader = new FileReader();

                    reader.onload = function (e) {
                        try {
                            const backupData = JSON.parse(e.target.result);

                            // Validate backup data
                            if (!backupData.products || !backupData.sales) {
                                showAlert('❌ Invalid backup file!<br>Missing required data.', '⚠️');
                                return;
                            }

                            // Restore data
                            products = backupData.products || [];
                            sales = backupData.sales || [];
                            stockHistory = backupData.stockHistory || [];
                            draftSales = backupData.draftSales || [];
                            purchases = backupData.purchases || [];
                            purchaseOrders = backupData.purchaseOrders || [];
                            suppliers = backupData.suppliers || [];
                            customers = backupData.customers || [];
                            negativeChangeCount = backupData.negativeChangeCount || 0;

                            // Restore to localStorage
                            localStorage.setItem('products', JSON.stringify(products));
                            localStorage.setItem('sales', JSON.stringify(sales));
                if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();
                            localStorage.setItem('stockHistory', JSON.stringify(stockHistory));
                            localStorage.setItem('draftSales', JSON.stringify(draftSales));
                            localStorage.setItem('purchases', JSON.stringify(purchases));
                            localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));
                            localStorage.setItem('suppliers', JSON.stringify(suppliers));
                            localStorage.setItem('customers', JSON.stringify(customers));
                            
                            calculatorHistory = backupData.calculatorHistory || [];
                            dayClosings = backupData.dayClosings || [];
                            localStorage.setItem('calculatorHistory', JSON.stringify(calculatorHistory));
                            localStorage.setItem('dayClosings', JSON.stringify(dayClosings));
                            
                            localStorage.setItem('customCategories', JSON.stringify(backupData.customCategories || []));
                            localStorage.setItem('categoryDiscounts', JSON.stringify(backupData.categoryDiscounts || []));
                            localStorage.setItem('receiptCounters', JSON.stringify(backupData.receiptCounters || {}));
                            localStorage.setItem('negativeChangeCount', negativeChangeCount.toString());

                            if (backupData.settings) {
                                localStorage.setItem('settings', JSON.stringify(backupData.settings));
                                if (typeof applySettingsToUI === 'function') {
                                    applySettingsToUI(backupData.settings);
                                }
                            }
                            if (backupData.pettyCashTransactions) localStorage.setItem('pettyCashTransactions', JSON.stringify(backupData.pettyCashTransactions));
                            if (backupData.pettyCashOpening) localStorage.setItem('pettyCashOpening', JSON.stringify(backupData.pettyCashOpening));
                            if (backupData.pettyCashCategories) localStorage.setItem('pettyCashCategories', JSON.stringify(backupData.pettyCashCategories));

                            // Firebase sync removed

                            // Refresh all UI
                            updateDashboard();
                            updateInventoryTable();
                            updateProductsTable();
                            updateTodaysSales();

                            const backupDate = new Date(backupData.backupDate).toLocaleString();
                            showAlert(`✅ Data restored successfully!<br><br>Backup from: ${backupDate}<br>Products: ${products.length}<br>Sales: ${sales.length}`, '📤');

                        } catch (error) {
                            console.error('Restore error:', error);
                            showAlert('❌ Failed to restore backup!<br>Invalid file format.', '⚠️');
                        }
                    };

                    reader.readAsText(file);
                }
            );

            // Reset file input
            event.target.value = '';
        }

        // ==================== PURCHASE SECTION LOGIC ====================

        // --- Purchase Logic ---
        function togglePurchaseBillElements(show) {
            const display = show ? '' : 'none';
            const displayFlex = show ? 'flex' : 'none';
            
            const idsToToggle = [
                'purchaseBillFormGrid',
                'purchaseBillTableArea',
                'purchaseBillItemCount',
                'purchaseBillActions',
                'purchasePaymentSection'
            ];
            idsToToggle.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = display;
            });

            const header = document.getElementById('purchaseFindProductHeader');
            if (header) header.style.display = displayFlex;
        }

        function openPurchaseModal() {
            window.isAddingFromSale = false;
            document.getElementById('purchaseModal').style.display = 'flex';
            cancelPurchaseSelection(); // explicitly hide and reset product selection

            togglePurchaseBillElements(true);
            const titleEl = document.querySelector('#purchaseModal h2');
            if (titleEl) titleEl.innerHTML = '🛍️ Purchase / Supplier Bill';
            hidePurchaseAddNewProductForm();

            // Initialize Date
            if (!document.getElementById('purchaseDate').value) {
                document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
            }
            setTimeout(() => {
                const pDate = document.getElementById('purchaseDate');
                if (pDate) {
                    pDate.focus();
                    pDate.select();
                }
            }, 50);

            // Invoice Number remains empty until manually auto-generated

            // Clear other fields
            document.getElementById('purchaseSupplier').value = '';
            const phoneEl = document.getElementById('purchaseSupplierPhone');
            if (phoneEl) phoneEl.value = '';
            const addrEl = document.getElementById('purchaseSupplierAddress');
            if (addrEl) addrEl.value = '';

            const notesEl = document.getElementById('purchaseNotes');
            if (notesEl) notesEl.value = '';
            purchaseCart = [];
            updatePurchaseTable();

            // Populate Supplier Suggestions
            refreshSupplierDatalist();
        }


        function togglePurchasePaymentFields() {
            const method = document.getElementById('purchasePaymentMethod').value;
            const group = document.getElementById('purchaseCreditPaymentGroup');
            if (method === 'credit') {
                group.style.display = 'block';
                calculatePurchaseOutstanding();
            } else {
                group.style.display = 'none';
                document.getElementById('purchaseCreditAmountPaid').value = '0';
                document.getElementById('purchaseCreditOutstanding').value = '0';
            }
        }

        function calculatePurchaseOutstanding() {
            const total = parseFloat(document.getElementById('purchaseTotalValue').textContent) || 0;
            const paid = parseFloat(document.getElementById('purchaseCreditAmountPaid').value) || 0;
            const outstanding = total - paid;
            document.getElementById('purchaseCreditOutstanding').value = outstanding > 0 ? outstanding.toFixed(2) : '0.00';
        }

        function closePurchaseModal() {
            document.getElementById('purchaseModal').style.display = 'none';
        }

        // Search Product for Purchase
        
        function handlePurchaseSearchKeydown(event) {
            const resultsDiv = document.getElementById('purchaseSearchResults');
            if (resultsDiv.style.display === 'none' || resultsDiv.innerHTML.trim() === '') return;
            
            const items = resultsDiv.querySelectorAll('.search-result-item');
            if (items.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                purchaseSearchHighlightIndex++;
                if (purchaseSearchHighlightIndex >= items.length) purchaseSearchHighlightIndex = 0;
                updatePurchaseSearchHighlight(items);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                purchaseSearchHighlightIndex--;
                if (purchaseSearchHighlightIndex < 0) purchaseSearchHighlightIndex = items.length - 1;
                updatePurchaseSearchHighlight(items);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                if (purchaseSearchHighlightIndex >= 0 && purchaseSearchHighlightIndex < items.length) {
                    items[purchaseSearchHighlightIndex].click();
                } else {
                    items[0].click(); // Select first by default
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                resultsDiv.style.display = 'none';
            }
        }

        function updatePurchaseSearchHighlight(items) {
            items.forEach(item => item.classList.remove('highlighted'));
            if (purchaseSearchHighlightIndex >= 0 && purchaseSearchHighlightIndex < items.length) {
                const activeItem = items[purchaseSearchHighlightIndex];
                activeItem.classList.add('highlighted');
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }

        function handlePurchaseFieldKeydown(event, nextFieldId) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (nextFieldId === 'addBtn') {
                    addPurchaseItem();
                } else {
                    const nextEl = document.getElementById(nextFieldId);
                    if (nextEl) {
                        nextEl.focus();
                        if(nextEl.select) nextEl.select();
                    }
                }
            }
        }

        function searchPurchaseProduct(query) {
            if (typeof purchaseProductSelectedIndex !== 'undefined') purchaseProductSelectedIndex = -1;
            const resultsDiv = document.getElementById('purchaseSearchResults');
            if (!query) {
                resultsDiv.style.display = 'none';
                return;
            }
            const matches = searchProductsUnified(query, products).slice(0, 10);

            if (matches.length === 0) {
                resultsDiv.style.display = 'none';
                return;
            }
            
            let displayItems = [];
            matches.forEach(p => {
                if (window.hasVariants(p)) {
                    p.variants.forEach(v => {
                        displayItems.push({
                            parent: p,
                            variant: v,
                            displayName: window.getVariantDisplayName(p, v),
                            barcode: v.barcode,
                            stock: v.stock
                        });
                    });
                } else {
                    displayItems.push({
                        parent: p,
                        variant: null,
                        displayName: p.name,
                        barcode: p.barcode,
                        stock: p.stock
                    });
                }
            });
            displayItems = displayItems.slice(0, 15);
            
            purchaseSearchHighlightIndex = -1;
            resultsDiv.innerHTML = displayItems.map((item, index) => {
                const varParam = item.variant ? `'${item.variant.id}'` : 'null';
                return `
                <div class="search-result-item" id="ps-result-${index}" onclick="selectPurchaseProduct('${item.parent.id}', ${varParam})">
                    <strong>${item.displayName}</strong><br>
                    <small>Barcode: ${item.barcode || '-'} | Stock: ${item.stock}</small>
                </div>
                `;
            }).join('');
            resultsDiv.style.display = 'block';
        }

        // Select Product
        function selectPurchaseProduct(id, variantId = null) {
            const parent = products.find(p => String(p.id) === String(id));
            if (!parent) return;
            
            let variant = null;
            if (variantId) {
                variant = window.getVariantById(parent, variantId);
            }
            
            selectedPurchaseProduct = parent;
            window.selectedPurchaseVariant = variant;
            
            document.getElementById('purchaseProductName').textContent = window.getVariantDisplayName(parent, variant);
            document.getElementById('purchaseCurrentStock').textContent = variant ? (variant.stock || 0) : (parent.stock || 0);
            
            document.getElementById('purchaseSelectedProduct').style.display = 'flex';
            document.getElementById('purchaseSearchResults').style.display = 'none';
            document.getElementById('purchaseSearchInput').value = ''; // Clear search
            document.getElementById('purchaseQty').value = 1;
            
            // Default to Cost Price / Buy Price
            document.getElementById('purchaseItemPrice').value = variant ? (variant.buyingPrice || 0) : (parent.costPrice || 0);
            
            const gstInput = document.getElementById('purchaseItemGST');
            if (gstInput) gstInput.value = parent.gstRate || 0;
            
            document.getElementById('purchaseQty').focus();
        }

        // Add to Cart
        function addPurchaseItem() {
            if (!selectedPurchaseProduct) return;
            const qty = parseFloat(document.getElementById('purchaseQty').value);
            const price = parseFloat(document.getElementById('purchaseItemPrice').value) || 0;
            const gstEl = document.getElementById('purchaseItemGST');
            const gstRate = gstEl ? (parseFloat(gstEl.value) || 0) : (selectedPurchaseProduct.gstRate || 0);

            if (isNaN(qty) || qty <= 0) return;
            
            // Validate step for decimals
            if (selectedPurchaseProduct.quantityType === 'decimal') {
                const prec = selectedPurchaseProduct.decimalPrecision || 0.01;
                const multiplier = Math.round(1 / prec);
                if (Math.abs((qty * multiplier) % 1) > 0.001) {
                    showAlert(`Enter a valid quantity. This product allows quantities in steps of ${prec}.`, '⚠️');
                    return;
                }
            } else {
                if (!Number.isInteger(qty)) {
                    showAlert(`This product requires a whole number quantity.`, '⚠️');
                    return;
                }
            }

            const existing = purchaseCart.find(i => 
                String(i.productId) === String(selectedPurchaseProduct.id) && 
                String(i.variantId) === String(window.selectedPurchaseVariant ? window.selectedPurchaseVariant.id : 'undefined')
            );
            
            if (existing) {
                existing.qty += qty;
                existing.price = price;
                existing.gstRate = gstRate;
                existing.total = existing.qty * price;
            } else {
                purchaseCart.push({
                    productId: selectedPurchaseProduct.id,
                    variantId: window.selectedPurchaseVariant ? window.selectedPurchaseVariant.id : undefined,
                    variantName: window.selectedPurchaseVariant ? window.selectedPurchaseVariant.variantName : undefined,
                    barcode: window.selectedPurchaseVariant ? window.selectedPurchaseVariant.barcode : selectedPurchaseProduct.barcode,
                    name: window.getVariantDisplayName(selectedPurchaseProduct, window.selectedPurchaseVariant),
                    qty: qty,
                    price: price,
                    total: qty * price,
                    gstRate: gstRate,
                    hsn: selectedPurchaseProduct.hsn || ''
                });
            }

            updatePurchaseTable();
            document.getElementById('purchaseSelectedProduct').style.display = 'none';
            selectedPurchaseProduct = null;
            
            const searchInput = document.getElementById('purchaseSearchInput');
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 50);
            }
        }


        function adjustPurchaseQty(delta) {
            const qtyInput = document.getElementById('purchaseQty');
            let currentVal = parseInt(qtyInput.value) || 0;
            let newVal = currentVal + delta;
            if (newVal < 1) newVal = 1;
            qtyInput.value = newVal;
        }

        function cancelPurchaseSelection() {
            document.getElementById('purchaseSelectedProduct').style.display = 'none';
            selectedPurchaseProduct = null;
            document.getElementById('purchaseSearchInput').value = '';
        }

        function updatePurchaseItemQty(index, newQty) {
            const qty = parseInt(newQty);
            if (qty < 1) {
                alert('Quantity must be at least 1');
                updatePurchaseTable(); // Revert to valid state
                return;
            }
            const item = purchaseCart[index];
            item.qty = qty;
            item.total = item.qty * item.price;
            updatePurchaseTable();
        }

        function updatePurchaseTable() {
            const tbody = document.getElementById('purchaseTableBody');
            
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const gstEnabled = settings.gstEnabled === true;
            
            const taxTypeEl = document.getElementById('purchaseTaxType');
            let taxTypeInput = taxTypeEl ? taxTypeEl.value : 'auto';
            
            let taxType = taxTypeInput;
            if (taxType === 'auto') {
                taxType = 'intra'; // Default to intra if auto, since supplier state is removed
            }

            const thCGST = document.getElementById('th-purchase-cgst');
            const thSGST = document.getElementById('th-purchase-sgst');
            const thIGST = document.getElementById('th-purchase-igst');
            if (thCGST) thCGST.style.display = (gstEnabled && taxType !== 'inter') ? 'table-cell' : 'none';
            if (thSGST) thSGST.style.display = (gstEnabled && taxType !== 'inter') ? 'table-cell' : 'none';
            if (thIGST) thIGST.style.display = (gstEnabled && taxType === 'inter') ? 'table-cell' : 'none';
            
            let subtotal = 0;
            let totalTaxableValue = 0;
            let totalCGST = 0;
            let totalSGST = 0;
            let totalIGST = 0;
            let totalTaxAmount = 0;

            if (purchaseCart.length === 0) {
                const colSpan = gstEnabled ? "10" : "6";
                tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; color: #6c757d; padding: 20px;">No items added yet</td></tr>`;
                document.getElementById('purchaseItemCount').textContent = '0';
                document.getElementById('purchaseSubtotalValue').textContent = '0.00';
                document.getElementById('purchaseTotalValue').textContent = '0.00';
                if (document.getElementById('purchaseGstSummary')) document.getElementById('purchaseGstSummary').style.display = 'none';
                return;
            }

            tbody.innerHTML = purchaseCart.map((item, index) => {
                const prod = products.find(p => p.id == item.productId);
                const currentStock = prod ? prod.stock : 0;
                
                let gstRate = item.gstRate || 0;
                let price = item.price || 0;
                let quantity = item.qty || 1;
                let hsn = item.hsn || '';
                
                // GST Calculations
                let taxableValue = 0;
                let cgst = 0;
                let sgst = 0;
                let igst = 0;
                let totalTax = 0;
                let finalTotal = 0;
                let grossAmount = price * quantity;
                
                if (gstEnabled && gstRate > 0) {
                    taxableValue = grossAmount * 100 / (100 + gstRate);
                    totalTax = grossAmount - taxableValue;
                    finalTotal = grossAmount;
                    
                    if (taxType === 'inter') {
                        igst = totalTax;
                    } else {
                        cgst = totalTax / 2;
                        sgst = totalTax / 2;
                    }
                } else {
                    taxableValue = grossAmount;
                    finalTotal = grossAmount;
                }
                
                item.taxableValue = taxableValue;
                item.cgst = cgst;
                item.sgst = sgst;
                item.igst = igst;
                item.totalTax = totalTax;
                item.finalTotal = finalTotal;
                item.taxType = taxType; // Store on item
                
                subtotal += finalTotal;
                totalTaxableValue += taxableValue;
                totalCGST += cgst;
                totalSGST += sgst;
                totalIGST += igst;
                totalTaxAmount += totalTax;

                return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.name}</td>
                    ${gstEnabled ? `<td>${hsn}</td><td style="text-align: right;">${gstRate}%</td>` : ''}
                    <td>
                        <input type="number"
                               value="${item.qty}"
                               min="1"
                               class="form-control"
                               style="width: 70px; padding: 2px 5px;"
                               onchange="updatePurchaseItemQty(${index}, this.value)">
                    </td>
                    <td>₹${item.price.toFixed(2)}</td>
                    ${gstEnabled ? `
                        <td style="text-align: right;">₹${grossAmount.toFixed(2)}</td>
                        <td style="text-align: right;">₹${taxableValue.toFixed(2)}</td>
                        ${taxType !== 'inter' ? `<td style="text-align: right;">₹${cgst.toFixed(2)}</td><td style="text-align: right;">₹${sgst.toFixed(2)}</td>` : ''}
                        ${taxType === 'inter' ? `<td style="text-align: right;">₹${igst.toFixed(2)}</td>` : ''}
                    ` : ''}
                    <td>₹${finalTotal.toFixed(2)}</td>
                    <td><button class="btn btn-danger btn-sm purchase-remove-btn" onclick="removePurchaseItem(${index})">Remove</button></td>
                </tr>
            `}).join('');

            document.querySelectorAll('.purchase-colspan').forEach(el => {
                if (gstEnabled) {
                    el.colSpan = taxType === 'inter' ? "9" : "10";
                } else {
                    el.colSpan = "4";
                }
            });

            document.getElementById('purchaseItemCount').textContent = purchaseCart.length;
            document.getElementById('purchaseSubtotalValue').textContent = subtotal.toFixed(2);

            const discount = parseFloat(document.getElementById('purchaseDiscount').value) || 0;
            const other = parseFloat(document.getElementById('purchaseOtherCharges').value) || 0;
            const total = subtotal - discount + other;

            document.getElementById('purchaseTotalValue').textContent = total.toFixed(2);
            
            let discountRatio = 1;
            if (subtotal > 0 && discount > 0 && discount <= subtotal) {
                discountRatio = (subtotal - discount) / subtotal;
            }

            const finalTaxableValue = totalTaxableValue * discountRatio;
            const finalCGST = totalCGST * discountRatio;
            const finalSGST = totalSGST * discountRatio;
            const finalIGST = totalIGST * discountRatio;
            const finalTotalGST = totalTaxAmount * discountRatio;

            const gstSummaryBox = document.getElementById('purchaseGstSummary');
            if (gstEnabled && gstSummaryBox) {
                gstSummaryBox.style.display = 'block';
                gstSummaryBox.innerHTML = `
                    <h4 style="margin: 0 0 10px 0; color: #007bff;">📊 Tax Summary</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><strong>Total Taxable Value:</strong> ₹${finalTaxableValue.toFixed(2)}</div>
                        ${taxType === 'inter' ? 
                            `<div><strong>Total IGST:</strong> ₹${finalIGST.toFixed(2)}</div>` : 
                            `<div><strong>Total CGST:</strong> ₹${finalCGST.toFixed(2)}</div><div><strong>Total SGST:</strong> ₹${finalSGST.toFixed(2)}</div>`
                        }
                        <div><strong>Total GST:</strong> ₹${finalTotalGST.toFixed(2)}</div>
                    </div>
                `;
            } else if (gstSummaryBox) {
                gstSummaryBox.style.display = 'none';
            }
            
            updateUIForRole();
            
            // Re-calculate outstanding in case it's a credit purchase
            if (typeof calculatePurchaseOutstanding === 'function') {
                calculatePurchaseOutstanding();
            }
        }

        // --- Supplier Search Logic (Custom Dropdown) ---
        function refreshSupplierDatalist() {
            const dataList = document.getElementById('supplierList');
            if (!dataList) return;
            dataList.innerHTML = '';
            const uniqueSuppliers = new Set();
            if (purchases && purchases.length > 0) {
                purchases.forEach(p => {
                    if (p.supplier && p.supplier.trim()) uniqueSuppliers.add(p.supplier.trim());
                });
            }
            Array.from(uniqueSuppliers).sort().forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                dataList.appendChild(opt);
            });
        }

        function generateInvoiceNumber() {
            // Format: SUP-YYYYMMDD-XXXX (Random 4 chars)
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const autoID = `SUP-${dateStr}-${randomSuffix}`;
            // Simple check uniqueness locally (optional, but good)
            document.getElementById('purchaseInvoiceNumber').value = autoID;
        }

        function calculateLevenshteinDistance(a, b) {
            const matrix = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) == a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }
            return matrix[b.length][a.length];
        }

        let selectedSupplierId = null;

        function searchSuppliers(query) {
            if (typeof purchaseSupplierSelectedIndex !== 'undefined') purchaseSupplierSelectedIndex = -1;
            const resultsDiv = document.getElementById('supplierSearchResults');
            if (!query) {
                resultsDiv.style.display = 'none';
                selectedSupplierId = null;
                return;
            }

            const searchTerm = query.toLowerCase().trim();
            const suggestions = suppliers.filter(s => {
                if (!s || !s.name) return false;
                return s.name.toLowerCase().includes(searchTerm) || 
                       (s.gstin && s.gstin.toLowerCase().includes(searchTerm));
            });

            if (suggestions.length === 0) {
                resultsDiv.innerHTML = `
                    <div style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; color: #28a745;" 
                         onclick="openAddSupplierModal('${query.replace(/'/g, "\\'")}')"
                         onmouseover="this.style.background='#f8f9fa'" 
                         onmouseout="this.style.background='white'">
                        <strong>➕ Add New Supplier</strong><br>
                        <small>No matching supplier found for "${query}"</small>
                    </div>
                `;
                resultsDiv.style.display = 'block';
                return;
            }

            // Render
            resultsDiv.innerHTML = suggestions.map(s => `
                <div style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" 
                     onclick="selectSupplier('${s.id}')"
                     onmouseover="this.style.background='#f8f9fa'" 
                     onmouseout="this.style.background='white'">
                    <div style="font-weight: bold;">${s.name}</div>
                    <small>GSTIN: ${s.gstin || 'N/A'} | State: ${s.state || 'N/A'}</small>
                </div>
            `).join('');

            resultsDiv.style.display = 'block';
        }

        function selectSupplier(id) {
            const supplier = suppliers.find(s => s.id === id);
            if (!supplier) return;
            
            const nameInput = document.getElementById('purchaseSupplier');
            const resultsDiv = document.getElementById('supplierSearchResults');

            nameInput.value = supplier.name;
            selectedSupplierId = supplier.id;
            resultsDiv.style.display = 'none';
        }

        // Hide dropdown when clicking outside
        document.addEventListener('click', function (e) {
            const container = document.getElementById('supplierSearchResults');
            const input = document.getElementById('purchaseSupplier');
            if (container && container.style.display === 'block') {
                if (e.target !== container && e.target !== input && !container.contains(e.target)) {
                    container.style.display = 'none';
                }
            }
        });

        // Supplier Management Functions
        function openSupplierManagementModal() {
            document.getElementById('supplierManagementModal').style.display = 'flex';
            document.getElementById('supplierSearchInput').value = '';
            renderSupplierTable();
        }

        function closeSupplierManagementModal() {
            document.getElementById('supplierManagementModal').style.display = 'none';
        }

        function exportSuppliersCSV() {
            if (!suppliers || suppliers.length === 0) {
                showAlert('No suppliers available to export.', '⚠️');
                return;
            }
            
            let csv = 'Supplier ID,Name,Phone,Email,GSTIN,State,Country,Address,Notes\n';
            suppliers.forEach(s => {
                const name = `"${(s.name || '').replace(/"/g, '""')}"`;
                const address = `"${(s.address || '').replace(/"/g, '""')}"`;
                const notes = `"${(s.notes || '').replace(/"/g, '""')}"`;
                
                csv += `${s.id},${name},${s.phone || ''},${s.email || ''},${s.gstin || ''},${s.state || ''},${s.country || ''},${address},${notes}\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `suppliers_export.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        function renderSupplierTable() {
            const query = document.getElementById('supplierSearchInput').value.toLowerCase();
            const tbody = document.getElementById('supplierTableBody');
            
            const filtered = suppliers.filter(s => {
                if (!s || !s.name) return false;
                return s.name.toLowerCase().includes(query) || 
                       (s.gstin && s.gstin.toLowerCase().includes(query)) ||
                       (s.phone && s.phone.includes(query)) ||
                       (s.state && s.state.toLowerCase().includes(query));
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No suppliers found.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(s => `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.gstin || '-'}</td>
                    <td>${s.state || '-'}</td>
                    <td>${s.phone || '-'}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="viewSupplier('${s.id}')" title="View Details">👁️</button>
                        <button class="btn btn-secondary btn-sm" onclick="openPartyLedger('${s.id}', 'supplier')" title="View Ledger">📖</button>
                        <button class="btn btn-warning btn-sm" onclick="openAddSupplierModal(null, '${s.id}')" title="Edit">✏️</button>
                        ${window.hasPermission('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s.id}')" title="Delete">🗑️</button>` : ''}
                    </td>
                </tr>
            `).join('');
        }

        function viewSupplier(id) {
            const s = suppliers.find(sup => sup.id === id);
            if (!s) return;
            
            document.getElementById('entityDetailsTitle').textContent = 'Supplier Details';
            document.getElementById('edName').textContent = s.name;
            document.getElementById('edGstin').textContent = s.gstin || '-';
            document.getElementById('edPhone').textContent = s.phone || '-';
            document.getElementById('edState').textContent = s.state || '-';
            document.getElementById('edAddress').textContent = s.address || '-';
            document.getElementById('edNotes').textContent = s.notes || '-';
            
            const bal = calculatePartyLedgerBalance(s, 'supplier');
            document.getElementById('edOutstanding').textContent = '₹' + bal.balance.toFixed(2);
            
            // Get recent transactions (purchases)
            const recentPurchases = purchases.filter(p => p.supplierId === id || p.supplier === s.name)
                                             .sort((a, b) => new Date(b.date) - new Date(a.date))
                                             .slice(0, 5);
                                             
            const tbody = document.getElementById('edTransactionsBody');
            tbody.innerHTML = recentPurchases.length === 0 ? '<tr><td colspan="4" style="text-align: center;">No transactions found.</td></tr>' : recentPurchases.map(p => {
                const totalPaid = (p.paymentHistory || []).reduce((sum, ph) => sum + parseFloat(ph.amount), 0);
                return `<tr>
                    <td>${new Date(p.date).toLocaleDateString()}</td>
                    <td>${p.invoiceNo || p.id}</td>
                    <td>₹${parseFloat(p.totalAmount || 0).toFixed(2)}</td>
                    <td>₹${totalPaid.toFixed(2)}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('entityDetailsModal').style.display = 'flex';
        }

        function openAddSupplierModal(initialName = null, editId = null) {
            document.getElementById('addSupplierModal').style.display = 'flex';
            const isEdit = !!editId;
            document.getElementById('addSupplierTitle').innerText = isEdit ? '✏️ Edit Supplier' : '➕ Add New Supplier';
            
            document.getElementById('supplierEditId').value = editId || '';
            document.getElementById('newSupplierName').value = initialName || '';
            document.getElementById('newSupplierGSTIN').value = '';
            document.getElementById('newSupplierPhone').value = '';
            document.getElementById('newSupplierAddress').value = '';
            document.getElementById('newSupplierState').value = '';
            document.getElementById('newSupplierCountry').value = 'INDIA';
            document.getElementById('newSupplierNotes').value = '';
            document.getElementById('newSupplierOpeningBalance').value = '';

            setTimeout(() => {
                const el = document.getElementById('newSupplierName');
                if (el) {
                    el.focus();
                    el.select();
                }
            }, 50);

            if (isEdit) {
                const supplier = suppliers.find(s => s.id === editId);
                if (supplier) {
                    document.getElementById('newSupplierName').value = supplier.name;
                    document.getElementById('newSupplierGSTIN').value = supplier.gstin || '';
                    document.getElementById('newSupplierPhone').value = supplier.phone || '';
                    document.getElementById('newSupplierAddress').value = supplier.address || '';
                    document.getElementById('newSupplierState').value = supplier.state || '';
                    document.getElementById('newSupplierCountry').value = supplier.country || 'INDIA';
                    document.getElementById('newSupplierNotes').value = supplier.notes || '';
                    document.getElementById('newSupplierOpeningBalance').value = supplier.openingBalance || '';
                }
            }
        }

        function closeAddSupplierModal() {
            document.getElementById('addSupplierModal').style.display = 'none';
        }

        function deriveStateFromGSTIN(gstin) {
            if (!gstin || gstin.length < 2) return;
            const stateCodes = {
                '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
                '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
                '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
                '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
                '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
                '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
                '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
                '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
            };
            const code = gstin.substring(0, 2);
            if (stateCodes[code]) {
                document.getElementById('newSupplierState').value = stateCodes[code];
            }
        }

        function saveSupplier() {
            if (!requireLicensedForWrite('creating a supplier')) return;
            if (!window.hasPermission('purchase_entry')) return showAlert('Unauthorized: You do not have permission to manage suppliers.', 'error');
            const editId = document.getElementById('supplierEditId').value;
            const name = document.getElementById('newSupplierName').value.trim().toUpperCase();
            const gstin = document.getElementById('newSupplierGSTIN').value.trim().toUpperCase();
            const phone = document.getElementById('newSupplierPhone').value.trim();
            const address = document.getElementById('newSupplierAddress').value.trim();
            const state = document.getElementById('newSupplierState').value.trim();
            const country = document.getElementById('newSupplierCountry').value.trim();
            const notes = document.getElementById('newSupplierNotes').value.trim();
            const openingBalance = parseFloat(document.getElementById('newSupplierOpeningBalance').value) || 0;

            if (!name) {
                showAlert('Supplier Name is required', '⚠️');
                return;
            }

            if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
                showAlert('Invalid GSTIN format', '⚠️');
                return;
            }

            const normalizedName = name.replace(/\s+/g, ' ');
            const isDuplicate = suppliers.find(s => {
                if (s.id === editId) return false; // Ignore self
                if (gstin && s.gstin === gstin) return true; // GSTIN match is absolute
                if (s.name === normalizedName) return true; // Exact normalized name match
                return false;
            });

            if (isDuplicate) {
                showAlert('Supplier already exists. Please select the existing supplier instead of creating a duplicate.', 'error');
                return;
            }

            if (editId) {
                const index = suppliers.findIndex(s => s.id === editId);
                if (index !== -1) {
                    suppliers[index] = { ...suppliers[index], name: normalizedName, gstin, phone, address, state, country, notes, openingBalance };
                }
            } else {
                const newSupplier = {
                    id: 'sup_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    name: normalizedName,
                    gstin, phone, address, state, country, notes, openingBalance
                };
                suppliers.push(newSupplier);
                
                // If created from Purchase Bill flow, auto-select it
                if (document.getElementById('purchaseModal').style.display === 'flex') {
                    selectedSupplierId = newSupplier.id;
                    document.getElementById('purchaseSupplier').value = newSupplier.name;
                    document.getElementById('supplierSearchResults').style.display = 'none';
                }
            }

            saveData();
            renderSupplierTable();
            closeAddSupplierModal();
            showAlert('Supplier saved successfully', '✅');
        }

        function deleteSupplier(id) {
            if (!window.hasPermission('delete')) return showAlert('Unauthorized: You do not have permission to delete suppliers.', 'error');
            showConfirm('Are you sure you want to delete this supplier?', () => {
                suppliers = suppliers.filter(s => s.id !== id);
                saveData();
                renderSupplierTable();
            });
        }



        // Customer Management Functions
        function openCustomerManagementModal() {
            document.getElementById('customerManagementModal').style.display = 'flex';
            document.getElementById('customerSearchInput').value = '';
            renderCustomerTable();
        }

        function closeCustomerManagementModal() {
            document.getElementById('customerManagementModal').style.display = 'none';
        }

        function exportCustomersCSV() {
            if (!customers || customers.length === 0) {
                showAlert('No customers available to export.', '⚠️');
                return;
            }
            
            let csv = 'Customer ID,Name,Phone,Email,GSTIN,State,Country,Address,Notes\n';
            customers.forEach(c => {
                const name = `"${(c.name || '').replace(/"/g, '""')}"`;
                const address = `"${(c.address || '').replace(/"/g, '""')}"`;
                const notes = `"${(c.notes || '').replace(/"/g, '""')}"`;
                
                csv += `${c.id},${name},${c.phone || ''},${c.email || ''},${c.gstin || ''},${c.state || ''},${c.country || ''},${address},${notes}\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `customers_export.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        function viewCustomer(id) {
            const c = customers.find(cus => cus.id === id);
            if (!c) return;
            
            document.getElementById('entityDetailsTitle').textContent = 'Customer Details';
            document.getElementById('edName').textContent = c.name;
            document.getElementById('edGstin').textContent = c.gstin || '-';
            document.getElementById('edPhone').textContent = c.phone || '-';
            document.getElementById('edState').textContent = c.state || '-';
            document.getElementById('edAddress').textContent = c.address || '-';
            document.getElementById('edNotes').textContent = c.notes || '-';
            
            const bal = calculatePartyLedgerBalance(c, 'customer');
            document.getElementById('edOutstanding').textContent = '₹' + bal.balance.toFixed(2);
            
            // Get recent transactions
            const recentSales = sales.filter(s => s.customerId === id || s.customerName === c.name)
                                     .sort((a, b) => new Date(b.date) - new Date(a.date))
                                     .slice(0, 5);
                                     
            const tbody = document.getElementById('edTransactionsBody');
            tbody.innerHTML = recentSales.length === 0 ? '<tr><td colspan="4" style="text-align: center;">No transactions found.</td></tr>' : recentSales.map(s => {
                const totalPaid = (s.paymentHistory || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
                return `<tr>
                    <td>${new Date(s.date).toLocaleDateString()}</td>
                    <td>${s.saleId}</td>
                    <td>₹${parseFloat(s.total || s.subtotal + s.totalTax).toFixed(2)}</td>
                    <td>₹${totalPaid.toFixed(2)}</td>
                </tr>`;
            }).join('');
            
            document.getElementById('entityDetailsModal').style.display = 'flex';
        }

        function renderCustomerTable() {
            const query = document.getElementById('customerSearchInput').value.toLowerCase();
            const tbody = document.getElementById('customerTableBody');
            
            const filtered = customers.filter(c => {
                if (!c || !c.name) return false;
                return c.name.toLowerCase().includes(query) || 
                       (c.gstin && c.gstin.toLowerCase().includes(query)) ||
                       (c.phone && c.phone.includes(query)) ||
                       (c.state && c.state.toLowerCase().includes(query));
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No customers found.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(c => `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.gstin || '-'}</td>
                    <td>${c.state || '-'}</td>
                    <td>${c.phone || '-'}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="viewCustomer('${c.id}')" title="View Details">👁️</button>
                        <button class="btn btn-secondary btn-sm" onclick="openPartyLedger('${c.id}', 'customer')" title="View Ledger">📖</button>
                        <button class="btn btn-warning btn-sm" onclick="openAddCustomerModal(null, '${c.id}')" title="Edit">✏️</button>
                        ${window.hasPermission('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')" title="Delete">🗑️</button>` : ''}
                    </td>
                </tr>
            `).join('');
        }

        function openAddCustomerModal(initialName = null, editId = null) {
            document.getElementById('addCustomerModal').style.display = 'flex';
            const isEdit = !!editId;
            document.getElementById('addCustomerTitle').innerText = isEdit ? '✏️ Edit Customer' : '➕ Add New Customer';
            
            document.getElementById('customerEditId').value = editId || '';
            document.getElementById('newCustomerName').value = initialName || '';
            document.getElementById('newCustomerGSTIN').value = '';
            document.getElementById('newCustomerPhone').value = '';
            document.getElementById('newCustomerAddress').value = '';
            document.getElementById('newCustomerState').value = '';
            document.getElementById('newCustomerCountry').value = 'INDIA';
            document.getElementById('newCustomerNotes').value = '';
            document.getElementById('newCustomerOpeningBalance').value = '';

            if (isEdit) {
                const customer = customers.find(c => c.id === editId);
                if (customer) {
                    document.getElementById('newCustomerName').value = customer.name;
                    document.getElementById('newCustomerGSTIN').value = customer.gstin || '';
                    document.getElementById('newCustomerPhone').value = customer.phone || '';
                    document.getElementById('newCustomerAddress').value = customer.address || '';
                    document.getElementById('newCustomerState').value = customer.state || '';
                    document.getElementById('newCustomerCountry').value = customer.country || 'INDIA';
                    document.getElementById('newCustomerNotes').value = customer.notes || '';
                    document.getElementById('newCustomerOpeningBalance').value = customer.openingBalance || '';
                }
            }
            setTimeout(() => {
                const nameInput = document.getElementById('newCustomerName');
                if (nameInput) {
                    nameInput.focus();
                    nameInput.select();
                }
            }, 50);
        }

        function closeAddCustomerModal() {
            document.getElementById('addCustomerModal').style.display = 'none';
        }

        function closeDuplicateCustomerModal() {
            document.getElementById('duplicateCustomerModal').style.display = 'none';
        }

        function useExistingCustomer() {
            closeDuplicateCustomerModal();
            closeAddCustomerModal();
            if (window.pendingDuplicateCustomerId) {
                selectCustomer(window.pendingDuplicateCustomerId);
                window.pendingDuplicateCustomerId = null;
            }
        }

        function deriveCustomerStateFromGSTIN(gstin) {
            if (!gstin || gstin.length < 2) return;
            const stateCodes = {
                '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
                '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
                '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
                '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
                '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
                '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
                '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
                '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
            };
            const code = gstin.substring(0, 2);
            if (stateCodes[code]) {
                document.getElementById('newCustomerState').value = stateCodes[code];
            }
        }

        function saveCustomer() {
            if (!window.hasPermission('purchase_entry')) return showAlert('Unauthorized: You do not have permission to manage customers.', 'error');
            const editId = document.getElementById('customerEditId').value;
            const name = document.getElementById('newCustomerName').value.trim().toUpperCase();
            const gstin = document.getElementById('newCustomerGSTIN').value.trim().toUpperCase();
            const phone = document.getElementById('newCustomerPhone').value.trim();
            const address = document.getElementById('newCustomerAddress').value.trim();
            const state = document.getElementById('newCustomerState').value.trim();
            const country = document.getElementById('newCustomerCountry').value.trim();
            const notes = document.getElementById('newCustomerNotes').value.trim();
            const openingBalance = parseFloat(document.getElementById('newCustomerOpeningBalance').value) || 0;

            if (!name) {
                showAlert('Customer Name is required', '⚠️');
                return;
            }

            if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
                showAlert('Invalid GSTIN format', '⚠️');
                return;
            }

            const normalizedName = name.replace(/\s+/g, ' ');
            const matchName = normalizedName.toLowerCase();
            const matchPhone = phone.replace(/[\s\-()+]/g, '').replace(/^91/, '');
            const matchGSTIN = gstin; // Already trimmed and uppercase

            let matchedMatches = [];
            let duplicateCustomer = null;


            if (typeof isDemoMode === 'function' && isDemoMode()) {
                // If editing existing, allow it. If creating new, check limit.
                const editingId = document.getElementById('editCustomerId').value;
                if (!editingId) {
                    if (!canCreateDemoCustomer()) {
                        showDemoLimitMessage('customers');
                        return;
                    }
                }
            }            const checkDuplicate = (record) => {
                if (record.id === editId) return false;
                
                let matches = [];
                const recName = (record.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const recPhone = (record.phone || '').replace(/[\s\-()+]/g, '').replace(/^91/, '');
                const recGSTIN = (record.gstin || '').trim().toUpperCase();

                if (matchName && recName === matchName) matches.push('Customer Name');
                if (matchPhone && recPhone === matchPhone) matches.push('Phone Number');
                if (matchGSTIN && recGSTIN === matchGSTIN) matches.push('GSTIN');

                if (matches.length > 0) {
                    duplicateCustomer = record;
                    matchedMatches = matches;
                    return true;
                }
                return false;
            };

            const isDuplicate = customers.find(checkDuplicate) || suppliers.find(checkDuplicate);

            if (isDuplicate) {
                const displayName = duplicateCustomer.name + (duplicateCustomer.id.startsWith('sup_') ? ' (Supplier)' : '');
                document.getElementById('duplicateCustomerNameDisplay').innerText = displayName;
                
                const listHtml = matchedMatches.map(m => `<li>✓ ${m}</li>`).join('');
                document.getElementById('duplicateCustomerMatchesList').innerHTML = listHtml;
                
                window.pendingDuplicateCustomerId = duplicateCustomer.id;
                document.getElementById('duplicateCustomerModal').style.display = 'flex';
                return;
            }

            let newCustomerId = editId;

            if (editId) {
                const index = customers.findIndex(c => c.id === editId);
                if (index !== -1) {
                    customers[index] = { ...customers[index], name: normalizedName, gstin, phone, address, state, country, notes, openingBalance };
                }
            } else {
                newCustomerId = 'cus_' + Date.now() + Math.random().toString(36).substr(2, 5);
                const newCustomer = {
                    id: newCustomerId,
                    name: normalizedName,
                    gstin, phone, address, state, country, notes, openingBalance
                };
                customers.push(newCustomer);
            }

            saveData();
            renderCustomerTable();
            closeAddCustomerModal();
            showAlert('Customer saved successfully', '✅');

            // If the user was searching for a customer and created a new one, select it
            if (document.getElementById('existingCustomerSection').style.display === 'block') {
                 selectCustomer(newCustomerId);
            }
        }

        function deleteCustomer(id) {
            if (!window.hasPermission('delete')) return showAlert('Unauthorized: You do not have permission to delete customers.', 'error');
            showConfirm('Are you sure you want to delete this customer?', () => {
                customers = customers.filter(c => c.id !== id);
                saveData();
                renderCustomerTable();
            });
        }

        // Sales Customer Flow Functions

        function searchCustomers(query) {
            customerSearchFocusedIndex = -1; // Reset keyboard selection
            query = query.toLowerCase().trim();
            const resultsDropdown = document.getElementById('customerSearchResults');
            
            if (query.length < 2) {
                resultsDropdown.style.display = 'none';
                return;
            }

            const matchedCustomers = customers.filter(c => {
                return (c.name && c.name.toLowerCase().includes(query)) ||
                       (c.phone && c.phone.includes(query)) ||
                       (c.gstin && c.gstin.toLowerCase().includes(query));
            });
            const matchedSuppliers = suppliers.filter(s => {
                return (s.name && s.name.toLowerCase().includes(query)) ||
                       (s.phone && s.phone.includes(query)) ||
                       (s.gstin && s.gstin.toLowerCase().includes(query));
            });

            const matched = [];
            const addedNames = new Set();
            matchedCustomers.forEach(c => {
                matched.push(c);
                if (c.name) addedNames.add(c.name.toLowerCase());
            });
            matchedSuppliers.forEach(s => {
                if (s.name && !addedNames.has(s.name.toLowerCase())) {
                    matched.push(s);
                }
            });

            if (matched.length === 0) {
                resultsDropdown.innerHTML = `
                    <div style="padding: 10px; color: #666; margin-bottom: 5px;">No customer found.</div>
                    <button class="btn btn-success combobox-option" style="width: 100%; border-radius: 4px; padding: 10px; font-weight: bold; cursor: pointer; display: block; text-align: center; border: none; box-sizing: border-box;" onclick="openAddCustomerModal('${query}')">
                        ➕ Add "${query}" as New Customer
                    </button>
                `;
            } else {
                resultsDropdown.innerHTML = matched.map(c => `
                    <div class="combobox-option" onclick="selectCustomer('${c.id}')">
                        <div style="font-weight: bold;">${c.name} ${c.id.startsWith('sup_') ? '<span style="font-size:10px; color:#17a2b8;">(Supplier)</span>' : ''}</div>
                        <div style="font-size: 12px; color: #666;">📞 ${c.phone || '-'} | 🏢 ${c.gstin || '-'}</div>
                    </div>
                `).join('') + `
                    <button class="btn btn-success combobox-option" style="width: 100%; border-radius: 4px; padding: 10px; font-weight: bold; cursor: pointer; display: block; text-align: center; border: none; box-sizing: border-box; margin-top: 5px;" onclick="openAddCustomerModal('${query}')">
                        ➕ Add "${query}" as New Customer
                    </button>
                `;
            }
            resultsDropdown.style.display = 'block';
        }

        function selectCustomer(id) {
            let customer = customers.find(c => c.id === id);
            if (!customer) customer = suppliers.find(s => s.id === id);
            if (!customer) return;

            document.getElementById('activeCustomerId').value = customer.id;
            document.getElementById('displayCustomerName').innerText = customer.name;
            document.getElementById('displayCustomerPhone').innerText = customer.phone || 'No Phone';
            document.getElementById('displayCustomerGSTIN').innerText = customer.gstin || 'No GSTIN';
            document.getElementById('displayCustomerState').innerText = customer.state || 'No State';
            
            document.getElementById('saleCustomerSearch').value = customer.name;
            document.getElementById('customerSearchResults').style.display = 'none';
            document.getElementById('selectedCustomerDetails').style.display = 'block';
            
            document.getElementById('existingCustomerSection').style.display = 'block';

            // Auto advance focus to Discount
            const discInput = document.getElementById('discountAmount');
            if (discInput) {
                discInput.focus();
                discInput.select();
            }
        }

        let customerSearchFocusedIndex = -1;

        function handleCustomerSearchKeydown(event) {
            const dropdown = document.getElementById('customerSearchResults');
            
            // Flow: Search Customer -> Discount when Enter is pressed on empty field or after selection
            if (event.key === 'Enter' && (!dropdown || dropdown.style.display === 'none')) {
                const query = event.target.value.trim();
                if (!query || document.getElementById('activeCustomerId').value) {
                    event.preventDefault();
                    const discInput = document.getElementById('discountAmount');
                    if (discInput) {
                        discInput.focus();
                        discInput.select();
                    }
                }
                return;
            }
            
            if (event.key === 'ArrowDown' && dropdown.style.display === 'none') {
                event.preventDefault();
                const addBtn = document.getElementById('btnAddCustomerMain');
                if (addBtn) addBtn.focus();
                return;
            }

            if (dropdown.style.display === 'none') return;

            const items = dropdown.querySelectorAll('.combobox-option');
            if (items.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                customerSearchFocusedIndex++;
                if (customerSearchFocusedIndex >= items.length) customerSearchFocusedIndex = 0;
                highlightCustomerSearchItem(items);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                customerSearchFocusedIndex--;
                if (customerSearchFocusedIndex < 0) customerSearchFocusedIndex = items.length - 1;
                highlightCustomerSearchItem(items);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                if (customerSearchFocusedIndex >= 0 && customerSearchFocusedIndex < items.length) {
                    items[customerSearchFocusedIndex].click();
                } else if (items.length > 0) {
                    items[0].click(); // default to first
                }
            } else if (event.key === 'Escape') {
                dropdown.style.display = 'none';
                customerSearchFocusedIndex = -1;
            }
        }

        function highlightCustomerSearchItem(items) {
            items.forEach((item, index) => {
                const isButton = item.tagName.toLowerCase() === 'button';
                if (index === customerSearchFocusedIndex) {
                    item.style.backgroundColor = isButton ? '#218838' : '#e9ecef';
                    // add visual outline for accessibility
                    if (isButton) item.style.outline = '2px solid #0056b3';
                } else {
                    item.style.backgroundColor = '';
                    if (isButton) item.style.outline = 'none';
                }
            });
        }

        function clearCustomerSelection() {
            document.getElementById('activeCustomerId').value = '';
            document.getElementById('saleCustomerSearch').value = '';
            document.getElementById('saleCustomerSearch').style.display = 'block';
            document.getElementById('selectedCustomerDetails').style.display = 'none';
            document.getElementById('saleCustomerSearch').focus();
        }
        
        // Hide customer search dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#existingCustomerSection')) {
                const resultsDropdown = document.getElementById('customerSearchResults');
                if (resultsDropdown) resultsDropdown.style.display = 'none';
            }
        });

        function removePurchaseItem(index) {
            purchaseCart.splice(index, 1);
            updatePurchaseTable();
        }

        function clearPurchaseCart() {
            if (confirm('Clear current purchase entry?')) {
                purchaseCart = [];
                updatePurchaseTable();
                document.getElementById('purchaseInvoiceNumber').value = '';
                document.getElementById('purchaseSupplier').value = '';
                if(document.getElementById('purchasePaymentMethod')) document.getElementById('purchasePaymentMethod').value = 'cash';
                if(document.getElementById('purchaseCreditAmountPaid')) document.getElementById('purchaseCreditAmountPaid').value = '0';
                if(document.getElementById('purchaseCreditOutstanding')) document.getElementById('purchaseCreditOutstanding').value = '0';
                if(document.getElementById('purchaseCreditDueDate')) document.getElementById('purchaseCreditDueDate').value = '';
                if(typeof togglePurchasePaymentFields === 'function') togglePurchasePaymentFields();
                selectedSupplierId = null;
            }
        }

        // Save Purchase
        function savePurchase() {
            if (!requireLicensedForWrite('creating a purchase')) return;
            if (!window.hasPermission('purchase_entry')) return showAlert('Unauthorized: You do not have permission to enter purchases.', 'error');
            const invoice = document.getElementById('purchaseInvoiceNumber').value;
            const supplierName = document.getElementById('purchaseSupplier').value;
            const date = document.getElementById('purchaseDate').value;

            const discount = parseFloat(document.getElementById('purchaseDiscount').value) || 0;
            const other = parseFloat(document.getElementById('purchaseOtherCharges').value) || 0;
            const subtotal = parseFloat(document.getElementById('purchaseSubtotalValue').textContent) || 0;
            const total = parseFloat(document.getElementById('purchaseTotalValue').textContent) || 0;

            if (!invoice || !supplierName || !date) {
                showAlert('Please fill required fields (Invoice, Supplier, Date)', '⚠️');
                return;
            }

            // Ensure the supplier selected is actually in the Master
            const matchedSupplier = suppliers.find(s => s.name === supplierName || s.id === selectedSupplierId);
            if (!matchedSupplier) {
                showAlert('Please select a valid supplier from the list, or Add New Supplier.', '⚠️');
                return;
            }

            if (purchaseCart.length === 0) {
                showAlert('No items in purchase!', '⚠️');
                return;
            }

            // Duplicate Check
            const isDuplicate = purchases.some(p =>
                p.invoiceNumber.toLowerCase() === invoice.toLowerCase() &&
                (p.supplierId === matchedSupplier.id || (p.supplier && p.supplier.toLowerCase() === supplierName.toLowerCase()))
            );

            if (isDuplicate) {
                showAlert('❌ Duplicate Found!\nThis Invoice Number already exists for this Supplier.', 'error');
                return;
            }

            // Tax Type logic inference based on State
            let taxType = 'intra'; // Default
            if (matchedSupplier && matchedSupplier.state) {
                const storeState = (typeof settings !== 'undefined' && settings.storeState) ? settings.storeState : '';
                if (storeState && storeState.toLowerCase().trim() !== matchedSupplier.state.toLowerCase().trim()) {
                    taxType = 'inter';
                }
            }

            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();

            const paymentMethod = document.getElementById('purchasePaymentMethod') ? document.getElementById('purchasePaymentMethod').value : 'cash';
            const creditAmountPaid = parseFloat(document.getElementById('purchaseCreditAmountPaid').value) || 0;
            const creditOutstanding = total - creditAmountPaid;
            const creditPaymentMethod = document.getElementById('purchaseCreditPaymentMethod') ? document.getElementById('purchaseCreditPaymentMethod').value : 'cash';
            const creditDueDate = document.getElementById('purchaseCreditDueDate') ? document.getElementById('purchaseCreditDueDate').value : '';

            if (paymentMethod === 'credit' && creditAmountPaid > total) {
                showAlert(`❌ Amount Paid cannot be greater than Total Amount for a credit purchase!`, '⚠️');
                return;
            }

            const record = {
                id: Date.now(),
                invoiceNumber: invoice,
                supplier: matchedSupplier.name,
                supplierId: matchedSupplier.id,
                taxType: taxType,
                date: date,
                items: purchaseCart,
                subtotal: subtotal,
                discount: discount,
                otherCharges: other,
                totalAmount: total,
                gstApplied: settings.gstEnabled === true,
                
                // Credit Payment Tracking
                paymentStatus: paymentMethod === 'credit' ? (creditOutstanding <= 0 ? 'fully_paid' : (creditAmountPaid > 0 ? 'partially_paid' : 'unpaid')) : 'fully_paid',
                amountPaid: paymentMethod === 'credit' ? creditAmountPaid : total,
                outstandingAmount: paymentMethod === 'credit' ? creditOutstanding : 0,
                dueDate: paymentMethod === 'credit' ? creditDueDate : '',
                paymentHistory: paymentMethod === 'credit' && creditAmountPaid > 0 ? [{
                    date: date || new Date().toISOString().split('T')[0],
                    amount: creditAmountPaid,
                    method: creditPaymentMethod,
                    reference: document.getElementById('creditReference') ? document.getElementById('creditReference').value : '',
                    notes: 'Initial Payment'
                }] : (paymentMethod !== 'credit' ? [{
                    date: date || new Date().toISOString().split('T')[0],
                    amount: total,
                    method: paymentMethod,
                    reference: '',
                    notes: 'Fully Paid'
                }] : [])
            };

            // Show Blocking Overlay
            // LOCAL SAVE
            
            // 1. Add to purchases array
            purchases.push(record);

            // 2. Update stock and stock history
            record.items.forEach(item => {
                const productIndex = products.findIndex(p => p.id === item.productId);
                if (productIndex !== -1) {
                    const qtyToAdd = parseFloat(item.qty || item.quantity || 0);
                    let productRef = products[productIndex];
                    let variantRef = null;
                    if (item.variantId) {
                        variantRef = window.getVariantById(productRef, item.variantId);
                    }

                    if (variantRef) {
                        variantRef.stock = parseFloat(((variantRef.stock || 0) + qtyToAdd).toFixed(3));
                        if (item.price !== undefined && item.price !== null) {
                            variantRef.buyingPrice = parseFloat(item.price);
                        }
                    } else {
                        productRef.stock = parseFloat(((productRef.stock || 0) + qtyToAdd).toFixed(3));
                        if (item.price !== undefined && item.price !== null) {
                            productRef.costPrice = parseFloat(item.price);
                        }
                    }
                    
                    stockHistory.push({
                        date: record.date,
                        productId: item.productId,
                        variantId: item.variantId || undefined,
                        productName: item.name || item.productName || 'Unknown Product',
                        type: 'purchase',
                        quantity: qtyToAdd,
                        details: `Purchased (Invoice: ${record.invoiceNumber})`
                    });
                }
            });

            // 3. Save to localStorage
            saveData();

            showAlert('Purchase Saved Successfully!', '✅');

            // Clear Data
            purchaseCart = [];
            document.getElementById('purchaseDiscount').value = 0;
            document.getElementById('purchaseOtherCharges').value = 0;
            document.getElementById('purchaseInvoiceNumber').value = '';
            document.getElementById('purchaseSupplier').value = '';
            if(document.getElementById('purchasePaymentMethod')) document.getElementById('purchasePaymentMethod').value = 'cash';
            if(document.getElementById('purchaseCreditAmountPaid')) document.getElementById('purchaseCreditAmountPaid').value = '0';
            if(document.getElementById('purchaseCreditOutstanding')) document.getElementById('purchaseCreditOutstanding').value = '0';
            if(document.getElementById('purchaseCreditDueDate')) document.getElementById('purchaseCreditDueDate').value = '';
            if(typeof togglePurchasePaymentFields === 'function') togglePurchasePaymentFields();
            selectedSupplierId = null;

            // Prepare Fresh Bill
            updatePurchaseTable();
            setTimeout(() => {
                document.getElementById('purchaseDate').focus();
            }, 50);
            
            // Do NOT close modal
            // closePurchaseModal();

        }
        // New Product Form Logic (Inline)
        function generateNewProductBarcode() {
            const code = 'DDS-' + Date.now().toString().slice(-6);
            document.getElementById('newProductBarcode').value = code;
        }

        function showPurchaseAddNewProductForm() {
            document.getElementById('purchaseNewProductContainer').style.display = 'flex';
            
            const currentSettings = JSON.parse(localStorage.getItem('settings') || 'null') || {};
            const expTrack = currentSettings.expiryTracking !== undefined ? currentSettings.expiryTracking : false;
            const buyTrack = currentSettings.buyingPriceTracking !== undefined ? currentSettings.buyingPriceTracking : false;
            
            if (document.getElementById('newProductExpiryContainer')) {
                document.getElementById('newProductExpiryContainer').style.display = expTrack ? 'block' : 'none';
            }
            if (document.getElementById('newProductPurchasePriceContainer')) {
                if (window.isAddingFromInventory || window.isAddingFromSale) {
                    document.getElementById('newProductPurchasePriceContainer').style.display = buyTrack ? 'block' : 'none';
                } else {
                    document.getElementById('newProductPurchasePriceContainer').style.display = 'block';
                }
            }
            
            populateCategoryDropdowns();
            populateUnitDropdowns();
            document.getElementById('newProductBarcode').value = '';
            document.getElementById('newProductName').value = '';
            setTimeout(() => { const nm = document.getElementById('newProductName'); if(nm) nm.focus(); }, 50);
            document.getElementById('newProductCategory').value = '';
            if (document.getElementById('newProductCustomCategory')) {
                document.getElementById('newProductCustomCategory').style.display = 'none';
                document.getElementById('newProductCustomCategory').value = '';
            }
            document.getElementById('newProductUnit').value = '';
            document.getElementById('newProductSellingPrice').value = '';
            document.getElementById('newProductPurchasePrice').value = '';
            document.getElementById('newProductInitialStock').value = '0';
            document.getElementById('newProductMinStock').value = '0';
            document.getElementById('newProductDescription').value = '';
            document.getElementById('newProductSupplier').value = '';
            document.getElementById('purchasePackSizesContainer').innerHTML = '';
            generateNewProductBarcode();
        }

        function calculateNewProductMinStock() {
            const stock = parseInt(document.getElementById('newProductInitialStock').value) || 0;
            // Calculate 20%
            const minStock = Math.floor(stock * 0.2);
            document.getElementById('newProductMinStock').value = minStock;
        }
        function hidePurchaseAddNewProductForm() {
            document.getElementById('purchaseNewProductContainer').style.display = 'none';
            if (window.isAddingFromSale) {
                window.isAddingFromSale = false;
                closePurchaseModal();
                togglePurchaseBillElements(true); // reset for normal purchase flow
            } else if (window.isAddingFromInventory) {
                window.isAddingFromInventory = false;
                closePurchaseModal();
                togglePurchaseBillElements(true); // reset for normal purchase flow
            }
        }

        // --- Variant UI Logic ---
        let currentNewProductVariants = [];

        function toggleVariantUI() {
            const hasVariants = document.getElementById('newProductHasVariants').checked;
            
            // Variants are additive: do NOT hide parent-level fields.
            // Only toggle the variant section visibility.
            document.getElementById('variantSection').style.display = hasVariants ? 'block' : 'none';
        }

        function handleVariantKeydown(e, nextId) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (nextId === 'btnAddVar') {
                    addNewProductVariant();
                } else {
                    const nextEl = document.getElementById(nextId);
                    if (nextEl) nextEl.focus();
                }
            }
        }

        function isBarcodeGloballyUnique(barcode) {
            if (!barcode) return true;
            barcode = String(barcode).trim();
            for (const p of products) {
                if (p.barcode && String(p.barcode).trim() === barcode) return false;
                if (window.hasVariants(p)) {
                    for (const v of p.variants) {
                        if (v.barcode && String(v.barcode).trim() === barcode) return false;
                    }
                }
            }
            for (const v of currentNewProductVariants) {
                if (v.barcode && String(v.barcode).trim() === barcode) return false;
            }
            return true;
        }

        function addNewProductVariant() {
            // Auto-update parent display from product name field
            const productNameEl = document.getElementById('newProductName');
            const parentDisplayEl = document.getElementById('varParentDisplay');
            if (productNameEl && parentDisplayEl) {
                parentDisplayEl.value = productNameEl.value.trim();
            }

            const name = document.getElementById('varName').value.trim();
            const barcode = document.getElementById('varBarcode').value.trim();
            const buyPrice = parseFloat(document.getElementById('varBuyPrice').value) || 0;
            const sellPrice = parseFloat(document.getElementById('varSellPrice').value) || 0;
            const stock = parseInt(document.getElementById('varStock').value) || 0;
            const minStock = parseInt(document.getElementById('varMinStock').value) || 0;
            const discount = parseFloat(document.getElementById('varDiscount') ? document.getElementById('varDiscount').value : 0) || 0;
            const hsnEl = document.getElementById('varHSN');
            let hsn = '';
            if (hsnEl) {
                if (hsnEl.tagName === 'SELECT') {
                    hsn = hsnEl.value === '__custom__'
                        ? (document.getElementById('varHSNCustom') ? document.getElementById('varHSNCustom').value.trim() : '')
                        : (hsnEl.value === '' ? '' : hsnEl.value);
                } else {
                    hsn = hsnEl.value.trim();
                }
            }

            const catEl = document.getElementById('varCategory');
            const category = catEl ? catEl.value : '';
            const unitEl = document.getElementById('varUnit');
            const unit = unitEl ? unitEl.value : '';
            const qtyTypeEl = document.getElementById('varQuantityType');
            const quantityType = qtyTypeEl ? qtyTypeEl.value : '';
            const gstEl = document.getElementById('varGSTRate');
            const gstRate = gstEl ? gstEl.value : '';

            // Gather pack sizes for this variant
            const packSizes = [];
            const varPackContainer = document.getElementById('varPackSizesContainer');
            if (varPackContainer) {
                varPackContainer.querySelectorAll('.pack-size-row').forEach((row, index) => {
                    const pName = row.querySelector('.pack-name');
                    const pQty = row.querySelector('.pack-qty');
                    const pPrice = row.querySelector('.pack-price');
                    if (pName && pQty && pName.value && parseFloat(pQty.value)) {
                        packSizes.push({
                            name: pName.value,
                            quantity: parseFloat(pQty.value),
                            price: pPrice ? (parseFloat(pPrice.value) || 0) : 0
                        });
                    }
                });
            }

            if (!name) {
                showAlert('Variant Name is required.', '⚠️');
                document.getElementById('varName').focus();
                return;
            }

            const parentNameEl = document.getElementById('newProductName');
            const parentNameVal = parentNameEl ? parentNameEl.value.trim() : 'Current Product';
            const parentName = parentNameEl ? parentNameEl.value.trim().toLowerCase() : '';

            // Case-insensitive + whitespace-normalized duplicate check
            const normName = name.toLowerCase().replace(/\s+/g, ' ').trim();
            if (currentNewProductVariants.some(v => v.variantName.toLowerCase().replace(/\s+/g, ' ').trim() === normName)) {
                showAlert(`Variant "${name}" already exists for ${parentNameVal}.`, '⚠️');
                return;
            }

            if (parentName) {
                const existingParent = products.find(p => p.name.trim().toLowerCase() === parentName);
                if (existingParent && window.hasVariants(existingParent)) {
                    if (existingParent.variants.some(v => String(v.variantName).toLowerCase().replace(/\s+/g, ' ').trim() === normName)) {
                        showAlert(`Variant "${name}" already exists for ${existingParent.name}.`, '⚠️');
                        return;
                    }
                }
            }

            if (barcode && !isBarcodeGloballyUnique(barcode)) {
                showAlert('Barcode already exists globally!', '⚠️');
                return;
            }

            const newVariant = {
                id: 'var-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                variantName: name,
                barcode: barcode,
                buyingPrice: buyPrice,
                sellingPrice: sellPrice,
                stock: stock,
                minimumStock: minStock,
                productDiscount: discount,
                hsn: hsn,
                category: category,
                unit: unit,
                quantityType: quantityType,
                gstRate: gstRate,
                packSizes: packSizes
            };

            currentNewProductVariants.push(newVariant);
            renderVariantsTable();

            // Reset variant form fields
            document.getElementById('varName').value = '';
            document.getElementById('varBarcode').value = '';
            document.getElementById('varSellPrice').value = '';
            document.getElementById('varBuyPrice').value = '';
            document.getElementById('varDiscount').value = '0';
            document.getElementById('varStock').value = '0';
            document.getElementById('varMinStock').value = '0';
            const hsnResetEl = document.getElementById('varHSN');
            if (hsnResetEl) { hsnResetEl.value = ''; }
            const hsnCustomResetEl = document.getElementById('varHSNCustom');
            if (hsnCustomResetEl) { hsnCustomResetEl.value = ''; hsnCustomResetEl.style.display = 'none'; }

            if (varPackContainer) varPackContainer.innerHTML = '';
            document.getElementById('varName').focus();
        }

        function copyNewProductVariant() {
            // Open "Copy Existing Variant" modal unconditionally
            document.getElementById('copyExistingVariantModal').style.display = 'flex';
            document.getElementById('copyExistingSearchInput').value = '';
            document.getElementById('copyExistingSearchResults').innerHTML = '<div style="padding:10px; color:#666; font-style: italic;">Search for a product that already has variants.</div>';
            document.getElementById('copyExistingVariantSelection').style.display = 'none';
            setTimeout(() => document.getElementById('copyExistingSearchInput').focus(), 100);
        }
        
        // --- Copy Existing Variant Logic ---
        let currentCopyProduct = null;
        
        function searchExistingVariantProduct(query) {
            const resultsDiv = document.getElementById('copyExistingSearchResults');
            if (!query) {
                resultsDiv.innerHTML = '<div style="padding:10px; color:#666; font-style: italic;">Search for a product that already has variants.</div>';
                return;
            }
            // Use unified search
            const matches = searchProductsUnified(query, products).filter(p => window.hasVariants(p)).slice(0, 10);
            
            if (matches.length === 0) {
                resultsDiv.innerHTML = '<div style="padding:10px; color:#666; color: #dc3545; font-weight: bold;">No products with variants found.</div>';
                return;
            }
            
            resultsDiv.innerHTML = matches.map(p => `
                <div class="search-result-item" onclick="selectExistingVariantProduct('${p.id}')" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                    <strong>${p.name}</strong>
                    <br><small>${p.variants.length} variants</small>
                </div>
            `).join('');
        }
        
        function selectExistingVariantProduct(id) {
            currentCopyProduct = products.find(p => String(p.id) === String(id));
            if (!currentCopyProduct) return;
            
            document.getElementById('copyExistingSearchResults').innerHTML = '';
            const variantDiv = document.getElementById('copyExistingVariantSelection');
            variantDiv.style.display = 'block';
            
            variantDiv.innerHTML = `
                <h5 style="margin-top:0;">Select Variant from ${currentCopyProduct.name}</h5>
                <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
                    ${currentCopyProduct.variants.map(v => `
                        <div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; display:flex; justify-content:space-between;" onclick="executeCopyVariant('${v.id}')">
                            <span>${window.getVariantDisplayName(currentCopyProduct, v)}</span>
                            <span>₹${v.sellingPrice || 0}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        function executeCopyVariant(variantId) {
            if (!currentCopyProduct) return;
            const variant = window.getVariantById(currentCopyProduct, variantId);
            if (!variant) return;
            
            if (window.isCopyingForInventory) {
                document.getElementById('addVariantBuyPrice').value = variant.buyingPrice || 0;
                document.getElementById('addVariantSellPrice').value = variant.sellingPrice || 0;
                document.getElementById('addVariantStock').value = 0;
                document.getElementById('addVariantMinStock').value = variant.minimumStock || 0;
                document.getElementById('addVariantBarcode').value = 'DDS-' + Date.now().toString().slice(-7);
                document.getElementById('copyExistingVariantModal').style.display = 'none';
                window.isCopyingForInventory = false;
                document.getElementById('addVariantName').focus();
            } else {
                document.getElementById('varBuyPrice').value = variant.buyingPrice || 0;
                document.getElementById('varSellPrice').value = variant.sellingPrice || 0;
                document.getElementById('varStock').value = 0; // DO NOT copy stock
                document.getElementById('varMinStock').value = variant.minimumStock || 0;
                document.getElementById('varBarcode').value = 'DDS-' + Date.now().toString().slice(-7);
                document.getElementById('varName').value = variant.variantName;
                document.getElementById('copyExistingVariantModal').style.display = 'none';
                document.getElementById('varName').focus();
                document.getElementById('varName').select();
            }
        }
        

        function renderVariantsTable() {
            const tbody = document.getElementById('variantsTableBody');
            if (currentNewProductVariants.length === 0) {
                tbody.innerHTML = '<tr id="noVariantsRow"><td colspan="7" style="padding: 10px; text-align: center; color: #666; font-style: italic;">No variants added yet. Fill the form above and click + Add Variant to List.</td></tr>';
                return;
            }
            tbody.innerHTML = currentNewProductVariants.map((v, index) => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px 10px; font-weight:600;">${v.variantName}</td>
                    <td style="padding: 8px 10px; font-size:13px; color:#555;">${v.barcode || '—'}</td>
                    <td style="padding: 8px 10px;">₹${(v.sellingPrice || 0).toFixed(2)}</td>
                    <td style="padding: 8px 10px;" class="buying-price-feature">₹${(v.buyingPrice || 0).toFixed(2)}</td>
                    <td style="padding: 8px 10px;">${v.productDiscount ? v.productDiscount + '%' : '—'}</td>
                    <td style="padding: 8px 10px;">${v.stock || 0}</td>
                    <td style="padding: 8px 10px; text-align:center;">
                        <button type="button" class="btn btn-sm btn-danger" onclick="removeVariant(${index})" style="padding: 4px 8px;" title="Remove">🗑</button>
                    </td>
                </tr>
            `).join('');
        }

        function removeVariant(index) {
            currentNewProductVariants.splice(index, 1);
            renderVariantsTable();
        }

        // Hook into open modal to reset
        const origShowPurchaseAddNewProductForm = window.showPurchaseAddNewProductForm;
        window.showPurchaseAddNewProductForm = function() {
            currentNewProductVariants = [];
            renderVariantsTable();
            const checkbox = document.getElementById('newProductHasVariants');
            if (checkbox) {
                checkbox.checked = false;
                toggleVariantUI();
            }
            if (origShowPurchaseAddNewProductForm) {
                origShowPurchaseAddNewProductForm();
            }
        };

        function addNewProductToPurchase() {
            try {
                const barcodeEl = document.getElementById('newProductBarcode');
                const barcode = barcodeEl ? barcodeEl.value : '';

                const nameEl = document.getElementById('newProductName');
                const name = nameEl ? nameEl.value : '';

                const categoryEl = document.getElementById('newProductCategory');
                let category = categoryEl ? categoryEl.value : '';

                const expEl = document.getElementById('newProductExpiryDays');
                const expiryDays = expEl && expEl.value !== '' ? parseInt(expEl.value) || 0 : 0;
                let expiryDate = null;
                if (expiryDays > 0) {
                    let d = new Date();
                    d.setDate(d.getDate() + expiryDays);
                    expiryDate = d.toISOString().split('T')[0];
                }

                const unitEl = document.getElementById('newProductUnit');
                const unit = unitEl ? unitEl.value : '';

                const sellingPriceEl = document.getElementById('newProductSellingPrice');
                const sellingPrice = sellingPriceEl ? parseFloat(sellingPriceEl.value) || 0 : 0;

                const productDiscountEl = document.getElementById('newProductDiscount');
                const productDiscount = productDiscountEl ? parseFloat(productDiscountEl.value) || 0 : 0;


                const costPriceEl = document.getElementById('newProductPurchasePrice');
                const costPrice = costPriceEl ? parseFloat(costPriceEl.value) || 0 : 0;

                const hsnEl = document.getElementById('newProductHSN');
                const hsn = hsnEl ? hsnEl.value : '';

                const gstRateEl = document.getElementById('newProductGSTRate');
                let gstRate = gstRateEl ? gstRateEl.value : '0';
                if (gstRate === 'custom') {
                    const customGstEl = document.getElementById('newProductCustomGSTRate');
                    gstRate = customGstEl ? customGstEl.value : '0';
                }
                gstRate = parseFloat(gstRate) || 0;

                const stockEl = document.getElementById('newProductInitialStock');
                const stock = stockEl ? parseInt(stockEl.value) || 0 : 0;

                const minStockEl = document.getElementById('newProductMinStock');
                const minStock = minStockEl ? parseInt(minStockEl.value) || 0 : 0;

                const descEl = document.getElementById('newProductDescription');
                const desc = descEl ? descEl.value : '';

                const supplierEl = document.getElementById('newProductSupplier');
                const supplier = supplierEl ? supplierEl.value : '';

                const imageBase64El = document.getElementById('newProductImageBase64');
                const imageBase64 = imageBase64El ? imageBase64El.value : '';

                if (!name || !category || !unit) {
                    showAlert('Name, Category and Unit are required!', '⚠️');
                    return;
                }

                // Gather Pack Sizes
                const packSizes = [];
                const packSizeContainer = document.getElementById('purchasePackSizesContainer');
                if (packSizeContainer) {
                    const rows = packSizeContainer.querySelectorAll('.pack-size-row');
                    rows.forEach((row, index) => {
                        const nameEl = row.querySelector('.pack-name');
                        const qtyEl = row.querySelector('.pack-qty');
                        const priceEl = row.querySelector('.pack-price');

                        if (nameEl && qtyEl && priceEl) {
                            const packName = nameEl.value;
                            const packQty = parseFloat(qtyEl.value);
                            const packPrice = parseFloat(priceEl.value);

                            if (packName && packQty) {
                                packSizes.push({
                                    barcode: barcode + '-' + (index + 1), // Derived barcode
                                    name: packName,
                                    unit: packName, // Use name as unit for consistency
                                    quantity: packQty,
                                    price: packPrice || 0
                                });
                            }
                        }
                    });
                }

                const hasVariants = document.getElementById('newProductHasVariants') && document.getElementById('newProductHasVariants').checked;
                
                if (!hasVariants && barcode && !isBarcodeGloballyUnique(barcode)) {
                    showAlert('Barcode already exists globally!', '⚠️');
                    return;
                }
                
                if (hasVariants && currentNewProductVariants.length === 0) {
                    showAlert('Please add at least one variant!', '⚠️');
                    return;
                }
                // 2. Fuzzy Name Check (≥ 0.65 Match)
                let maxSimilarity = 0;
                let similarProduct = null;

                products.forEach(p => {
                    const similarity = calculateSimilarity(name, p.name);
                    if (similarity > maxSimilarity) {
                        maxSimilarity = similarity;
                        similarProduct = p;
                    }
                });

                const proceedToAdd = () => {
                    // Check if updating existing
                    let newProd = products.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
                    
                    if (newProd) {
                        // Update existing
                        if (!hasVariants) {
                            newProd.barcode = barcode || newProd.barcode;
                            newProd.price = sellingPrice;
                            newProd.costPrice = costPrice;
                            newProd.stock = (parseInt(newProd.stock) || 0) + stock;
                            newProd.minStock = minStock;
                        }
                        newProd.category = category;
                        newProd.unit = unit;
                        if (newProd.expiryDays !== expiryDays) {
                            newProd.expiryDays = expiryDays;
                            newProd.expiryDate = expiryDate;
                        }
                        newProd.hsn = hsn;
                        newProd.gstRate = gstRate;
                        newProd.productDiscount = productDiscount;
                        if (desc) newProd.description = desc;
                        if (supplier) newProd.supplier = supplier;
                        if (packSizes.length > 0) newProd.packSizes = packSizes;
                        if (imageBase64) newProd.image = imageBase64;
                        
                        if (hasVariants) {
                            if (!newProd.variants) newProd.variants = [];
                            newProd.variants.push(...currentNewProductVariants);
                        }
                    } else {
                        // Create new
                        newProd = {
                            id: Date.now(),
                            barcode: hasVariants ? '' : (barcode || 'Manual-' + Date.now()),
                            name: name,
                            category: category,
                            unit: unit,
                            expiryDays: expiryDays,
                            expiryDate: expiryDate,
                            price: hasVariants ? 0 : sellingPrice,
                            costPrice: hasVariants ? 0 : costPrice,
                            productDiscount: productDiscount,
                            hsn: hsn,
                            gstRate: gstRate,
                            stock: hasVariants ? 0 : stock,
                            minStock: hasVariants ? 0 : minStock,
                            description: desc,
                            supplier: supplier,
                            packSizes: packSizes,
                            image: imageBase64,
                            isFavourite: false
                        };
                        if (hasVariants) {
                            newProd.variants = [...currentNewProductVariants];
                        }
                        products.push(newProd);
                    }

                    console.log('Product saved:', newProd);
                    saveData();
                    updateProductsTable();



                    // Select this product for purchase
                    selectedPurchaseProduct = newProd;
                    const searchInput = document.getElementById('purchaseSearchInput');
                    if (searchInput) searchInput.value = newProd.name;

                    const searchResults = document.getElementById('purchaseSearchResults');
                    if (searchResults) searchResults.style.display = 'none';

                    hidePurchaseAddNewProductForm();

                    // Show selection area
                    const selectionArea = document.getElementById('purchaseSelectedProduct');
                    if (selectionArea) selectionArea.style.display = 'flex';

                    const prodNameDisplay = document.getElementById('purchaseProductName');
                    if (prodNameDisplay) prodNameDisplay.textContent = newProd.name;

                    const stockDisplay = document.getElementById('purchaseCurrentStock');
                    if (stockDisplay) stockDisplay.textContent = newProd.stock || 0;

                    const priceInput = document.getElementById('purchaseItemPrice');
                    // Default to Cost Price
                    if (priceInput) priceInput.value = newProd.costPrice || 0;

                    const gstInput = document.getElementById('purchaseItemGST');
                    if (gstInput) gstInput.value = newProd.gstRate || 0;

                    const qtyInput = document.getElementById('purchaseQty');
                    if (qtyInput) qtyInput.value = 1;

                    showAlert('Product Created & Selected!', '✅');

                    if (window.isAddingFromSale) {
                        window.isAddingFromSale = false;
                        closePurchaseModal();
                        
                        // Wait for modal transition then select it in Record Sale
                        setTimeout(() => {
                            const searchEl = document.getElementById('saleProductSearch');
                            if (searchEl) searchEl.value = newProd.name;
                            populateSaleProductSelect(newProd.name);
                            
                            setTimeout(() => {
                                const saleProductSelect = document.getElementById('saleProduct');
                                if (saleProductSelect) {
                                    saleProductSelect.value = newProd.id;
                                    onSaleProductChange();
                                }
                            }, 100);
                        }, 300);
                    } else if (window.isAddingFromInventory) {
                        window.isAddingFromInventory = false;
                        closePurchaseModal();
                        togglePurchaseBillElements(true);
                    }
                };

                if (maxSimilarity >= 0.65) {
                    showConfirm(
                        `Similar Product Found!\n"${similarProduct.name}" is ${(maxSimilarity * 100).toFixed(0)}% similar to "${name}".\n\nDo you want to add it anyway?`,
                        proceedToAdd,
                        () => {
                            console.log('Add product cancelled due to similarity');
                        },
                        '⚠️'
                    );
                } else {
                    proceedToAdd();
                }

            } catch (error) {
                console.error(error);
                alert('Error adding product: ' + error.message + ' Stack: ' + error.stack);
            }
        }

        // --- Purchase History Functions ---
        function openPurchaseHistoryModal() {
            console.log('Opening Purchase History Modal');
            try {
                // Default to Monthly functionality if function exists, else simple render
                if (typeof resetPurchaseHistoryFilters === 'function') {
                    resetPurchaseHistoryFilters();
                } else {
                    renderPurchaseHistory();
                }
                document.getElementById('purchaseHistoryModal').style.display = 'flex';
            } catch (e) {
                console.error('Error opening history:', e);
                alert('Error opening history: ' + e.message);
            }
        }

        function resetPurchaseHistoryFilters() {
            // Default to current month and year
            const now = new Date();
            const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
            const currentYear = String(now.getFullYear());

            if (document.getElementById('phFilterMonth')) document.getElementById('phFilterMonth').value = currentMonth;
            if (document.getElementById('phFilterYear')) document.getElementById('phFilterYear').value = currentYear;
            if (document.getElementById('phSearchInput')) document.getElementById('phSearchInput').value = '';

            renderPurchaseHistory();
        }

        function closePurchaseHistoryModal() {
            document.getElementById('purchaseHistoryModal').style.display = 'none';
        }

        function exportPurchaseHistory() {
            if (!purchases || purchases.length === 0) {
                showAlert('No history to export!', 'warning');
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Date,Invoice Number,Supplier,Supplier Phone,Items Count,Subtotal,Discount,Other Charges,Total Amount,Notes\n";

            purchases.forEach(p => {
                const row = [
                    p.date,
                    p.invoiceNumber,
                    `"${p.supplier}"`, // Handle commas in name
                    p.supplierPhone || '',
                    p.items ? p.items.length : 0,
                    p.subtotal,
                    p.discount,
                    p.otherCharges,
                    p.totalAmount,
                    `"${p.notes || ''}"`
                ].join(",");
                csvContent += row + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "purchase_history_export.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function printPurchaseBill() {
            const printContent = document.querySelector("#purchaseDetailsModal .modal-content").innerHTML;

            // Remove footer buttons from print
            const printWindow = window.open('', '', 'height=800,width=800');
            printWindow.document.write('<html><head><title>Purchase Invoice</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-print-color-adjust: exact; padding: 20px; }
                .table { margin: 0; width: 100%; border-collapse: collapse; }
                .table th, .table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                /* Hide buttons in print */
                button, .admin-only { display: none !important; }
                /* Ensure background colors print */
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            `);
            printWindow.document.write('</style></head><body>');
            printWindow.document.write(printContent);
            printWindow.document.write('</body></html>');
            printWindow.document.close();

            // Wait for resources to load
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }

        function renderPurchaseHistory() {
            try {
                const tbody = document.getElementById('purchaseHistoryTableBody');
                if (!tbody) {
                    console.error('purchaseHistoryTableBody not found');
                    return;
                }

                // Get Filter Values (Month & Year)
                const monthInput = document.getElementById('phFilterMonth');
                const yearInput = document.getElementById('phFilterYear');

                let selectedMonth = monthInput ? monthInput.value : '';
                let selectedYear = yearInput ? yearInput.value : '';

                // If undefined or empty, set defaults
                const now = new Date();
                if (!selectedMonth) {
                    selectedMonth = String(now.getMonth() + 1).padStart(2, '0');
                    if (monthInput) monthInput.value = selectedMonth;
                }
                if (!selectedYear) {
                    selectedYear = String(now.getFullYear());
                    if (yearInput) yearInput.value = selectedYear;
                }

                // Target YYYY-MM
                const targetMonthStr = selectedYear + '-' + selectedMonth;

                const search = document.getElementById('phSearchInput') ? document.getElementById('phSearchInput').value.toLowerCase().trim() : '';

                let savedPurchases = JSON.parse(localStorage.getItem('purchases')) || [];

                // Filter Logic
                const filteredPurchases = savedPurchases.filter(pc => {
                    let matchesDate = false;
                    let matchesSearch = true;

                    // Month Check
                    if (pc.date) {
                        const pcDate = new Date(pc.date);
                        // Convert pcDate to YYYY-MM
                        const pcMonthStr = pcDate.getFullYear() + '-' + String(pcDate.getMonth() + 1).padStart(2, '0');
                        if (pcMonthStr === targetMonthStr) {
                            matchesDate = true;
                        }
                    }

                    // Search Filter
                    if (search) {
                        const invoice = (pc.invoiceNumber || '').toLowerCase();
                        const supplier = (pc.supplier || '').toLowerCase();
                        const dateStr = (pc.date || '').toLowerCase();
                        matchesSearch = invoice.includes(search) || supplier.includes(search) || dateStr.includes(search);
                    }

                    return matchesDate && matchesSearch;
                });

                // Calculate Total
                const totalAmount = filteredPurchases.reduce((sum, pc) => sum + (parseFloat(pc.totalAmount) || 0), 0);
                const totalDisplay = document.getElementById('phTotalAmount');
                if (totalDisplay) {
                    totalDisplay.textContent = totalAmount.toFixed(2);
                }

                if (filteredPurchases.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6c757d;">No matching records found for ' + monthInput.options[monthInput.selectedIndex].text + ' ' + selectedYear + '</td></tr>';
                    return;
                }

                // Sort by date desc (newest first)
                filteredPurchases.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

                // Render List View
                tbody.innerHTML = filteredPurchases.map(pc => renderPurchaseRow(pc)).join('');

                updateUIForRole();
            } catch (error) {
                console.error('Error rendering purchase history:', error);
                const tbody = document.getElementById('purchaseHistoryTableBody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading history</td></tr>';
            }
        }

        function renderPurchaseRow(pc) {
            const items = Array.isArray(pc.items) ? pc.items : [];
            const itemCount = items.reduce((acc, item) => acc + (parseInt(item.qty) || 0), 0);
            const deleteBtn = window.isUserAdmin ?
                `<button class="btn btn-danger btn-sm" onclick="deletePurchase(${pc.id})">🗑️</button>` : '';
                
            let supplierDisplay = pc.supplier || '-';
            if (pc.supplierId) {
                const sup = suppliers.find(s => s.id === pc.supplierId);
                if (sup) supplierDisplay = sup.name;
            }

            return `
                <tr>
                    <td>${pc.date || 'N/A'}</td>
                    <td>${pc.invoiceNumber || '-'}</td>
                    <td>${supplierDisplay}</td>
                    <td>${itemCount} Items</td>
                    <td>₹${(pc.totalAmount || 0).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="viewPurchaseDetails(${pc.id})">👁️ View</button>
                        ${deleteBtn}
                    </td>
                </tr>
            `;
        }

        function deletePurchase(id) {
            if (!window.isUserAdmin) return showAlert('Unauthorized: Only Administrators can delete data.', 'error');
            showConfirm('Are you sure you want to delete this purchase record?\nInventory adjustment is NOT handled automatically.', () => {
                let savedPurchases = JSON.parse(localStorage.getItem('purchases')) || [];
                savedPurchases = savedPurchases.filter(p => p.id !== id);
                localStorage.setItem('purchases', JSON.stringify(savedPurchases));
                purchases = savedPurchases;

                // Refresh views
                renderPurchaseHistory();
                closePurchaseDetailsModal(); // Close details if open

                showAlert('Purchase record deleted successfully.', '🗑️');
            });
        }

        function viewPurchaseDetails(id) {
            try {
                const savedPurchases = JSON.parse(localStorage.getItem('purchases')) || [];
                const pc = savedPurchases.find(p => p.id === id);
                if (!pc) return;

                const setText = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = val || '-';
                };

                let supplierName = pc.supplier;
                let supplierPhone = pc.supplierPhone;
                let supplierAddress = pc.supplierAddress;
                
                if (pc.supplierId) {
                    const sup = suppliers.find(s => s.id === pc.supplierId);
                    if (sup) {
                        supplierName = sup.name;
                        supplierPhone = sup.phone || pc.supplierPhone;
                        supplierAddress = sup.address || pc.supplierAddress;
                    }
                }

                setText('detailSupplier', supplierName);
                setText('detailSupplierPhone', supplierPhone);
                setText('detailSupplierAddress', supplierAddress);
                setText('detailInvoice', pc.invoiceNumber);
                setText('detailDate', pc.date);
                setText('detailNotes', pc.notes);

                const tbody = document.getElementById('detailTableBody');
                const items = Array.isArray(pc.items) ? pc.items : [];
                tbody.innerHTML = items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.name}</td>
                    <td>${item.qty}</td>
                    <td>₹${(item.price || 0).toFixed(2)}</td>
                    <td>₹${(item.total || 0).toFixed(2)}</td>
                </tr>
             `).join('');

                if (items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No items in this record</td></tr>';
                }

                document.getElementById('detailSubtotal').textContent = (pc.subtotal || 0).toFixed(2);
                document.getElementById('detailDiscount').textContent = (pc.discount || 0).toFixed(2);
                document.getElementById('detailOtherCharges').textContent = (pc.otherCharges || 0).toFixed(2);
                document.getElementById('detailGrandTotal').textContent = (pc.totalAmount || 0).toFixed(2);

                const deleteBtn = document.getElementById('deletePurchaseBtn');
                if (deleteBtn) {
                    deleteBtn.onclick = () => deletePurchase(pc.id);
                    deleteBtn.style.display = ''; // Ensure it's not hidden by inline style, class handles role
                }

                document.getElementById('purchaseDetailsModal').style.display = 'flex';
                updateUIForRole();
            } catch (error) {
                console.error('Error viewing details:', error);
                alert('Error viewing details: ' + error.message);
            }
        }

        function closePurchaseDetailsModal() {
            document.getElementById('purchaseDetailsModal').style.display = 'none';
        }

        function switchTab(tabName, clickedNav = null) {
            if (tabName === 'settings' && typeof window.isUserAdmin !== 'undefined' && !window.isUserAdmin) {
                alert('🔒 Access Denied\nYou do not have permission to access this module.');
                return;
            }

            const tabPermissionMap = {
                'dashboard': 'dashboard',
                'inventory': 'inventory',
                'sales': 'record_sale',
                'reports': 'reports',
                'products': 'products',
                'pettycash': 'petty_cash',
                'denomination': 'day_closing',
                'calculator': 'calculator',
                'purchaseparties': 'purchase_entry'
            };

            const requiredPerm = tabPermissionMap[tabName];
            if (tabName !== 'settings' && requiredPerm && window.hasPermission && !window.hasPermission(requiredPerm) && !window.isUserAdmin) {
                alert('🔒 Access Denied\nYou do not have permission to access this module.');
                
                // Find first allowed tab
                let firstAllowed = null;
                document.querySelectorAll('.nav-tab').forEach(nav => {
                    const id = nav.dataset.tab;
                    if (id === 'settings' && window.isUserAdmin && !firstAllowed) firstAllowed = id;
                    const req = tabPermissionMap[id];
                    if (req && (window.isUserAdmin || window.hasPermission(req))) {
                        if (!firstAllowed) firstAllowed = id;
                    }
                });
                
                if (firstAllowed && firstAllowed !== tabName) {
                    switchTab(firstAllowed);
                }
                return;
            }

            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
                tab.style.display = 'none'; // Ensure hidden
            });

            // Remove active class from all nav tabs
            document.querySelectorAll('.nav-tab').forEach(nav => {
                nav.classList.remove('active');
            });

            // Show selected tab
            const activeTab = document.getElementById(tabName);
            if (activeTab) {
                activeTab.classList.add('active');
                activeTab.style.display = 'block'; // Force display to ensure visibility
                
                // Specific tab initializations
                if (tabName === 'inventory') {
                    if (typeof updateInventoryTable === 'function') updateInventoryTable();
                    setTimeout(() => {
                        const searchInput = document.getElementById('stockBarcode');
                        if (searchInput) {
                            searchInput.focus();
                            searchInput.select();
                        }
                    }, 50);
                }
                if (tabName === 'reports' && typeof generateSalesChart === 'function') generateSalesChart();
                if (tabName === 'products' && typeof renderProductTable === 'function') renderProductTable();
                if (tabName === 'receivables' && typeof renderReceivablesTable === 'function') renderReceivablesTable();
                if (tabName === 'payables' && typeof renderPayablesTable === 'function') renderPayablesTable();
                if (tabName === 'pettycash' && typeof initPettyCash === 'function') initPettyCash();
                if (tabName === 'denomination' && typeof updateDayClosingDisplay === 'function') updateDayClosingDisplay();
                if (tabName === 'denomination') {
                    setTimeout(() => {
                        const input500 = document.getElementById('denom_qty_500');
                        if (input500) { input500.focus(); input500.select(); }
                    }, 50);
                }
                
                if (tabName === 'sales') {
                    // Aggressively attempt to focus the Search Product field (solves edge-case race conditions on load/tab switch)
                    let focusAttempts = 0;
                    const focusInterval = setInterval(() => {
                        const searchInput = document.getElementById('saleProductSearch');
                        if (searchInput) {
                            searchInput.focus();
                            searchInput.select();
                        }
                        focusAttempts++;
                        // Stop trying if we successfully focused it, or if we've tried 5 times (500ms)
                        if (focusAttempts >= 5 || (document.activeElement && document.activeElement.id === 'saleProductSearch')) {
                            clearInterval(focusInterval);
                        }
                    }, 100);
                }
            } else {
                console.warn(`Tab "${tabName}" not found`);
            }

            // Add active class to clicked nav tab
            if (clickedNav && clickedNav.classList) {
                clickedNav.classList.add('active');
            } else {
                const fallbackNav = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
                if (fallbackNav) {
                    fallbackNav.classList.add('active');
                } else if (tabName === 'receivables' || tabName === 'payables') {
                    const prodNav = document.querySelector(`.nav-tab[data-tab="purchaseparties"]`);
                    if (prodNav) prodNav.classList.add('active');
                }
            }

            // Refresh data for the selected tab
            // Refresh data for the selected tab with Error Handling
            try {
                if (tabName === 'dashboard') {
                    updateDashboard();
                } else if (tabName === 'inventory') {
                    updateInventoryTable();
                } else if (tabName === 'sales') {
                    populateSaleProductSelect();
                    updateTodaysSales();
                    updateCartDisplay();
                    updateDraftsDisplay();
                } else if (tabName === 'reports') {
                    generateReports();
                } else if (tabName === 'products') {
                    // Safe logic for products table
                    if (typeof updateProductsTable === 'function') {
                        updateProductsTable();
                    } else {
                        console.error("updateProductsTable function is missing!");
                    }
                }
            } catch (error) {
                console.error(`❌ Error updating tab "${tabName}":`, error);
                // Don't alert user, just log, so UI doesn't break
            }
        }

        // Scanner Functions (Modal only - used in other tabs)

        function openScannerModal(mode) {
            if (modalScanner) return; // Prevent multiple instances
            currentScanMode = mode;
            document.getElementById('scannerModal').classList.add('active');

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            };

            modalScanner = new Html5Qrcode("modal-scanner-region");

            const cameraConfig = { facingMode: "environment" };

            modalScanner.start(
                cameraConfig,
                config,
                (decodedText, decodedResult) => {
                    handleModalScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Handle scan error silently
                }
            ).catch(err => {
                console.error("Error starting scanner:", err);
                modalScanner = null; // Reset scanner on failure
                showAlert("Unable to access camera. You can still enter the barcode manually.", '📷');
                closeScannerModal();
            });
        }

        function closeScannerModal() {
            // Close modal immediately
            document.getElementById('scannerModal').classList.remove('active');
            currentScanMode = '';

            // Clean up scanner if it exists
            if (modalScanner) {
                // Use a timeout to prevent hanging if stop() fails
                const stopTimeout = setTimeout(() => {
                    console.warn('Scanner stop timed out, forcing cleanup');
                    modalScanner = null;
                }, 1000);

                modalScanner.stop().then(() => {
                    clearTimeout(stopTimeout);
                    modalScanner.clear();
                    modalScanner = null;
                }).catch((err) => {
                    clearTimeout(stopTimeout);
                    console.error(`Unable to stop scanning: ${err}`);
                    modalScanner = null;
                });
            }
        }

        function handleModalScanSuccess(barcode) {
            playBeep();

            if (currentScanMode === 'product') {
                document.getElementById('productBarcode').value = barcode;
            } else if (currentScanMode === 'sale') {
                document.getElementById('quickSaleBarcode').value = barcode;
                loadProductByBarcode(barcode, 'sale');
            } else if (currentScanMode === 'stock') {
                document.getElementById('stockBarcode').value = barcode;
                loadProductByBarcode(barcode, 'stock');
            } else if (currentScanMode === 'newProduct') {
                document.getElementById('newProductBarcode').value = barcode;
            } else if (currentScanMode === 'editProduct') {
                document.getElementById('editProductBarcode').value = barcode;
            } else if (currentScanMode === 'purchase') {
                document.getElementById('purchaseSearchInput').value = barcode;
                searchPurchaseProduct(barcode);
            }

            closeScannerModal();
        }

        function loadProductByBarcode(barcode, mode) {
            let foundProduct = null;
            let foundVariant = null;

            for (let p of products) {
                if (p.barcode === barcode) {
                    foundProduct = p;
                    break;
                }
                if (window.hasVariants(p)) {
                    let v = p.variants.find(v => v.barcode === barcode);
                    if (v) {
                        foundProduct = p;
                        foundVariant = v;
                        break;
                    }
                }
            }

            if (foundProduct) {
                if (mode === 'sale') {
                    let effStock = foundVariant ? (foundVariant.stock || 0) : (foundProduct.stock || 0);
                    if (effStock <= 0) {
                        showAlert(`Product ${window.getVariantDisplayName(foundProduct, foundVariant)} is out of stock!`, '❌');
                        document.getElementById('quickSaleBarcode').value = '';
                        return;
                    }
                    selectBarcodeProduct(foundProduct, foundVariant);
                } else if (mode === 'stock') {
                    selectStockBarcodeProduct(foundProduct, foundVariant);
                }
            } else {
                showAlert(`Product with barcode ${barcode} not found. Please add it first.`, '⚠️');
            }
        }


        function quickAddToSale(barcode) {
            let foundProduct = null;
            let foundVariant = null;

            for (let p of products) {
                if (p.barcode === barcode) {
                    foundProduct = p;
                    break;
                }
                if (window.hasVariants(p)) {
                    let v = p.variants.find(v => v.barcode === barcode);
                    if (v) {
                        foundProduct = p;
                        foundVariant = v;
                        break;
                    }
                }
            }
            if (foundProduct) {
                switchTab('sales');
                setTimeout(() => {
                    onSaleProductChange(foundProduct.id, foundVariant ? foundVariant.id : null);
                }, 100);
            }
        }

        function addNewProductWithBarcode(barcode) {
            document.getElementById('productBarcode').value = barcode;
            switchTab('products');
        }

        function playBeep() {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 1000;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        }


        // (stockBarcode logic moved to combobox autocomplete)
        
        function startNewPO() {
            if (poCart.length > 0) {
                // If items in cart, open modal without clearing
                openPOModal(false);
            } else {
                // Start fresh
                openPOModal(true);
            }
        }

        // Rest of the original functions remain the same...
        function calculateNetTotal(salesArray) {
            const uniqueSales = {};
            let newTotalDiscount = 0;
            let newTotalRevenue = 0;
            
            salesArray.forEach(sale => {
                if (sale.hasOwnProperty('billDiscount')) {
                    // New data structure: exactly sum the item-level totals and discounts
                    newTotalRevenue += (sale.total || 0);
                    newTotalDiscount += (sale.discount || 0);
                } else {
                    // Old data structure: group by saleId to avoid duplicating the bill discount
                    if (!uniqueSales[sale.saleId]) {
                        uniqueSales[sale.saleId] = {
                            total: 0,
                            discount: sale.discount || 0
                        };
                    }
                    uniqueSales[sale.saleId].total += (sale.total || 0);
                }
            });

            const oldNetTotal = Object.values(uniqueSales).reduce((sum, sale) => {
                return sum + (sale.total - sale.discount);
            }, 0);

            return oldNetTotal + (newTotalRevenue - newTotalDiscount);
        }

        function updateDashboard() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const weekStart = new Date(today);
            // Standardize to Monday start
            const dayOfWeek = weekStart.getDay(); // 0 (Sun) - 6 (Sat)
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            weekStart.setDate(today.getDate() - diffToMonday);

            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            const todaySales = sales.filter(sale => {
                const saleDate = new Date(sale.date);
                saleDate.setHours(0, 0, 0, 0);
                return saleDate.getTime() === today.getTime();
            });

            const weekSales = sales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= weekStart;
            });

            const monthSales = sales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= monthStart;
            });

            document.getElementById('todaySalesAmount').textContent = '₹' + calculateNetTotal(todaySales).toFixed(2);
            document.getElementById('todaySalesCount').textContent = new Set(todaySales.map(s => s.saleId)).size + ' transactions';

            document.getElementById('weekSalesAmount').textContent = '₹' + calculateNetTotal(weekSales).toFixed(2);
            document.getElementById('weekSalesCount').textContent = new Set(weekSales.map(s => s.saleId)).size + ' transactions';

            document.getElementById('monthSalesAmount').textContent = '₹' + calculateNetTotal(monthSales).toFixed(2);
            document.getElementById('monthSalesCount').textContent = new Set(monthSales.map(s => s.saleId)).size + ' transactions';

            document.getElementById('totalProducts').textContent = products.length;

            let totalOutstanding = 0;
            customers.forEach(c => {
                const bal = calculatePartyLedgerBalance(c, 'customer').balance;
                totalOutstanding += bal;
            });
            document.getElementById('dashboardOutstandingAmount').textContent = '₹' + totalOutstanding.toFixed(2);

            updateLowStockAlert();
            updateRecentSales();
        }

        function updateLowStockAlert() {
            const lowStockProducts = products.filter(p => p.stock <= p.minStock);
            const alertDiv = document.getElementById('lowStockAlert');

            if (!alertDiv) return; // Prevent crash if element missing

            if (lowStockProducts.length > 0) {
                let html = '<div class="alert alert-warning">⚠️ Low Stock Warning: ';
                html += lowStockProducts.map(p => `${p.name} (${p.stock} units)`).join(', ');
                html += '</div>';
                alertDiv.innerHTML = html;
            } else {
                alertDiv.innerHTML = '<div class="alert" style="background: #d4edda; color: #155724; border: 1px solid #c3e6cb;">✓ All products have sufficient stock</div>';
            }
        }

        function updateRecentSales() {
            const tbody = document.getElementById('recentSalesBody');

            if (!tbody) return; // Prevent crash if element missing

            const recentSales = sales.slice(-20).reverse(); // Get more items to ensure we have enough unique bills

            if (recentSales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #6c757d;">No sales recorded yet</td></tr>';
                return;
            }

            // Group sales by saleId to show Bills instead of Items
            const bills = {};
            recentSales.forEach(sale => {
                if (!bills[sale.saleId]) {
                    bills[sale.saleId] = {
                        saleId: sale.saleId,
                        date: sale.date,
                        items: [],
                        total: 0,
                        discount: sale.hasOwnProperty('billDiscount') ? (sale.billDiscount || 0) : (sale.discount || 0)
                    };
                }
                bills[sale.saleId].items.push(`${sale.productName} (${sale.quantity})`);
                bills[sale.saleId].total += sale.total; // Sum up totals for the bill
            });

            // Convert to array and sort by date (newest first)
            const recentBills = Object.values(bills).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

            if (recentBills.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #6c757d;">No sales recorded yet</td></tr>';
                return;
            }

            tbody.innerHTML = recentBills.map(bill => {
                const finalTotal = bill.total - bill.discount;
                return `
                <tr>
                    <td>${new Date(bill.date).toLocaleString()}</td>
                    <td>
                        <div style="max-height: 60px; overflow-y: auto; font-size: 0.9em;">
                            ${bill.items.join('<br>')}
                        </div>
                    </td>
                    <td><strong>₹${finalTotal.toFixed(2)}</strong></td>
                    <td>
                        <button class="btn btn-warning btn-sm admin-only" onclick="editSale(${bill.saleId})">✏️</button>
                        <button class="btn btn-danger btn-sm admin-only" onclick="deleteSale(${bill.saleId})">🗑️</button>
                    </td>
                </tr>
            `}).join('');

            // Re-apply role-based UI
            updateUIForRole();
        }

        // Inventory Sorting State
        let currentSortColumn = null;
        let currentSortDirection = 'asc';

        function sortInventory(column) {
            // Toggle direction if clicking the same column
            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'asc';
            }

            // Update sort indicators
            document.querySelectorAll('thead th span').forEach(span => span.textContent = '');
            const indicator = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
            const spanId = 'sort-' + column;
            const span = document.getElementById(spanId);
            if (span) span.textContent = indicator;

            // Refresh table
            if (document.getElementById('inventorySearch').value) {
                filterInventoryTable();
            } else {
                updateInventoryTable();
            }
        }

        function getSortedProducts(productsList) {
            if (!currentSortColumn) return productsList;

            return [...productsList].sort((a, b) => {
                let valA, valB;

                switch (currentSortColumn) {
                    case 'barcode':
                        valA = (a.barcode || '').toLowerCase();
                        valB = (b.barcode || '').toLowerCase();
                        break;
                    case 'name':
                        valA = a.name.toLowerCase();
                        valB = b.name.toLowerCase();
                        break;
                    case 'category':
                        valA = (a.category || '').toLowerCase();
                        valB = (b.category || '').toLowerCase();
                        break;
                    case 'expiryDate':
                        valA = a.expiryDate ? new Date(a.expiryDate).getTime() : 9999999999999;
                        valB = b.expiryDate ? new Date(b.expiryDate).getTime() : 9999999999999;
                        break;
                    case 'stock':
                        valA = a.stock;
                        valB = b.stock;
                        break;
                    case 'price':
                        valA = a.price;
                        valB = b.price;
                        break;
                    case 'discount':
                        valA = (a.productDiscount !== undefined && a.productDiscount !== null && a.productDiscount !== "") ? parseFloat(a.productDiscount) : -1;
                        valB = (b.productDiscount !== undefined && b.productDiscount !== null && b.productDiscount !== "") ? parseFloat(b.productDiscount) : -1;
                        break;
                    case 'totalValue':
                        valA = a.stock * a.price;
                        valB = b.stock * b.price;
                        break;
                    case 'status':
                        // Sort by stock level for status (Low/Out first or last)
                        valA = a.stock;
                        valB = b.stock;
                        break;
                    default:
                        return 0;
                }

                if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        function updateInventoryTable() {
            if (typeof window.inventorySelectedIndex !== 'undefined') window.inventorySelectedIndex = -1;
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const tbody = document.getElementById('inventoryTableBody');
            if (!tbody) return; // Prevent crash if element missing

            const searchInput = document.getElementById('inventorySearch');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

            // Note: Category and Stock filters are not currently in the UI for this section, 
            // so we default to showing all matching the search term.

            const expiryFilterEl = document.getElementById('expiryFilter');
            const expiryFilter = expiryFilterEl ? expiryFilterEl.value : 'all';

            const today = new Date();
            today.setHours(0,0,0,0);
            const next7 = new Date(today);
            next7.setDate(today.getDate() + 7);
            const next30 = new Date(today);
            next30.setDate(today.getDate() + 30);

            // Filter Logic
            const searchMatchedProducts = searchProductsUnified(searchTerm, products);
            const filteredProducts = searchMatchedProducts.filter(product => {
                if (expiryFilter === 'all') return true;

                if (expiryFilter === 'no_expiry') return !product.expiryDate;

                if (!product.expiryDate) return false; // Other filters require expiryDate

                const exp = new Date(product.expiryDate);
                exp.setHours(0,0,0,0);

                if (expiryFilter === 'expired') return exp < today;
                if (expiryFilter === 'today') return exp.getTime() === today.getTime();
                if (expiryFilter === '7days') return exp >= today && exp <= next7;
                if (expiryFilter === '30days') return exp >= today && exp <= next30;

                return true;
            });

            if (filteredProducts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No matching products found</td></tr>';
                return;
            }

            // Use existing sort function
            const sortedProducts = getSortedProducts(filteredProducts);

            tbody.innerHTML = sortedProducts.map(product => {
                let displayDiscount = '<span style="color:#aaa;">—</span>';
                if (product.productDiscount !== undefined && product.productDiscount !== null && product.productDiscount !== "") {
                    displayDiscount = '<strong>' + product.productDiscount + '%</strong>';
                }

                let expiryDisplay = '—';
                if (product.expiryDate) {
                    const exp = new Date(product.expiryDate);
                    exp.setHours(0,0,0,0);
                    const formattedDate = String(exp.getDate()).padStart(2, '0') + '/' + String(exp.getMonth() + 1).padStart(2, '0') + '/' + exp.getFullYear();
                    expiryDisplay = `${formattedDate}`;
                }

                if (window.hasVariants(product)) {
                    let rows = '';
                    // Determine if parent has its own meaningful inventory (stock > 0 or price > 0 or barcode)
                    const parentHasOwnInventory = (product.stock > 0) || (product.price > 0) || product.barcode;
                    
                    if (parentHasOwnInventory) {
                        let pStock = product.stock || 0;
                        let pMinStock = product.minStock || 0;
                        let pStockStatus = pStock <= 0 ? 'stock-low' : (pStock <= pMinStock ? 'stock-low' : 'stock-ok');
                        let pStatusText = pStock <= 0 ? '🔴 Out of Stock' : (pStock <= pMinStock ? '🟡 Low Stock' : '🟢 In Stock');
                        let pTotalValue = ((product.price || 0) * pStock).toFixed(2);
                        rows += `
                        <tr data-product-id="${product.id}">
                            <td>${product.barcode || 'N/A'}</td>
                            <td>${product.name}</td>
                            ${settings.gstEnabled ? `<td>${product.hsn || ''}</td><td>${product.gstRate || 0}%</td>` : ''}
                            <td>${product.category || 'Uncategorized'}</td>
                            <td class="expiry-tracking-feature">${expiryDisplay}</td>
                            <td class="${pStockStatus}">${pStock}</td>
                            <td>₹${(product.price || 0).toFixed(2)}</td>
                            <td>${displayDiscount}</td>
                            <td>₹${pTotalValue}</td>
                            <td class="${pStockStatus}">${pStatusText}</td>
                            <td>
                                <button class="btn btn-info btn-sm" onclick="openAddVariantModal('${product.id}')" title="Add Variant" style="margin-right: 2px;">+ Variant</button>
                                <button class="btn btn-info btn-sm" onclick="addToPOFromInventory('${product.id}')" title="PO">PO</button>
                                ${window.hasPermission('product_add_edit') ? `<button class="btn btn-warning btn-sm" onclick="editInventoryProduct('${product.id}')" title="Edit">Edit</button>` : ''}
                                ${window.hasPermission('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteInventoryProduct('${product.id}')" title="Delete">Del</button>` : ''}
                            </td>
                        </tr>`;
                    } else {
                        // Variant-only parent: show a lightweight header row with + Variant action
                        rows += `
                        <tr data-product-id="${product.id}" style="background-color: #f8f9fa;">
                            <td style="color:#999;">—</td>
                            <td><strong>${product.name}</strong> <span style="color:#888; font-size:12px;">(${product.variants.length} variant${product.variants.length > 1 ? 's' : ''})</span></td>
                            ${settings.gstEnabled ? `<td>${product.hsn || ''}</td><td>${product.gstRate || 0}%</td>` : ''}
                            <td>${product.category || 'Uncategorized'}</td>
                            <td class="expiry-tracking-feature">—</td>
                            <td>—</td>
                            <td>—</td>
                            <td>—</td>
                            <td>—</td>
                            <td>—</td>
                            <td>
                                <button class="btn btn-info btn-sm" onclick="openAddVariantModal('${product.id}')" title="Add Variant" style="margin-right: 2px;">+ Variant</button>
                                ${window.hasPermission('product_add_edit') ? `<button class="btn btn-warning btn-sm" onclick="editInventoryProduct('${product.id}')" title="Edit">Edit</button>` : ''}
                                ${window.hasPermission('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteInventoryProduct('${product.id}')" title="Delete">Del</button>` : ''}
                            </td>
                        </tr>`;
                    }

                    // Render each variant as an independent flat row
                    product.variants.forEach(v => {
                        let vStock = parseInt(v.stock) || 0;
                        let vMinStock = parseInt(v.minimumStock) || 0;
                        let stockStatus = vStock <= 0 ? 'stock-low' : (vStock <= vMinStock ? 'stock-low' : 'stock-ok');
                        let statusText = vStock <= 0 ? '🔴 Out of Stock' : (vStock <= vMinStock ? '🟡 Low Stock' : '🟢 In Stock');
                        let totalValue = ((v.sellingPrice || 0) * vStock).toFixed(2);
                        let vDisplayName = window.getVariantDisplayName(product, v);
                        rows += `
                        <tr data-product-id="${product.id}" data-variant-id="${v.id}">
                            <td>${v.barcode || '-'}</td>
                            <td>${vDisplayName}</td>
                            ${settings.gstEnabled ? `<td>${product.hsn || ''}</td><td>${product.gstRate || 0}%</td>` : ''}
                            <td>${product.category || 'Uncategorized'}</td>
                            <td class="expiry-tracking-feature">—</td>
                            <td class="${stockStatus}">${vStock}</td>
                            <td>₹${(v.sellingPrice || 0).toFixed(2)}</td>
                            <td>—</td>
                            <td>₹${totalValue}</td>
                            <td class="${stockStatus}">${statusText}</td>
                            <td>
                                <button class="btn btn-info btn-sm" onclick="addToPOFromInventory('${product.id}','${v.id}')" title="PO">PO</button>
                                ${window.hasPermission('product_add_edit') ? `<button class="btn btn-warning btn-sm" onclick="editInventoryVariant('${product.id}','${v.id}')" title="Edit">Edit</button>` : ''}
                                ${window.hasPermission('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteInventoryVariant('${product.id}','${v.id}')" title="Delete">Del</button>` : ''}
                            </td>
                        </tr>`;
                    });

                    return rows;
                } else {
                    let stockStatus = '';
                    let statusText = '';
                    if (product.stock <= 0) {
                        stockStatus = 'stock-low';
                        statusText = '🔴 Out of Stock';
                    } else if (product.stock <= product.minStock) {
                        stockStatus = 'stock-low';
                        statusText = '🟡 Low Stock';
                    } else {
                        stockStatus = 'stock-ok';
                        statusText = '🟢 In Stock';
                    }
                    const totalValue = (product.price * product.stock).toFixed(2);
                    
                    return `
                    <tr data-product-id="${product.id}" onclick="if(window.selectInventoryRowKeyboard) window.selectInventoryRowKeyboard('${product.id}')">
                        <td>${product.barcode || 'N/A'}</td>
                        <td>${product.name}</td>
                        ${settings.gstEnabled ? `<td>${product.hsn || ''}</td>` : ''}
                        ${settings.gstEnabled ? `<td>${product.gstRate || 0}%</td>` : ''}
                        <td>${product.category || 'Uncategorized'}</td>
                        <td class="expiry-tracking-feature">${expiryDisplay}</td>
                        <td class="${stockStatus}">${product.stock}</td>
                        <td>₹${product.price.toFixed(2)}</td>
                        <td>${displayDiscount}</td>
                        <td>₹${totalValue}</td>
                        <td class="${stockStatus}">${statusText}</td>
                        <td>
                            <button class="btn btn-info btn-sm" onclick="addToPOFromInventory('${product.id}')" title="PO">PO</button>
                            ${window.hasPermission('product_add_edit') ? `<button class="btn btn-warning btn-sm" onclick="editInventoryProduct('${product.id}')" title="Refill/Edit">Edit</button>` : ''}
                            ${window.hasPermission('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteInventoryProduct('${product.id}')" title="Delete">Del</button>` : ''}
                        </td>
                    </tr>`;
                }
            }).join('');
        }

        function filterInventoryTable() {
            if (typeof window.inventorySelectedIndex !== 'undefined') window.inventorySelectedIndex = -1;
            updateInventoryTable();
        }

        function deleteInventoryProduct(id) {
            if (!window.hasPermission('delete')) return showAlert('Unauthorized: You do not have permission to delete products.', 'error');

            const product = products.find(p => String(p.id) === String(id));
            if (!product) {
                showAlert('Product not found!', '❌');
                return;
            }

            // Confirm deletion
            showConfirm(`Are you sure you want to delete "${product.name}"?`, () => {
                // Delete the product
                products = products.filter(p => String(p.id) !== String(id));
                saveData();
                updateInventoryTable(); // Refresh the table
                showAlert('Product deleted successfully!', '✅');
            });
        }

        function populateProductSelect(selectId) {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Choose Product...</option>';

            products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (Stock: ${product.stock})`;
                select.appendChild(option);
            });
        }

        function updateStockAndPrice() {
            if (!requireLicensedForWrite('updating stock')) return;
            if (!navigator.onLine) {
                showAlert('⚠️ Warning: You are offline. Changes will be saved locally.', 'offline');
            }
            const productIdStr = document.getElementById('updateStockProductId').value;
            const productId = !isNaN(parseInt(productIdStr)) ? parseInt(productIdStr) : productIdStr;
            const variantIdField = document.getElementById('updateStockVariantId');
            const variantId = variantIdField ? variantIdField.value : '';
            
            const qtyStr = document.getElementById('addStockQuantity').value;
            const priceStr = document.getElementById('updateStockPrice').value;
            
            const quantity = parseFloat(qtyStr);
            const price = parseFloat(priceStr);

            if (!productId) {
                showAlert('Please select a product', '⚠️');
                return;
            }

            const hasQuantity = !isNaN(quantity) && qtyStr.trim() !== '';
            const hasPrice = !isNaN(price) && priceStr.trim() !== '';

            if (!hasQuantity && !hasPrice) {
                showAlert('Please enter a quantity or a price to update.', '⚠️');
                return;
            }

            if (hasQuantity && quantity <= 0) {
                showAlert('Quantity must be greater than 0.', '⚠️');
                return;
            }

            if (hasPrice && price < 0) {
                showAlert('Price must be greater than or equal to 0.', '⚠️');
                return;
            }

            const product = products.find(p => String(p.id) === String(productId));
            if (product) {
                let variantRef = null;
                if (variantId) {
                    variantRef = window.getVariantById(product, variantId);
                }

                if (hasQuantity) {
                    if (product.quantityType === 'decimal') {
                        const prec = product.decimalPrecision || 0.01;
                        const multiplier = Math.round(1 / prec);
                        if (Math.abs((quantity * multiplier) % 1) > 0.001) {
                            showAlert(`Enter a valid quantity. This product allows quantities in steps of ${prec}.`, '⚠️');
                            return;
                        }
                    } else {
                        if (!Number.isInteger(quantity)) {
                            showAlert(`This product requires a whole number quantity.`, '⚠️');
                            return;
                        }
                    }

                    if (variantRef) {
                        variantRef.stock = parseFloat(((variantRef.stock || 0) + quantity).toFixed(3));
                    } else {
                        product.stock = parseFloat(((product.stock || 0) + quantity).toFixed(3));
                    }

                    stockHistory.push({
                        date: new Date().toISOString(),
                        productId: product.id,
                        variantId: variantId || undefined,
                        productName: window.getVariantDisplayName(product, variantRef),
                        type: 'addition',
                        quantity: quantity,
                        newStock: variantRef ? variantRef.stock : product.stock
                    });
                }
                
                if (hasPrice) {
                    if (variantRef) {
                        variantRef.sellingPrice = parseFloat(price.toFixed(2));
                    } else {
                        product.price = parseFloat(price.toFixed(2));
                    }
                }

                saveData();
                updateInventoryTable();
                updateDashboard();

                document.getElementById('updateStockProductId').value = '';
                if(variantIdField) variantIdField.value = '';
                document.getElementById('stockBarcode').value = '';
                document.getElementById('addStockQuantity').value = '';
                if(document.getElementById('updateStockPrice')) document.getElementById('updateStockPrice').value = '';
                if(document.getElementById('addStockUnit')) document.getElementById('addStockUnit').innerText = '';
                document.getElementById('stockBarcodeClear').style.display = 'none';
                
                const dispName = window.getVariantDisplayName(product, variantRef);
                let msg = `Successfully updated ${dispName}!`;
                if(hasQuantity && hasPrice) msg = `Successfully added ${quantity} units and updated price to ₹${price} for ${dispName}`;
                else if(hasQuantity) msg = `Successfully added ${quantity} units to ${dispName}`;
                else if(hasPrice) msg = `Successfully updated price to ₹${price} for ${dispName}`;

                showAlert(msg, '✅');
            }
        }

        function populatePaymentMethodSelect(searchTerm = '') {
            const dropdown = document.getElementById('paymentMethodDropdown');
            if (!dropdown) return;

            dropdown.innerHTML = '';
            paymentComboboxSelectedIndex = -1;

            if (paymentMethodsList.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            const filteredMethods = paymentMethodsList.filter(method => {
                return method.text.toLowerCase().includes(searchTerm.toLowerCase());
            });

            if (filteredMethods.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            filteredMethods.forEach((method, index) => {
                const item = document.createElement('div');
                item.className = 'custom-dropdown-item';
                item.textContent = method.text;
                item.dataset.value = method.value;
                
                item.onclick = function() {
                    onPaymentMethodSelection(method.value, method.text);
                };
                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        }

        function filterPaymentMethods() {
            const searchTerm = document.getElementById('paymentMethodSearch').value;
            const clearBtn = document.getElementById('paymentMethodClear');
            
            if (searchTerm.length > 0) {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
            
            populatePaymentMethodSelect(searchTerm);
        }

        function onPaymentMethodSelection(value, text) {
            const searchInput = document.getElementById('paymentMethodSearch');
            const selectElem = document.getElementById('paymentMethod');
            const dropdown = document.getElementById('paymentMethodDropdown');

            searchInput.value = text;
            selectElem.value = value;
            dropdown.style.display = 'none';
            
            // Trigger the original toggle change
            togglePaymentFields();
            
            // Focus Cash Received explicitly
            const cashInput = document.getElementById('customerAmount');
            if (cashInput && cashInput.style.display !== 'none' && document.getElementById('customerAmountGroup').style.display !== 'none') {
                cashInput.focus();
                cashInput.select();
            } else {
                // If it's not cash, focus complete sale
                document.getElementById('btnCompleteSale').focus();
            }
        }

        function clearPaymentMethodSelection() {
            const searchInput = document.getElementById('paymentMethodSearch');
            const selectElem = document.getElementById('paymentMethod');
            
            searchInput.value = '';
            selectElem.value = 'cash'; // default
            document.getElementById('paymentMethodClear').style.display = 'none';
            document.getElementById('paymentMethodDropdown').style.display = 'none';
            
            togglePaymentFields();
            searchInput.focus();
            populatePaymentMethodSelect('');
        }

        // Add blur listener to auto-select if user types but doesn't click
        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.getElementById('paymentMethodSearch');
            if (searchInput) {
                searchInput.addEventListener('blur', () => {
                    setTimeout(() => {
                        const currentText = searchInput.value.toLowerCase().trim();
                        const match = paymentMethodsList.find(m => m.text.toLowerCase() === currentText || m.value.toLowerCase() === currentText);
                        if (match) {
                            onPaymentMethodSelection(match.value, match.text);
                        } else {
                            // Revert to current select value if invalid text
                            const selectElem = document.getElementById('paymentMethod');
                            const validMatch = paymentMethodsList.find(m => m.value === selectElem.value);
                            if (validMatch) searchInput.value = validMatch.text;
                        }
                    }, 200); // small delay to allow click event on dropdown to fire first
                });
            }
        });

        // Unit Combobox State
        let currentProductUnits = [];
        let unitComboboxSelectedIndex = -1;

        function populateSaleUnitSelect(searchTerm = '') {
            const dropdown = document.getElementById('saleUnitDropdown');
            if (!dropdown) return;

            dropdown.innerHTML = '';
            unitComboboxSelectedIndex = -1;

            if (!searchTerm && currentProductUnits.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            // Filter units based on search term
            const filteredUnits = currentProductUnits.filter(unit => {
                return unit.text.toLowerCase().includes(searchTerm.toLowerCase());
            });

            if (filteredUnits.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            filteredUnits.forEach((unit, index) => {
                const item = document.createElement('div');
                item.className = 'custom-dropdown-item';
                item.textContent = unit.text;
                item.dataset.value = unit.value;
                
                item.onclick = function() {
                    onSaleUnitSelection(unit.value, unit.text);
                };
                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        }

        function filterSaleUnits() {
            const searchTerm = document.getElementById('saleUnitSearch').value;
            populateSaleUnitSelect(searchTerm);
            
            // Show clear button if there is text
            document.getElementById('saleUnitClear').style.display = searchTerm ? 'block' : 'none';
        }

        function onSaleUnitSelection(value, text, skipFocus = false) {
            const searchInput = document.getElementById('saleUnitSearch');
            searchInput.value = text;
            
            document.getElementById('saleUnitDropdown').style.display = 'none';
            document.getElementById('saleUnitClear').style.display = 'block';
            
            const unitSelect = document.getElementById('saleUnit');
            unitSelect.value = value;
            onSaleUnitChange();
            
            if (!skipFocus) {
                document.getElementById('saleQuantity').focus();
            }
        }

        function clearSaleUnitSelection() {
            document.getElementById('saleUnitSearch').value = '';
            document.getElementById('saleUnitDropdown').style.display = 'none';
            document.getElementById('saleUnitClear').style.display = 'none';
            document.getElementById('saleUnit').value = '';
            onSaleUnitChange();
            document.getElementById('saleUnitSearch').focus();
            populateSaleUnitSelect(''); // Show all units again
        }

        function populateSaleProductSelect(searchTerm = '') {
            const dropdown = document.getElementById('saleProductDropdown');
            if (!dropdown) return;

            dropdown.innerHTML = '';
            comboboxSelectedIndex = -1;

            if (!searchTerm) {
                dropdown.style.display = 'none';
                return;
            }

            const rawQuery = searchTerm.toLowerCase().trim();
            const tokens = rawQuery.split(/\s+/).filter(t => t.length > 0);

            // Generate search candidates: Every parent is an item, and every variant is also a separate item
            const candidateItems = [];
            products.forEach(p => {
                // Parent item
                candidateItems.push({
                    parent: p,
                    variant: null,
                    displayName: p.name || 'Unnamed Product',
                    barcode: p.barcode || '',
                    stock: p.stock !== undefined ? p.stock : 0,
                    price: p.price !== undefined ? p.price : (p.sellingPrice !== undefined ? p.sellingPrice : 0),
                    category: p.category || '',
                    brand: p.brand || '',
                    sku: p.sku || '',
                    unit: p.unit || 'Piece'
                });

                // Variant items
                if (window.hasVariants(p) && Array.isArray(p.variants)) {
                    p.variants.forEach(v => {
                        candidateItems.push({
                            parent: p,
                            variant: v,
                            displayName: window.getVariantDisplayName(p, v),
                            barcode: v.barcode || '',
                            stock: v.stock !== undefined ? v.stock : 0,
                            price: v.sellingPrice !== undefined ? v.sellingPrice : (v.price !== undefined ? v.price : 0),
                            category: v.category || p.category || '',
                            brand: v.brand || p.brand || '',
                            sku: v.sku || p.sku || '',
                            unit: v.unit || p.unit || 'Piece'
                        });
                    });
                }
            });

            // Score and filter candidates across parent name, variant name, display name, barcode, category, brand, sku, price
            const scoredResults = [];
            candidateItems.forEach(item => {
                let score = 0;
                let allTokensMatch = true;

                const nameStr = item.displayName.toLowerCase();
                const parentNameStr = (item.parent.name || '').toLowerCase();
                const varNameStr = item.variant ? (item.variant.variantName || '').toLowerCase() : '';
                const barcodeStr = (item.barcode || '').toLowerCase();
                const catStr = (item.category || '').toLowerCase();
                const brandStr = (item.brand || '').toLowerCase();
                const skuStr = (item.sku || '').toLowerCase();
                const priceStr = String(item.price || '');
                const unitStr = (item.unit || '').toLowerCase();

                // Exact barcode match
                if (barcodeStr && barcodeStr === rawQuery) score += 1000;
                else if (barcodeStr && barcodeStr.includes(rawQuery)) score += 500;

                // Exact full name match
                if (nameStr === rawQuery) score += 800;
                else if (parentNameStr === rawQuery) score += 750;
                else if (varNameStr === rawQuery) score += 700;

                tokens.forEach(token => {
                    let tokenMatched = false;
                    if (barcodeStr && barcodeStr.includes(token)) {
                        tokenMatched = true;
                        score += 50;
                    }
                    if (nameStr.includes(token)) {
                        tokenMatched = true;
                        if (nameStr.startsWith(token) || nameStr.includes(' ' + token)) score += 30;
                        else score += 10;
                    } else if (parentNameStr.includes(token)) {
                        tokenMatched = true;
                        score += 20;
                    } else if (varNameStr.includes(token)) {
                        tokenMatched = true;
                        score += 25;
                    }
                    if (catStr.includes(token)) {
                        tokenMatched = true;
                        score += 2;
                    }
                    if (brandStr.includes(token)) {
                        tokenMatched = true;
                        score += 2;
                    }
                    if (skuStr.includes(token)) {
                        tokenMatched = true;
                        score += 5;
                    }
                    if (unitStr === token) {
                        tokenMatched = true;
                        score += 1;
                    }
                    if (!isNaN(token) && priceStr === token) {
                        tokenMatched = true;
                        score += 30;
                    }

                    if (!tokenMatched) allTokensMatch = false;
                });

                if (allTokensMatch || score >= 500) {
                    scoredResults.push({ item: item, score: score });
                }
            });

            if (scoredResults.length === 0) {
                dropdown.style.display = 'none';
                const prompt = document.getElementById('addInventoryPrompt');
                if (prompt) prompt.style.display = 'flex';
                return;
            } else {
                const prompt = document.getElementById('addInventoryPrompt');
                if (prompt) prompt.style.display = 'none';
            }

            // Sort by score descending
            scoredResults.sort((a, b) => b.score - a.score);

            const displayItems = scoredResults.slice(0, 15).map(r => r.item);

            displayItems.forEach((itemObj) => {
                const product = itemObj.parent;
                const variant = itemObj.variant;
                const item = document.createElement('div');
                item.className = 'custom-dropdown-item';
                item.dataset.id = product.id;
                if (variant) item.dataset.variantId = variant.id;

                const barcodeDisplay = itemObj.barcode && itemObj.barcode !== 'N/A' ? `Barcode: ${itemObj.barcode}` : 'Barcode: —';
                const priceFormatted = parseFloat(itemObj.price || 0).toFixed(2);
                const stockVal = itemObj.stock;
                const stockColor = stockVal <= 0 ? '#dc3545' : '#198754';

                item.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <div style="font-weight:600; font-size:15px; color:#212529;">${itemObj.displayName}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#6c757d;">
                            <span>${barcodeDisplay}</span>
                            <span>Stock: <strong style="color:${stockColor};">${stockVal}</strong> &nbsp; | &nbsp; <strong style="color:#0d6efd;">₹${priceFormatted}</strong></span>
                        </div>
                    </div>
                `;

                item.onclick = function() {
                    onSaleProductChange(product.id, variant ? variant.id : null);
                };
                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        }

        function filterSaleProducts() {
            // When user types, clear any existing product selection
            document.getElementById('saleProductId').value = '';
            
            const searchTerm = document.getElementById('saleProductSearch').value;
            populateSaleProductSelect(searchTerm);
            
            // Show clear button if there is text
            document.getElementById('saleProductClear').style.display = searchTerm ? 'block' : 'none';
        }

        // Setup keyboard navigation for combobox
        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.getElementById('saleProductSearch');
            if(searchInput) {
                searchInput.addEventListener('keydown', function(e) {
                    const prompt = document.getElementById('addInventoryPrompt');
                    if (prompt && prompt.style.display !== 'none' && e.key === 'ArrowDown') {
                        e.preventDefault();
                        const addBtn = prompt.querySelector('button');
                        if (addBtn) addBtn.focus();
                        return;
                    }
                    
                    const dropdown = document.getElementById('saleProductDropdown');
                    if (dropdown.style.display === 'none') return;
                    
                    const items = dropdown.querySelectorAll('.custom-dropdown-item');
                    if (items.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        comboboxSelectedIndex = Math.min(comboboxSelectedIndex + 1, items.length - 1);
                        updateComboboxSelection(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        comboboxSelectedIndex = Math.max(comboboxSelectedIndex - 1, 0);
                        updateComboboxSelection(items);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (comboboxSelectedIndex >= 0) {
                            items[comboboxSelectedIndex].click();
                        } else {
                            if(items.length === 1) {
                                items[0].click();
                            } else if (items.length > 0) {
                                items[0].click();
                            }
                        }
                    } else if (e.key === 'Escape') {
                        dropdown.style.display = 'none';
                    }
                });

                // Hide dropdowns when clicking outside
                document.addEventListener('click', function(e) {
                    if (!e.target.closest('.combobox-container')) {
                        document.getElementById('saleProductDropdown').style.display = 'none';
                        document.getElementById('saleUnitDropdown').style.display = 'none';
                        document.getElementById('barcodeSaleDropdown').style.display = 'none';
                    }
                });
                
                // Show dropdown on focus if it has value
                searchInput.addEventListener('focus', function() {
                    if (this.value && !document.getElementById('saleProductId').value) {
                        populateSaleProductSelect(this.value);
                    }
                });
            }

            const unitSearchInput = document.getElementById('saleUnitSearch');
            if (unitSearchInput) {
                unitSearchInput.addEventListener('keydown', function(e) {
                    const dropdown = document.getElementById('saleUnitDropdown');
                    if (dropdown.style.display === 'none' && currentProductUnits.length > 0 && e.key !== 'Escape') {
                        dropdown.style.display = 'block';
                    }
                    
                    if (dropdown.style.display === 'none') return;
                    
                    const items = dropdown.querySelectorAll('.custom-dropdown-item');
                    if (items.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        unitComboboxSelectedIndex = Math.min(unitComboboxSelectedIndex + 1, items.length - 1);
                        updateUnitComboboxSelection(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        unitComboboxSelectedIndex = Math.max(unitComboboxSelectedIndex - 1, -1);
                        updateUnitComboboxSelection(items);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (unitComboboxSelectedIndex >= 0) {
                            items[unitComboboxSelectedIndex].click();
                        } else {
                            // If exactly one match, select it
                            if(items.length === 1) {
                                items[0].click();
                            }
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (comboboxSelectedIndex >= 0) {
                            items[comboboxSelectedIndex].click();
                        } else {
                            if(items.length === 1) {
                                items[0].click();
                            } else if (items.length > 0) {
                                items[0].click();
                            }
                        }
                    } else if (e.key === 'Escape') {
                        dropdown.style.display = 'none';
                    }
                });

                unitSearchInput.addEventListener('focus', function() {
                    populateSaleUnitSelect(this.value);
                });
            }

            const barcodeInput = document.getElementById('quickSaleBarcode');
            if (barcodeInput) {
                barcodeInput.addEventListener('keydown', function(e) {
                    const dropdown = document.getElementById('barcodeSaleDropdown');
                    if (dropdown.style.display === 'none' && this.value && e.key !== 'Escape') {
                        dropdown.style.display = 'block';
                    }
                    
                    if (dropdown.style.display === 'none') return;
                    
                    const items = dropdown.querySelectorAll('.custom-dropdown-item');
                    if (items.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        barcodeComboboxSelectedIndex = Math.min(barcodeComboboxSelectedIndex + 1, items.length - 1);
                        updateBarcodeComboboxSelection(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        barcodeComboboxSelectedIndex = Math.max(barcodeComboboxSelectedIndex - 1, -1);
                        updateBarcodeComboboxSelection(items);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (barcodeComboboxSelectedIndex >= 0) {
                            items[barcodeComboboxSelectedIndex].click();
                        } else {
                            if (items.length === 1 && !items[0].hasAttribute('disabled')) {
                                items[0].click();
                            }
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (comboboxSelectedIndex >= 0) {
                            items[comboboxSelectedIndex].click();
                        } else {
                            if(items.length === 1) {
                                items[0].click();
                            } else if (items.length > 0) {
                                items[0].click();
                            }
                        }
                    } else if (e.key === 'Escape') {
                        dropdown.style.display = 'none';
                    }
                });

                barcodeInput.addEventListener('focus', function() {
                    if (this.value) {
                        populateBarcodeSelect(this.value);
                    }
                });
            }

            const stockBarcodeInput = document.getElementById('stockBarcode');
            if (stockBarcodeInput) {
                stockBarcodeInput.addEventListener('keydown', function(e) {
                    const dropdown = document.getElementById('stockBarcodeDropdown');
                    if (dropdown.style.display === 'none' && this.value && e.key !== 'Escape') {
                        dropdown.style.display = 'block';
                    }
                    
                    if (dropdown.style.display === 'none') return;
                    
                    const items = dropdown.querySelectorAll('.custom-dropdown-item');
                    if (items.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        stockBarcodeComboboxSelectedIndex = Math.min(stockBarcodeComboboxSelectedIndex + 1, items.length - 1);
                        updateStockBarcodeComboboxSelection(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        stockBarcodeComboboxSelectedIndex = Math.max(stockBarcodeComboboxSelectedIndex - 1, -1);
                        updateStockBarcodeComboboxSelection(items);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (stockBarcodeComboboxSelectedIndex >= 0) {
                            items[stockBarcodeComboboxSelectedIndex].click();
                        } else {
                            if (items.length === 1 && !items[0].hasAttribute('disabled')) {
                                items[0].click();
                            }
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (comboboxSelectedIndex >= 0) {
                            items[comboboxSelectedIndex].click();
                        } else {
                            if(items.length === 1) {
                                items[0].click();
                            } else if (items.length > 0) {
                                items[0].click();
                            }
                        }
                    } else if (e.key === 'Escape') {
                        dropdown.style.display = 'none';
                    }
                });

                stockBarcodeInput.addEventListener('focus', function() {
                    if (this.value) {
                        populateStockBarcodeSelect(this.value);
                    }
                });
            }
        });

        let barcodeComboboxSelectedIndex = -1;

        function filterBarcodeSale() {
            const searchTerm = document.getElementById('quickSaleBarcode').value;
            populateBarcodeSelect(searchTerm);
            
            document.getElementById('quickSaleBarcodeClear').style.display = searchTerm ? 'block' : 'none';
        }

        function clearBarcodeSaleSelection() {
            const searchInput = document.getElementById('quickSaleBarcode');
            searchInput.value = '';
            document.getElementById('quickSaleBarcodeClear').style.display = 'none';
            document.getElementById('barcodeSaleDropdown').style.display = 'none';
            searchInput.focus();
        }

        function populateBarcodeSelect(searchTerm) {
            const dropdown = document.getElementById('barcodeSaleDropdown');
            barcodeComboboxSelectedIndex = -1;
            
            if (!searchTerm) {
                dropdown.style.display = 'none';
                return;
            }

            const matchingProducts = searchProductsUnified(searchTerm, products);

            if (matchingProducts.length === 0) {
                dropdown.innerHTML = '<div class="custom-dropdown-item" disabled style="color: #666; pointer-events: none;">No matching barcode found</div>';
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = '';
            
            let displayItems = [];
            matchingProducts.forEach(p => {
                if (window.hasVariants(p)) {
                    p.variants.forEach(v => {
                        displayItems.push({ parent: p, variant: v, displayName: window.getVariantDisplayName(p, v), barcode: v.barcode, stock: v.stock, price: v.sellingPrice });
                    });
                } else {
                    displayItems.push({ parent: p, variant: null, displayName: p.name, barcode: p.barcode, stock: p.stock, price: p.price });
                }
            });
            displayItems = displayItems.slice(0, 15);

            displayItems.forEach((itemObj, index) => {
                const item = document.createElement('div');
                item.className = 'custom-dropdown-item';
                
                let html = `<div style="display: flex; flex-direction: column;">`;
                html += `<div style="font-weight: 500;">${itemObj.barcode} - ${itemObj.displayName}</div>`;
                html += `<div style="font-size: 0.85em; color: #666;">Stock: ${itemObj.stock} | Price: ₹${itemObj.price}</div>`;
                html += `</div>`;
                
                item.innerHTML = html;
                
                item.onclick = function() {
                    selectBarcodeProduct(itemObj.parent, itemObj.variant);
                    dropdown.style.display = 'none';
                };
                
                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        }

        function updateBarcodeComboboxSelection(items) {
            items.forEach(item => item.classList.remove('active'));
            if (barcodeComboboxSelectedIndex >= 0 && !items[barcodeComboboxSelectedIndex].hasAttribute('disabled')) {
                const activeItem = items[barcodeComboboxSelectedIndex];
                activeItem.classList.add('active');
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }

        function selectBarcodeProduct(product, variant = null) {
            // Clear barcode input
            document.getElementById('quickSaleBarcode').value = '';
            document.getElementById('quickSaleBarcodeClear').style.display = 'none';
            
            // Set quantity to 1 explicitly
            document.getElementById('saleQuantity').value = 1;
            
            // Re-use existing Add Item to Sale logic (sets Product, Price, Units, and moves focus to Units/Quantity)
            onSaleProductChange(product.id, variant ? variant.id : null);
        }

        // --- Stock Barcode Autocomplete ---
        let stockBarcodeComboboxSelectedIndex = -1;

        function filterStockBarcode() {
            const searchTerm = document.getElementById('stockBarcode').value;
            populateStockBarcodeSelect(searchTerm);
            
            document.getElementById('stockBarcodeClear').style.display = searchTerm ? 'block' : 'none';
        }

        function clearStockBarcodeSelection() {
            const searchInput = document.getElementById('stockBarcode');
            searchInput.value = '';
            document.getElementById('updateStockProductId').value = '';
            const vid = document.getElementById('updateStockVariantId');
            if (vid) vid.value = '';
            document.getElementById('stockBarcodeClear').style.display = 'none';
            document.getElementById('stockBarcodeDropdown').style.display = 'none';
            searchInput.focus();
        }

        function populateStockBarcodeSelect(searchTerm) {
            const dropdown = document.getElementById('stockBarcodeDropdown');
            stockBarcodeComboboxSelectedIndex = -1;
            
            if (!searchTerm) {
                dropdown.style.display = 'none';
                return;
            }

            const matchingProducts = searchProductsUnified(searchTerm, products);

            if (matchingProducts.length === 0) {
                dropdown.innerHTML = '<div class="custom-dropdown-item" disabled style="color: #666; pointer-events: none;">No matching product found</div>';
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = '';
            let displayItems = [];
            
            const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
            
            matchingProducts.forEach(p => {
                if (window.hasVariants(p)) {
                    p.variants.forEach(v => {
                        const dName = window.getVariantDisplayName(p, v);
                        const vBar = v.barcode || '';
                        
                        // Check if ALL tokens match this specific variant's name, parent name, or barcode
                        let allTokensMatchVariant = true;
                        if (tokens.length > 0) {
                            for (let token of tokens) {
                                if (!dName.toLowerCase().includes(token) && !vBar.toLowerCase().includes(token) && !p.name.toLowerCase().includes(token)) {
                                    allTokensMatchVariant = false;
                                    break;
                                }
                            }
                        }
                        
                        // Also if the query is an exact barcode match, only show that variant
                        if (searchTerm.trim() === vBar) allTokensMatchVariant = true;
                        
                        if (allTokensMatchVariant) {
                            displayItems.push({ parent: p, variant: v, displayName: dName, barcode: v.barcode, stock: v.stock, price: v.sellingPrice });
                        }
                    });
                } else {
                    displayItems.push({ parent: p, variant: null, displayName: p.name, barcode: p.barcode, stock: p.stock, price: p.price });
                }
            });
            displayItems = displayItems.slice(0, 15);

            displayItems.forEach((itemObj, index) => {
                const item = document.createElement('div');
                item.className = 'custom-dropdown-item';
                
                let html = `<div style="display: flex; flex-direction: column;">`;
                html += `<div style="font-weight: 500;">${itemObj.barcode ? itemObj.barcode + ' - ' : ''}${itemObj.displayName}</div>`;
                html += `<div style="font-size: 0.85em; color: #666;">Stock: ${itemObj.stock || 0} | Price: ₹${itemObj.price || 0}</div>`;
                html += `</div>`;
                
                item.innerHTML = html;
                
                item.onclick = function() {
                    selectStockBarcodeProduct(itemObj.parent, itemObj.variant);
                    dropdown.style.display = 'none';
                };
                
                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        }

        function updateStockBarcodeComboboxSelection(items) {
            items.forEach(item => item.classList.remove('active'));
            if (stockBarcodeComboboxSelectedIndex >= 0 && !items[stockBarcodeComboboxSelectedIndex].hasAttribute('disabled')) {
                const activeItem = items[stockBarcodeComboboxSelectedIndex];
                activeItem.classList.add('active');
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }

        function selectStockBarcodeProduct(product, variant = null) {
            // Set the value in the input visually
            const bc = variant ? variant.barcode : product.barcode;
            document.getElementById('stockBarcode').value = `${bc ? bc + ' - ' : ''}${window.getVariantDisplayName(product, variant)}`;
            document.getElementById('stockBarcodeClear').style.display = 'block';
            
            // Set the hidden ID
            document.getElementById('updateStockProductId').value = product.id;
            
            let variantIdField = document.getElementById('updateStockVariantId');
            if(!variantIdField) {
                variantIdField = document.createElement('input');
                variantIdField.type = 'hidden';
                variantIdField.id = 'updateStockVariantId';
                document.getElementById('updateStockProductId').parentNode.appendChild(variantIdField);
            }
            variantIdField.value = variant ? variant.id : '';
            
            // Set the price and unit if elements exist
            const priceEl = document.getElementById('updateStockPrice');
            if(priceEl) priceEl.value = variant ? (variant.sellingPrice || '') : (product.price || '');
            const unitEl = document.getElementById('addStockUnit');
            if(unitEl) unitEl.innerText = product.unit || 'Piece';
            
            // Focus quantity
            document.getElementById('addStockQuantity').focus();
        }
        
        // Expose functions to global scope since they are called from HTML
        window.filterStockBarcode = filterStockBarcode;
        window.clearStockBarcodeSelection = clearStockBarcodeSelection;

        function updateUnitComboboxSelection(items) {
            items.forEach(item => item.classList.remove('active'));
            if (unitComboboxSelectedIndex >= 0) {
                const activeItem = items[unitComboboxSelectedIndex];
                activeItem.classList.add('active');
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }

        function updateComboboxSelection(items, index = comboboxSelectedIndex) {
            items.forEach(item => item.classList.remove('active'));
            if (index >= 0) {
                const activeItem = items[index];
                activeItem.classList.add('active');
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }

        function clearSaleProductSelection(skipFocus = false) {
            document.getElementById('saleProductSearch').value = '';
            document.getElementById('saleProductDropdown').style.display = 'none';
            document.getElementById('saleProductClear').style.display = 'none';
            document.getElementById('saleProductId').value = '';
            
            // Clear all dependent fields
            document.getElementById('saleUnitSearch').value = '';
            document.getElementById('saleUnitClear').style.display = 'none';
            currentProductUnits = [];
            
            document.getElementById('saleUnit').innerHTML = '<option value="">Select Unit...</option>';
            document.getElementById('salePrice').value = '';
            document.getElementById('saleQuantity').value = 1;
            
            if (!skipFocus) {
                document.getElementById('saleProductSearch').focus();
            }
            populateSaleProductSelect(''); // Show all products again
        }

        function handleAddInventoryFromInventory() {
            window.isAddingFromInventory = true;
            document.getElementById('purchaseModal').style.display = 'flex';
            
            togglePurchaseBillElements(false);
            const titleEl = document.querySelector('#purchaseModal h2');
            if (titleEl) titleEl.innerHTML = '📦 Add Inventory';
            
            showPurchaseAddNewProductForm();
        }

        function openAddStockModalForExistingProduct(productId, variantId = null) {
            const product = products.find(p => String(p.id) === String(productId));
            if (!product) return;
            
            let variant = null;
            if (variantId) {
                variant = window.getVariantById ? window.getVariantById(product, variantId) : null;
            } else if (window.selectedSaleVariant) {
                variant = window.selectedSaleVariant;
            }
            
            document.getElementById('addStockProductId').value = product.id;
            if (document.getElementById('addStockVariantId')) {
                document.getElementById('addStockVariantId').value = variant ? variant.id : '';
            }
            
            const displayName = variant ? (window.getVariantDisplayName ? window.getVariantDisplayName(product, variant) : ) : product.name;
            const barcode = variant ? (variant.barcode || '') : (product.barcode || '');
            const currentStock = variant ? (variant.stock || 0) : (product.stock || 0);
            const unit = variant ? (variant.unit || product.unit || 'Piece') : (product.unit || 'Piece');
            
            document.getElementById('addStockProductName').textContent = displayName + (barcode && barcode !== 'N/A' ?  : '');
            document.getElementById('addStockCurrentQty').textContent = currentStock + ' ' + unit;
            document.getElementById('addStockQty').value = '';
            
            document.getElementById('addStockModal').style.display = 'flex';
            setTimeout(() => { document.getElementById('addStockQty').focus(); }, 100);
        }

        window.submitAddStock = function(e) {
            e.preventDefault();
            const productId = document.getElementById('addStockProductId').value;
            const variantId = document.getElementById('addStockVariantId') ? document.getElementById('addStockVariantId').value : '';
            const qtyToAdd = parseFloat(document.getElementById('addStockQty').value);
            
            if (!productId || isNaN(qtyToAdd) || qtyToAdd <= 0) return;
            
            const product = products.find(p => String(p.id) === String(productId));
            if (product) {
                let variant = null;
                if (variantId && window.getVariantById) {
                    variant = window.getVariantById(product, variantId);
                }
                
                if (variant) {
                    variant.stock = (variant.stock || 0) + qtyToAdd;
                    product.stock = (product.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
                } else {
                    product.stock = (product.stock || 0) + qtyToAdd;
                }
                
                if (typeof saveData === 'function') saveData();
                
                const prompt = document.getElementById('addInventoryPrompt');
                if (prompt) prompt.style.display = 'none';
                
                // Refresh sale selection
                if (typeof onSaleProductChange === 'function') onSaleProductChange(product.id, variant ? variant.id : null);
                
                // Refresh UI lists
                if (typeof updateDashboard === 'function') updateDashboard();
                if (typeof renderProducts === 'function') renderProducts();
                
                document.getElementById('addStockModal').style.display = 'none';
                
                const unit = document.getElementById('saleUnitSearch');
                if (unit) { unit.focus(); }
            }
        };

        function handleAddInventoryFromSale() {
            // Check if dropdown item is selected or highlighted
            const dropdown = document.getElementById('saleProductDropdown');
            if (dropdown && dropdown.style.display !== 'none' && typeof comboboxSelectedIndex !== 'undefined' && comboboxSelectedIndex >= 0) {
                const items = dropdown.querySelectorAll('.custom-dropdown-item');
                if (items[comboboxSelectedIndex]) {
                    const pid = items[comboboxSelectedIndex].dataset.id;
                    const varId = items[comboboxSelectedIndex].dataset.variantId || null;
                    if (pid) {
                        openAddStockModalForExistingProduct(pid, varId);
                        dropdown.style.display = 'none';
                        return;
                    }
                }
            }

            const saleProductId = document.getElementById('saleProductId').value;
            if (saleProductId) {
                openAddStockModalForExistingProduct(saleProductId, window.selectedSaleVariant ? window.selectedSaleVariant.id : null);
                return;
            }

            window.isAddingFromSale = true;
            document.getElementById('purchaseModal').style.display = 'flex';
            
            togglePurchaseBillElements(false);
            const titleEl = document.querySelector('#purchaseModal h2');
            if (titleEl) titleEl.innerHTML = '📦 Add Inventory';
            
            showPurchaseAddNewProductForm();
            
            // Prefill search term if any
            const searchTerm = document.getElementById('saleProductSearch').value;
            if (searchTerm) {
                document.getElementById('newProductName').value = searchTerm;
            }
        }
        window.handleAddInventoryFromSale = handleAddInventoryFromSale;

        function onSaleProductChange(productId, variantId = null) {
            try {
                if (!productId) return;
                
                // Set hidden input value
                document.getElementById('saleProductId').value = productId;
                
                // Hide dropdown
                document.getElementById('saleProductDropdown').style.display = 'none';

                const unitSelect = document.getElementById('saleUnit');
                const priceInput = document.getElementById('salePrice');
                const prompt = document.getElementById('addInventoryPrompt');

                if (prompt) prompt.style.display = 'none';
                if (!unitSelect) return;

                unitSelect.innerHTML = '<option value="">Select Unit...</option>';
                priceInput.value = '';

                const product = products.find(p => String(p.id) === String(productId));
                if (!product) {
                    console.error("Selected product not found:", productId);
                    return;
                }
                
                let variant = null;
                if (variantId) {
                    variant = window.getVariantById(product, variantId);
                }
                window.selectedSaleVariant = variant;
                
                const effectiveQtyType = (variant && variant.quantityType) ? variant.quantityType : (product.quantityType || 'whole');
                const saleQtyInput = document.getElementById('saleQuantity');
                if (saleQtyInput) {
                    if (effectiveQtyType === 'decimal') {
                        saleQtyInput.step = 'any';
                        saleQtyInput.min = '0';
                        saleQtyInput.value = '1';
                    } else {
                        saleQtyInput.step = '1';
                        saleQtyInput.min = '1';
                        saleQtyInput.value = '1';
                    }
                }

                const effStock = variant ? (variant.stock || 0) : (product.stock || 0);
                if (effStock <= 0) {
                    if (prompt) prompt.style.display = 'block';
                }

                const displayName = window.getVariantDisplayName(product, variant);
                console.log("Product selected:", displayName);
                
                currentProductUnits = []; // Reset units array

                // Add Base Unit
                const effectiveUnit = (variant && variant.unit) ? variant.unit : (product.unit || 'Piece');
                const effectivePrice = variant ? (variant.sellingPrice !== undefined ? variant.sellingPrice : (variant.price || 0)) : (product.price || 0);
                const baseText = `${effectiveUnit} (Base)`;
                const baseOption = new Option(baseText, 'base');
                baseOption.dataset.price = effectivePrice;
                baseOption.dataset.quantity = 1;
                unitSelect.add(baseOption);
                currentProductUnits.push({ value: 'base', text: baseText });

                // Add Pack Sizes (prefer variant packSizes if present, else fallback to parent's)
                const packSizesToUse = (variant && variant.packSizes && Array.isArray(variant.packSizes) && variant.packSizes.length > 0)
                    ? variant.packSizes
                    : ((product.packSizes && Array.isArray(product.packSizes) && product.packSizes.length > 0) ? product.packSizes : []);

                if (packSizesToUse.length > 0) {
                    packSizesToUse.forEach((pack, index) => {
                        const packText = `${pack.name} (${pack.quantity} ${effectiveUnit})`;
                        const option = new Option(packText, `pack_${index}`);
                        option.dataset.price = pack.price;
                        option.dataset.quantity = pack.quantity;
                        option.dataset.name = pack.name;
                        unitSelect.add(option);
                        currentProductUnits.push({ value: `pack_${index}`, text: packText });
                    });
                }

                // Select Base Unit by default but skip focusing quantity
                onSaleUnitSelection('base', currentProductUnits[0].text, true);

                // Update search input with selected display name
                const searchInput = document.getElementById('saleProductSearch');
                searchInput.value = displayName;
                document.getElementById('saleProductClear').style.display = 'block';

                // Focus the new Unit/Pack search box
                document.getElementById('saleUnitSearch').focus();
            } catch (error) {
                console.error("Error in onSaleProductChange:", error);
                showAlert("Error updating product details", "⚠️");
            }
        }

        function onSaleUnitChange() {
            const unitSelect = document.getElementById('saleUnit');
            const priceInput = document.getElementById('salePrice');
            const selectedOption = unitSelect.options[unitSelect.selectedIndex];

            if (selectedOption && selectedOption.value) {
                priceInput.value = selectedOption.dataset.price;
            } else {
                priceInput.value = '';
            }
        }

        function getEffectiveDiscount(product, variant = null) {
            if (variant) {
                if (variant.productDiscount !== undefined && variant.productDiscount !== null && variant.productDiscount !== "") {
                    return { type: 'percentage', value: parseFloat(variant.productDiscount) || 0 };
                }
                if (variant.discountValue !== undefined && variant.discountValue !== null && variant.discountValue !== "") {
                    return { type: variant.discountType || 'percentage', value: parseFloat(variant.discountValue) || 0 };
                }
                if (variant.discountPercent !== undefined && variant.discountPercent !== null && variant.discountPercent !== "") {
                    return { type: 'percentage', value: parseFloat(variant.discountPercent) || 0 };
                }
            }
            if (product.discountValue !== undefined && product.discountValue !== null && product.discountValue !== "") {
                return { type: product.discountType || 'percentage', value: parseFloat(product.discountValue) };
            }
            // Fallback for older data that might use discountPercent or productDiscount
            let oldProdVal = product.discountPercent !== undefined ? product.discountPercent : product.productDiscount;
            if (oldProdVal !== undefined && oldProdVal !== null && oldProdVal !== "") {
                return { type: 'percentage', value: parseFloat(oldProdVal) };
            }
            const catToUse = (variant && variant.category) ? variant.category : product.category;
            if (catToUse) {
                const catDiscount = categoryDiscounts.find(c => c.category === catToUse && c.active);
                if (catDiscount) {
                    if (catDiscount.discountValue !== undefined && catDiscount.discountValue !== null && catDiscount.discountValue !== "") {
                        return { type: catDiscount.discountType || 'percentage', value: parseFloat(catDiscount.discountValue) };
                    }
                    if (catDiscount.discount !== undefined && catDiscount.discount !== null && catDiscount.discount !== "") {
                        return { type: 'percentage', value: parseFloat(catDiscount.discount) };
                    }
                }
            }
            return { type: 'percentage', value: 0 };
        }

        function addItemToCart(event) {
            event.preventDefault();
            const productId = parseInt(document.getElementById('saleProductId').value);
            const quantityInput = document.getElementById('saleQuantity').value;
            const quantity = parseFloat(quantityInput);
            const unitSelect = document.getElementById('saleUnit');

            // Auto-select base unit if nothing selected and options exist
            if (unitSelect.selectedIndex <= 0 && unitSelect.options.length > 1) {
                unitSelect.selectedIndex = 1; // Select first real option (Base)
                onSaleUnitChange();
            }

            if (unitSelect.selectedIndex === -1) {
                showAlert('Please select a unit', '⚠️');
                return;
            }

            const selectedOption = unitSelect.options[unitSelect.selectedIndex];

            if (!productId) {
                showAlert('Please select a product', '⚠️');
                return;
            }

            if (!selectedOption || !selectedOption.value) {
                showAlert('Please select a valid unit', '⚠️');
                return;
            }

            if (isNaN(quantity) || quantity <= 0) {
                showAlert('Please enter a valid quantity greater than 0', '⚠️');
                return;
            }

            const product = products.find(p => p.id === productId);
            if (!product) {
                showAlert('Product not available', '❌');
                return;
            }
            
            // Validate step for decimals
            if (product.quantityType === 'decimal') {
                const prec = product.decimalPrecision || 0.01;
                // Avoid floating point modulo issues by using multiplication
                const multiplier = Math.round(1 / prec);
                if (Math.abs((quantity * multiplier) % 1) > 0.001) {
                    showAlert(`Enter a valid quantity. This product allows quantities in steps of ${prec} ${product.unit || ''}.`, '⚠️');
                    return;
                }
            } else {
                if (!Number.isInteger(quantity)) {
                    showAlert(`This product requires a whole number quantity.`, '⚠️');
                    return;
                }
            }



            const targetVariantId = window.selectedSaleVariant ? window.selectedSaleVariant.id : undefined;
            const effStock = window.selectedSaleVariant ? (window.selectedSaleVariant.stock || 0) : (product.stock || 0);

            if (effStock <= 0) {
                window.popupCloseCallback = () => {
                    const sps = document.getElementById('saleProductSearch');
                    if (sps) {
                        sps.focus();
                        if (typeof sps.select === 'function') sps.select();
                    }
                };
                showAlert('Inventory is 0 — unable to add item to cart', '⚠️');
                return;
            }

            const effectiveUnitName = (window.selectedSaleVariant && window.selectedSaleVariant.unit) ? window.selectedSaleVariant.unit : (product.unit || 'Piece');
            const unitName = selectedOption.dataset.name || effectiveUnitName;
            const unitPrice = parseFloat(selectedOption.dataset.price);
            const unitQuantity = parseFloat(selectedOption.dataset.quantity); // Multiplier (e.g., 10 for Box)
            const totalBaseQuantityNeeded = quantity * unitQuantity;

            // Check if product already in cart (same product, same unit, same variant)
            const existingItemIndex = cart.findIndex(item => item.productId === productId && item.unit === unitName && String(item.variantId) === String(targetVariantId));

            // Calculate total stock used by this product/variant in cart
            const currentStockInCart = cart
                .filter(item => item.productId === productId && String(item.variantId) === String(targetVariantId))
                .reduce((sum, item) => sum + (item.quantity * item.baseQuantity), 0);

            if (currentStockInCart + totalBaseQuantityNeeded > effStock) {
                window.popupCloseCallback = () => {
                    const sq = document.getElementById('saleQuantity');
                    if (sq) { sq.focus(); sq.select(); }
                };
                showAlert(`Insufficient stock! Available: ${effStock} ${effectiveUnitName}. You are trying to sell ${currentStockInCart + totalBaseQuantityNeeded}.`, '⚠️');
                return;
            }

            if (existingItemIndex >= 0) {
                cart[existingItemIndex].quantity = parseFloat((cart[existingItemIndex].quantity + quantity).toFixed(3));
                cart[existingItemIndex].total = cart[existingItemIndex].quantity * unitPrice;
            } else {
                let effDisc = getEffectiveDiscount(product, window.selectedSaleVariant);
                cart.push({
                    productId: productId,
                    variantId: targetVariantId,
                    variantName: window.selectedSaleVariant ? window.selectedSaleVariant.variantName : undefined,
                    productName: window.getVariantDisplayName(product, window.selectedSaleVariant),
                    barcode: window.selectedSaleVariant ? window.selectedSaleVariant.barcode : product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: quantity,
                    baseQuantity: unitQuantity, // Store multiplier
                    discountType: effDisc.type,
                    discountValue: effDisc.value,
                    discountPercent: effDisc.type === 'percentage' ? effDisc.value : 0, // Fallback placeholder
                    total: quantity * unitPrice
                });
            }

            updateCartDisplay();

            // Reset fields and focus Product Search for sequential entry
            clearSaleProductSelection(true);
            
            const searchProductInput = document.getElementById('saleProductSearch');
            if (searchProductInput) {
                searchProductInput.focus();
            }
        }

        function handleContinueAdding() {
            document.getElementById('addItemSuccessModal').style.display = 'none';
            document.getElementById('saleProductSearch').focus();
        }

        function handleProceedPayment() {
            document.getElementById('addItemSuccessModal').style.display = 'none';
            const searchInput = document.getElementById('saleCustomerSearch');
            if (searchInput) {
                searchInput.focus();
                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // --- Turbo Keybindings ---
        
        // Add Arrow navigation for Add Item and Summary rows
        document.addEventListener('keydown', function(e) { if (e.defaultPrevented) return;
            if (e.defaultPrevented) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const activeId = document.activeElement ? document.activeElement.id : null;
                if (!activeId) return;
                
                const sequences = [
                    ['saleProductSearch', 'saleUnitSearch', 'saleQuantity', 'salePrice'],
                    ['saleCustomerSearch', 'discountAmount', 'courierCharges', 'paymentMethodSearch']
                ];
                
                // Jump from Add Item row downwards
                if (e.key === 'ArrowDown' && sequences[0].includes(activeId)) {
                    // Let the combobox dropdown handle its own ArrowDown
                    if (activeId === 'saleProductSearch' || activeId === 'saleUnitSearch') {
                        const dropdown = document.getElementById(activeId === 'saleProductSearch' ? 'saleProductDropdown' : 'saleUnitDropdown');
                        if (dropdown && dropdown.style.display !== 'none') return;
                    }
                    e.preventDefault();
                    if (typeof cart !== 'undefined' && cart.length > 0) {
                        window.setCartRowHighlight(0); // Focus first row of cart
                    } else {
                        const cust = document.getElementById('saleCustomerSearch');
                        if (cust) { cust.focus(); cust.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    }
                    return;
                }
                
                // Jump from Add Item row upwards to Product Search
                if (e.key === 'ArrowUp' && sequences[0].includes(activeId) && activeId !== 'saleProductSearch') {
                    if (activeId === 'saleUnitSearch') {
                        const dropdown = document.getElementById('saleUnitDropdown');
                        if (dropdown && dropdown.style.display !== 'none') return;
                    }
                    e.preventDefault();
                    const prod = document.getElementById('saleProductSearch');
                    if (prod) { prod.focus(); prod.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    return;
                }
                
                // Jump from Summary row upwards
                if (e.key === 'ArrowUp' && sequences[1].includes(activeId)) {
                    // Let the combobox dropdown handle its own ArrowUp
                    if (activeId === 'saleCustomerSearch' || activeId === 'paymentMethodSearch') {
                        const dropdown = document.getElementById(activeId === 'saleCustomerSearch' ? 'customerSearchResults' : 'paymentMethodDropdown');
                        if (dropdown && dropdown.style.display !== 'none') return;
                    }
                    e.preventDefault();
                    if (typeof cart !== 'undefined' && cart.length > 0) {
                        window.setCartRowHighlight(cart.length - 1); // Focus last row of cart
                    } else {
                        const prod = document.getElementById('saleProductSearch');
                        if (prod) { prod.focus(); prod.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    }
                    return;
                }
                
                // Specific jumps
                const jumps = {
                    'customerAmount': { 'ArrowUp': 'discountAmount', 'ArrowRight': 'btnCompleteSale' },
                    'btnCompleteSale': { 'ArrowDown': 'btnHoldSale', 'ArrowLeft': 'customerAmount' },
                    'btnHoldSale': { 'ArrowDown': 'btnClearCart', 'ArrowUp': 'btnCompleteSale', 'ArrowLeft': 'customerAmount' },
                    'btnClearCart': { 'ArrowUp': 'btnHoldSale', 'ArrowLeft': 'customerAmount' }
                };

                // Check horizontal sequences
                let handled = false;
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    for (let seq of sequences) {
                        const idx = seq.indexOf(activeId);
                        if (idx !== -1) {
                            const el = document.activeElement;
                            let atBoundary = false;
                            
                            // Let native dropdowns handle ArrowDown/Up
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                if (el.classList.contains('combobox-input')) return;
                            }
                            
                            try {
                                if (el.type === 'number' || activeId === 'paymentMethodSearch') {
                                    atBoundary = true;
                                } else if (e.key === 'ArrowRight' && el.selectionEnd === el.value.length) {
                                    atBoundary = true;
                                } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
                                    atBoundary = true;
                                }
                            } catch (err) {
                                atBoundary = true;
                            }
                            
                            if (atBoundary) {
                                if (e.key === 'ArrowRight' && idx < seq.length - 1) {
                                    e.preventDefault();
                                    const next = document.getElementById(seq[idx + 1]);
                                    if (next) { next.focus(); if (next.select) next.select(); }
                                    handled = true;
                                } else if (e.key === 'ArrowLeft' && idx > 0) {
                                    e.preventDefault();
                                    const prev = document.getElementById(seq[idx - 1]);
                                    if (prev) { prev.focus(); if (prev.select) prev.select(); }
                                    handled = true;
                                }
                            }
                            break;
                        }
                    }
                }
                
                // Check specific jumps if not handled
                if (!handled && jumps[activeId] && jumps[activeId][e.key]) {
                    // Make sure we only jump if we are at boundary for inputs
                    let atBoundary = true;
                    const el = document.activeElement;
                    if (el.tagName === 'INPUT' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                        try {
                            if (el.type !== 'number' && activeId !== 'paymentMethodSearch') {
                                if (e.key === 'ArrowRight' && el.selectionEnd !== el.value.length) atBoundary = false;
                                if (e.key === 'ArrowLeft' && el.selectionStart !== 0) atBoundary = false;
                            }
                        } catch(err){}
                    }
                    
                    if (atBoundary) {
                        e.preventDefault();
                        const nextId = jumps[activeId][e.key];
                        const next = document.getElementById(nextId);
                        if (next) { next.focus(); if (next.select) next.select(); }
                    }
                }
            }
        });

        function setupSalesKeybindings() {
            const searchInput = document.getElementById('saleProductSearch');
            const qtyInput = document.getElementById('saleQuantity');

            // Payment Fields
            const discInput = document.getElementById('discountAmount');
            const courierInput = document.getElementById('courierCharges');
            const custNameInput = document.getElementById('customerName');
            const payMethod = document.getElementById('paymentMethod');
            const custAmount = document.getElementById('customerAmount'); // For Cash

            // 1. Search Input Keydown (Only handle jumping to Shopping Cart if empty)
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    if (!searchInput.value.trim()) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // NEW: Jump to first cart row Qty if cart is not empty
                        if (typeof cart !== 'undefined' && cart.length > 0) {
                            window.setCartRowHighlight(0);
                            const firstQty = document.getElementById('cart-qty-0');
                            if (firstQty) {
                                firstQty.focus();
                                firstQty.select();
                            }
                        } else {
                            const customerSearch = document.getElementById('saleCustomerSearch');
                            if (customerSearch) {
                                customerSearch.focus();
                                customerSearch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }
                }
            });

            // 2. Quantity Input Keydown -> Handled by Form Submit (Enter) -> addItemToCart

            // --- Payment Section Navigation ---
            
            // Payment Method Combobox Navigation
            const payMethodSearch = document.getElementById('paymentMethodSearch');
            payMethodSearch.addEventListener('keydown', function(e) {
                const dropdown = document.getElementById('paymentMethodDropdown');
                let items = dropdown.querySelectorAll('.custom-dropdown-item');
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (dropdown.style.display !== 'block' || items.length === 0) {
                        filterPaymentMethods();
                        items = dropdown.querySelectorAll('.custom-dropdown-item');
                        if (items.length > 0) {
                            paymentComboboxSelectedIndex = 0;
                            updateComboboxSelection(items, paymentComboboxSelectedIndex);
                        }
                    } else if (items.length > 0) {
                        paymentComboboxSelectedIndex = (paymentComboboxSelectedIndex + 1) % items.length;
                        updateComboboxSelection(items, paymentComboboxSelectedIndex);
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (dropdown.style.display === 'block' && items.length > 0) {
                        if (paymentComboboxSelectedIndex === -1) paymentComboboxSelectedIndex = items.length;
                        paymentComboboxSelectedIndex = (paymentComboboxSelectedIndex - 1 + items.length) % items.length;
                        updateComboboxSelection(items, paymentComboboxSelectedIndex);
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (dropdown.style.display !== 'block') {
                        const cashInput = document.getElementById('customerAmount');
                        if (cashInput && document.getElementById('customerAmountGroup').style.display !== 'none') {
                            cashInput.focus();
                            cashInput.select();
                        } else {
                            document.getElementById('btnCompleteSale').focus();
                        }
                    } else if (paymentComboboxSelectedIndex >= 0 && items.length > paymentComboboxSelectedIndex) {
                        items[paymentComboboxSelectedIndex].click();
                    } else if (items.length > 0) {
                        items[0].click(); // Auto select first if Enter pressed
                    }
                } else if (e.key === ' ') {
                    if (dropdown.style.display !== 'block') {
                        e.preventDefault();
                        filterPaymentMethods();
                        items = dropdown.querySelectorAll('.custom-dropdown-item');
                        if (items.length > 0) {
                           paymentComboboxSelectedIndex = 0;
                           updateComboboxSelection(items, paymentComboboxSelectedIndex);
                        }
                    }
                } else if (e.key === 'Escape') {
                    dropdown.style.display = 'none';
                }
            });
        }

        // Call setup on load
        document.addEventListener('DOMContentLoaded', setupSalesKeybindings);

        function removeFromCart(index) {
            cart.splice(index, 1);
            updateCartDisplay();
        }

        function increaseQuantity(index) {
            if (index < 0 || index >= cart.length) return;

            const item = cart[index];
            const product = products.find(p => p.id === item.productId);

            if (!product) {
                showAlert('Product not found', '❌');
                return;
            }

            const prec = (product.quantityType === 'decimal') ? (product.decimalPrecision || 0.01) : 1;
            const newQty = parseFloat((item.quantity + prec).toFixed(3));
            
            // Check if we can increase quantity (stock availability)
            // Consider baseQuantity multiplier
            const currentStockInCart = cart
                .filter(cItem => cItem.productId === product.id && cItem !== item)
                .reduce((sum, cItem) => sum + (cItem.quantity * cItem.baseQuantity), 0);
                
            if (currentStockInCart + (newQty * item.baseQuantity) > product.stock) {
                showAlert(`Cannot increase quantity! Available stock: ${product.stock} ${product.unit || 'units'}`, '⚠️');
                return;
            }

            // Increase quantity
            item.quantity = newQty;
            item.total = item.quantity * item.price;

            updateCartDisplay();
        }

        
        function updateCartItemQuantity(index, value) {
            if (index < 0 || index >= cart.length) return;

            const item = cart[index];
            const product = products.find(p => p.id === item.productId);

            if (!product) {
                showAlert('Product not found', '❌');
                return;
            }

            const parsedQty = parseFloat(value);
            if (isNaN(parsedQty) || parsedQty <= 0) {
                showAlert('Please enter a valid quantity greater than 0.', '⚠️');
                updateCartDisplay();
                return;
            }

            const prec = (product.quantityType === 'decimal') ? (product.decimalPrecision || 0.01) : 1;
            
            if (product.quantityType === 'decimal') {
                const multiplier = Math.round(1 / prec);
                if (Math.abs((parsedQty * multiplier) % 1) > 0.001) {
                    showAlert(`Enter a valid quantity. This product allows quantities in steps of ${prec}.`, '⚠️');
                    updateCartDisplay();
                    return;
                }
            } else {
                if (!Number.isInteger(parsedQty)) {
                    showAlert(`This product requires a whole number quantity.`, '⚠️');
                    updateCartDisplay();
                    return;
                }
            }

            const currentStockInCart = cart
                .filter((cItem, idx) => cItem.productId === product.id && idx !== index)
                .reduce((sum, cItem) => sum + (cItem.quantity * cItem.baseQuantity), 0);
                
            if (currentStockInCart + (parsedQty * item.baseQuantity) > product.stock) {
                showAlert(`Cannot update quantity! Available stock: ${product.stock} ${product.unit || 'units'}`, '⚠️');
                updateCartDisplay();
                return;
            }

            item.quantity = parsedQty;
            item.total = item.quantity * item.price;
            updateCartDisplay();
        }

        function decreaseQuantity(index) {
            if (index < 0 || index >= cart.length) return;

            const item = cart[index];
            const product = products.find(p => p.id === item.productId);
            const prec = (product && product.quantityType === 'decimal') ? (product.decimalPrecision || 0.01) : 1;

            // Check if we can decrease quantity (minimum 1 or prec)
            if (parseFloat(item.quantity.toFixed(3)) <= prec) {
                popup(`Quantity is ${prec}.<br>Do you want to remove this item from cart?`, function () {
                    removeFromCart(index);
                });
                return;
            }

            // Decrease quantity
            item.quantity = parseFloat((item.quantity - prec).toFixed(3));
            item.total = item.quantity * item.price;

            updateCartDisplay();
        }

        function updateCartItemDiscount(index, value) {
            let item = cart[index];
            let valStr = String(value).trim();
            let isPercentage = valStr.includes('%');
            let parsedVal = parseFloat(valStr.replace('%', ''));
            
            if (isNaN(parsedVal) || parsedVal < 0) {
                showAlert('Invalid discount value.', '⚠️');
                updateCartDisplay();
                return;
            }

            let gross = item.quantity * item.price;
            let amount = isPercentage ? gross * (parsedVal / 100) : parsedVal;

            if (amount > gross) {
                showAlert('Discount cannot be greater than the item amount.', '⚠️');
                updateCartDisplay(); // reset input
                return;
            }

            item.discountType = isPercentage ? 'percentage' : 'amount';
            item.discountValue = parsedVal;
            item.discountPercent = isPercentage ? parsedVal : 0; // backward compat
            updateCartDisplay();
        }

        function updateCartDisplay() {
            const cartItemsDiv = document.getElementById('cartItems');
            const globalDiscountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
            
            // Tax Settings
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const gstEnabled = settings.gstEnabled === true;
            const businessState = settings.businessState || '';
            const customerStateEl = document.getElementById('customerState');
            const customerState = customerStateEl ? customerStateEl.value : '';
            const taxTypeEl = document.getElementById('saleTaxType');
            let taxTypeInput = taxTypeEl ? taxTypeEl.value : (settings.defaultTaxType || 'auto');
            const pricingMode = settings.taxPricingMode || 'exclusive';
            
            let taxType = taxTypeInput;
            if (taxType === 'auto') {
                if (businessState && customerState && businessState !== customerState) {
                    taxType = 'inter';
                } else {
                    taxType = 'intra';
                }
            }

            let totalGross = 0;
            let totalItemDiscount = 0;
            let totalTaxable = 0;
            let totalCGST = 0;
            let totalSGST = 0;
            let totalIGST = 0;
            let totalGST = 0;
            let grandTotal = 0;

            cart.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                const gstRate = (gstEnabled && product) ? (product.gstRate || 0) : 0;
                
                let grossAmount = item.quantity * item.price;
                let itemDiscountAmount = 0;
                let dType = item.discountType || 'percentage';
                let dVal = item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0);

                if (dType === 'percentage') {
                    itemDiscountAmount = grossAmount * (dVal / 100);
                } else {
                    itemDiscountAmount = dVal;
                }
                
                // Ensure no negative totals (fallback protection)
                if (itemDiscountAmount > grossAmount) itemDiscountAmount = grossAmount;

                let netInclusive = grossAmount - itemDiscountAmount;
                
                let taxableValue = 0;
                let cgst = 0, sgst = 0, igst = 0, itemTax = 0;
                let finalTotal = netInclusive; // Final total is always the discounted inclusive amount

                if (gstEnabled && gstRate > 0) {
                    taxableValue = netInclusive * 100 / (100 + gstRate);
                    itemTax = netInclusive - taxableValue;

                    if (taxType === 'intra') {
                        cgst = itemTax / 2;
                        sgst = itemTax / 2;
                    } else {
                        igst = itemTax;
                    }
                } else {
                    taxableValue = netInclusive;
                }

                item.discount = itemDiscountAmount;
                item.grossAmount = grossAmount;
                item.taxableValue = taxableValue;
                item.cgst = cgst;
                item.sgst = sgst;
                item.igst = igst;
                item.totalTax = itemTax;
                item.finalTotal = finalTotal;
                item.hsn = product ? (product.hsn || '') : '';
                item.gstRate = gstRate;

                totalGross += grossAmount;
                totalItemDiscount += item.discount;
                totalTaxable += taxableValue;
                totalCGST += cgst;
                totalSGST += sgst;
                totalIGST += igst;
                totalGST += itemTax;
                grandTotal += finalTotal;
            });

            // Adjust grandTotal with global discount and courier
            const courierCharges = parseFloat(document.getElementById('courierCharges').value) || 0;
            
            let discountRatio = 1;
            if (grandTotal > 0 && globalDiscountAmount > 0 && globalDiscountAmount <= grandTotal) {
                discountRatio = (grandTotal - globalDiscountAmount) / grandTotal;
            }

            const finalTaxableValue = totalTaxable * discountRatio;
            const finalCGST = totalCGST * discountRatio;
            const finalSGST = totalSGST * discountRatio;
            const finalIGST = totalIGST * discountRatio;

            let netGrandTotal = (grandTotal - globalDiscountAmount) + courierCharges;
            if (netGrandTotal < 0) netGrandTotal = 0;

            document.getElementById('cartSubtotal').value = grandTotal.toFixed(2);
            document.getElementById('cartTotal').value = netGrandTotal.toFixed(2);
            
            const elTopRightTotal = document.getElementById('topRightTotalAmount');
            if (elTopRightTotal) elTopRightTotal.textContent = netGrandTotal.toFixed(2);

            const elTaxable = document.getElementById('cartTaxableAmount');
            if (elTaxable) elTaxable.value = finalTaxableValue.toFixed(2);
            
            const elTotalItemDiscount = document.getElementById('cartTotalItemDiscount');
            if (elTotalItemDiscount) elTotalItemDiscount.value = totalItemDiscount.toFixed(2);
            
            const elCGST = document.getElementById('cartCGST');
            if (elCGST) elCGST.value = finalCGST.toFixed(2);
            
            const elSGST = document.getElementById('cartSGST');
            if (elSGST) elSGST.value = finalSGST.toFixed(2);
            
            const elIGST = document.getElementById('cartIGST');
            if (elIGST) elIGST.value = finalIGST.toFixed(2);
            
            const summaryTaxable = document.getElementById('summary-taxable');
            const summaryCGST = document.getElementById('summary-cgst');
            const summarySGST = document.getElementById('summary-sgst');
            const summaryIGST = document.getElementById('summary-igst');
            
            if (summaryTaxable) summaryTaxable.style.display = gstEnabled ? 'block' : 'none';
            if (summaryCGST) summaryCGST.style.display = (gstEnabled && taxType !== 'inter') ? 'block' : 'none';
            if (summarySGST) summarySGST.style.display = (gstEnabled && taxType !== 'inter') ? 'block' : 'none';
            if (summaryIGST) summaryIGST.style.display = (gstEnabled && taxType === 'inter') ? 'block' : 'none';
            
            if (cart.length === 0) {
                cartItemsDiv.innerHTML = '<div class="alert alert-info">Cart is empty. Add items to continue.</div>';
                return;
            }

            let tableHTML = `
                <div class="scanner-container" style="background: white; border: 2px solid #dee2e6; padding: 10px; border-radius: 8px;">
                    <style>
                        #cartItems table { font-size: 15px; }
                        #cartItems th { padding: 6px 4px !important; font-size: 15px; font-weight: bold; }
                        #cartItems td { padding: 6px 4px !important; vertical-align: middle; }
                        #cartItems td:nth-child(2) { max-width: 220px; white-space: normal; line-height: 1.2; word-wrap: break-word; }
                        #cartItems tr.cart-row-selected td { background-color: #e2e8f0 !important; outline: 1px solid #94a3b8; }
                        #cartItems .quantity-controls { gap: 2px; }
                        #cartItems .qty-btn { padding: 0 8px; font-size: 18px; height: 32px; font-weight: bold; line-height: 1; border-radius: 4px; width: 32px; }
                        #cartItems .qty-value { min-width: 28px; font-size: 16px; padding: 0; font-weight: bold; text-align: center; }
                        #cartItems input[type="number"] { padding: 2px 4px; height: 32px; font-size: 15px; width: 90px !important; text-align: center; font-weight: bold; border-radius: 4px; }
                        #cartItems .btn-sm { padding: 4px 10px; font-size: 14px; height: 32px; font-weight: bold; border-radius: 4px; }
                    </style>
                    <h4 style="margin: 0 0 10px 0; font-size: 22px; font-weight: bold; color: #004085;">🛒 Shopping Cart (${cart.length} item(s))</h4>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Product Name</th>
                                    ${gstEnabled ? `<th>HSN</th>` : ''}
                                    ${gstEnabled ? `<th>GST%</th>` : ''}
                                    <th>Qty</th>
                                    <th>Rate</th>
                                    <th>Discount</th>
                                    <th>Amount</th>
                                    <th>Subtotal</th>
                                    ${gstEnabled ? `<th>CGST</th>` : ''}
                                    ${gstEnabled ? `<th>SGST</th>` : ''}
                                    ${gstEnabled ? `<th>IGST</th>` : ''}
                                    <th>Total</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cart.map((item, index) => `
                                    <tr class="cart-row" id="cart-row-${index}">
                                        <td>${index + 1}</td>
                                        <td>${item.productName}</td>
                                        ${gstEnabled ? `<td>${item.hsn || ''}</td>` : ''}
                                        ${gstEnabled ? `<td>${item.gstRate || 0}%</td>` : ''}
                                        <td style="text-align: left; vertical-align: middle;">
                                            <div style="display: flex; align-items: center; justify-content: flex-start; gap: 8px;">
                                                <input type="number" id="cart-qty-${index}" value="${item.quantity}" class="form-control cart-qty-input" style="width: 100px; padding: 2px 8px; text-align: center; height: 32px; font-weight: bold;" min="0" step="any" onchange="updateCartItemQuantity(${index}, this.value)" onkeydown="handleCartInputKeydown(event, ${index}, 'qty')" onfocus="window.setCartRowHighlight(${index})">
                                                <span style="white-space: nowrap; font-weight: normal; color: #333;">${item.unit || ''}</span>
                                            </div>
                                        </td>
                                        <td>₹${item.price.toFixed(2)}</td>
                                        <td>
                                            <input type="text" id="cart-disc-${index}" value="${(item.discountType || 'percentage') === 'percentage' ? (item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0)) + '%' : (item.discountValue || 0)}" class="form-control cart-disc-input" style="width:75px; padding:2px; text-align:center; height: 32px;" onchange="updateCartItemDiscount(${index}, this.value)" onkeydown="handleCartInputKeydown(event, ${index}, 'disc')" onfocus="window.setCartRowHighlight(${index})">
                                        </td>
                                        <td>₹${item.grossAmount.toFixed(2)}</td>
                                        <td>₹${(item.taxableValue || 0).toFixed(2)}</td>
                                        ${gstEnabled ? `<td>₹${(item.cgst || 0).toFixed(2)}</td>` : ''}
                                        ${gstEnabled ? `<td>₹${(item.sgst || 0).toFixed(2)}</td>` : ''}
                                        ${gstEnabled ? `<td>₹${(item.igst || 0).toFixed(2)}</td>` : ''}
                                        <td><strong>₹${item.finalTotal.toFixed(2)}</strong></td>
                                        <td><button class="btn btn-cart-remove btn-sm" onclick="removeFromCart(${index})">Remove</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
            `;
            
            tableHTML += `</div>`;
            cartItemsDiv.innerHTML = tableHTML;
            calculateChange();
        }



        function togglePaymentFields() {
            const paymentMethod = document.getElementById('paymentMethod').value;
            const customerAmountGroup = document.getElementById('customerAmountGroup');
            const otherPaymentGroup = document.getElementById('otherPaymentGroup');
            const changeAmountGroup = document.getElementById('changeAmountGroup');
            const creditPaymentGroup = document.getElementById('creditPaymentGroup');
            const cashAmountInput = document.getElementById('customerAmount');
            const cashAmountError = document.getElementById('cashAmountError');

            if (paymentMethod === 'cash') {
                customerAmountGroup.style.display = 'block';
                otherPaymentGroup.style.display = 'none';
                changeAmountGroup.style.display = 'block';
                if (creditPaymentGroup) creditPaymentGroup.style.display = 'none';
                document.getElementById('otherPaymentAmount').value = '0';
                cashAmountInput.required = true;
                cashAmountInput.value = document.getElementById('cartTotal').value || '0.00';
                if (cashAmountError) cashAmountError.style.display = 'none';
                calculateChange();
            } else if (paymentMethod === 'mixed') {
                customerAmountGroup.style.display = 'block';
                otherPaymentGroup.style.display = 'block';
                changeAmountGroup.style.display = 'block';
                if (creditPaymentGroup) creditPaymentGroup.style.display = 'none';
                cashAmountInput.required = true;
                cashAmountInput.value = document.getElementById('cartTotal').value || '0.00';
                if (cashAmountError) cashAmountError.style.display = 'none';
                calculateChange();
            } else if (paymentMethod === 'credit') {
                customerAmountGroup.style.display = 'none';
                otherPaymentGroup.style.display = 'none';
                changeAmountGroup.style.display = 'none';
                if (creditPaymentGroup) creditPaymentGroup.style.display = 'block';
                cashAmountInput.required = false;
                document.getElementById('customerAmount').value = '';
                document.getElementById('otherPaymentAmount').value = '0';
                document.getElementById('changeAmount').value = '';
                if (cashAmountError) cashAmountError.style.display = 'none';
                calculateChange();
            } else {
                customerAmountGroup.style.display = 'none';
                otherPaymentGroup.style.display = 'none';
                changeAmountGroup.style.display = 'none';
                if (creditPaymentGroup) creditPaymentGroup.style.display = 'none';
                cashAmountInput.required = false;
                document.getElementById('customerAmount').value = '';
                document.getElementById('otherPaymentAmount').value = '0';
                document.getElementById('changeAmount').value = '';
                if (cashAmountError) cashAmountError.style.display = 'none';
            }
        }



        function validateCashAmount() {
            const cashAmountInput = document.getElementById('customerAmount');
            const cashAmountError = document.getElementById('cashAmountError');
            const paymentMethod = document.getElementById('paymentMethod').value;

            if (paymentMethod === 'cash' || paymentMethod === 'mixed') {
                const cashAmount = parseFloat(cashAmountInput.value) || 0;

                if (cashAmountInput.value === '' || cashAmountInput.value === null) {
                    cashAmountError.textContent = 'Cash Received is required';
                    cashAmountError.style.display = 'block';
                    cashAmountInput.style.borderColor = '#dc3545';
                    return false;
                } else if (cashAmount < 0) {
                    cashAmountError.textContent = 'Cash Received cannot be negative';
                    cashAmountError.style.display = 'block';
                    cashAmountInput.style.borderColor = '#dc3545';
                    return false;
                } else {
                    cashAmountError.style.display = 'none';
                    cashAmountInput.style.borderColor = '#dee2e6';
                    return true;
                }
            }
            return true;
        }

        function calculateChange() {
            const total = parseFloat(document.getElementById('cartTotal').value) || 0;
            const paymentMethod = document.getElementById('paymentMethod').value;
            const customerAmountInput = document.getElementById('customerAmount');
            const customerAmount = parseFloat(customerAmountInput.value) || 0;
            const otherPaymentAmount = parseFloat(document.getElementById('otherPaymentAmount').value) || 0;

            // Validate cash amount in real-time
            if (paymentMethod === 'cash' || paymentMethod === 'mixed') {
                validateCashAmount();
            }

            let change = 0;
            let totalReceived = 0;

            if (paymentMethod === 'credit') {
                let creditPaid = parseFloat(document.getElementById('creditAmountPaid').value) || 0;
                
                if (creditPaid > total) {
                    creditPaid = total;
                    document.getElementById('creditAmountPaid').value = creditPaid;
                }
                if (creditPaid < 0) {
                    creditPaid = 0;
                    document.getElementById('creditAmountPaid').value = 0;
                }

                const outstanding = total - creditPaid;
                document.getElementById('creditOutstanding').value = outstanding > 0 ? '₹' + outstanding.toFixed(2) : '₹0.00';
                
                const advanceSection = document.getElementById('inlineAdvancePaymentSection');
                advanceSection.style.display = 'block'; // Always show
                
                const method = document.getElementById('creditPaymentMethod').value;
                const refGroup = document.getElementById('inlineReferenceGroup');
                if (method === 'upi' || method === 'bank' || method === 'cheque' || method === 'card' || method === 'other') {
                    refGroup.style.display = 'block';
                } else {
                    refGroup.style.display = 'none';
                }
            }

            if (paymentMethod === 'cash') {
                totalReceived = customerAmount;
                change = customerAmount - total;
            } else if (paymentMethod === 'mixed') {
                totalReceived = customerAmount + otherPaymentAmount;
                change = customerAmount - (total - otherPaymentAmount); // Change is only for cash portion
            } else {
                totalReceived = total; // Card/UPI/Credit - full amount
                change = 0;
            }

            // Show negative value if customer gives less (e.g., -30)
            const changeAmountInput = document.getElementById('changeAmount');
            if (paymentMethod === 'cash' || paymentMethod === 'mixed') {
                changeAmountInput.value = change.toFixed(2);
            } else {
                changeAmountInput.value = '0.00';
            }

            const negativeChangeInfo = document.getElementById('negativeChangeInfo');
            const negativeChangeText = document.getElementById('negativeChangeText');
            const negativeChangeCountDisplay = document.getElementById('negativeChangeCount');

            // Check if cash amount is negative
            if ((paymentMethod === 'cash' || paymentMethod === 'mixed') && customerAmount < 0) {
                changeAmountInput.style.color = '#dc3545';
                if (negativeChangeInfo) {
                    negativeChangeInfo.style.display = 'block';
                    negativeChangeText.textContent = `Invalid: Cash cannot be negative`;
                    negativeChangeCountDisplay.textContent = negativeChangeCount;
                }
                return;
            }

            // Check if total payment is insufficient
            if (totalReceived < total) {
                changeAmountInput.style.color = '#dc3545';
                // Show negative change info with count
                if (negativeChangeInfo) {
                    negativeChangeInfo.style.display = 'block';
                    const shortBy = total - totalReceived;
                    negativeChangeText.textContent = `Short by: ₹${shortBy.toFixed(2)}`;
                    negativeChangeCountDisplay.textContent = negativeChangeCount;
                }
            } else if (change < 0 && paymentMethod === 'cash') {
                // Cash payment but insufficient
                changeAmountInput.style.color = '#dc3545';
                if (negativeChangeInfo) {
                    negativeChangeInfo.style.display = 'block';
                    negativeChangeText.textContent = `Short by: ₹${Math.abs(change).toFixed(2)}`;
                    negativeChangeCountDisplay.textContent = negativeChangeCount;
                }
            } else {
                changeAmountInput.style.color = change >= 0 ? '#28a745' : '#dc3545';
                if (negativeChangeInfo) {
                    negativeChangeInfo.style.display = 'none';
                }
            }
        }

        function generateReceiptNumber() {
            if (typeof isDemoMode === 'function' && isDemoMode()) {
                return "DEMO SALE " + Math.random().toString().slice(2, 8);
            }
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            
            const prefix = (settings.invoicePrefix || '').trim();
            let num = parseInt(settings.invoiceNextNumber) || 1;
            let sep = settings.invoiceSeparator || '-';
            if (sep === 'none') sep = '';
            if (sep === 'custom') sep = settings.invoiceCustomSeparator || '';
            const yr = (settings.invoiceYear || '').trim();
            const pad = parseInt(settings.invoicePadding) || 4;

            let isUnique = false;
            let formattedStr = '';
            
            while (!isUnique) {
                const numStr = String(num).padStart(pad, '0');
                let parts = [];
                if (prefix) parts.push(prefix);
                parts.push(numStr);
                if (yr) parts.push(yr);
                
                formattedStr = parts.join(sep);
                
                // Check if this invoice number already exists in sales
                const exists = sales.some(s => s.receiptNumber === formattedStr);
                if (!exists) {
                    isUnique = true;
                } else {
                    num++; // Increment and try again to guarantee uniqueness
                }
            }

            // Save the next number for future sales
            settings.invoiceNextNumber = num + 1;
            localStorage.setItem('settings', JSON.stringify(settings));

            return formattedStr;
        }


        function isFutureDate(isoString) {
            if (!isoString) return false;
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayIso = `${year}-${month}-${day}`;
            return isoString > todayIso;
        }

        function normalizeSaleDate(input) {
            if (!input) return { valid: false };
            input = input.trim().replace(/\s+/g, '');
            let d, m, y;
            if (/^\d{8}$/.test(input)) {
                d = input.substring(0, 2);
                m = input.substring(2, 4);
                y = input.substring(4, 8);
            } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(input)) {
                const parts = input.split(/[/-]/);
                d = parts[0].padStart(2, '0');
                m = parts[1].padStart(2, '0');
                y = parts[2];
            } else {
                return { valid: false };
            }

            const day = parseInt(d, 10);
            const month = parseInt(m, 10);
            const year = parseInt(y, 10);
            
            const dateObj = new Date(year, month - 1, day);
            if (dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day) {
                return {
                    valid: true,
                    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                    display: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
                };
            }
            return { valid: false };
        }

        function normalizeSaleDateInput(el) {
            if (typeof isDemoMode === 'function' && isDemoMode()) return;
            if (!el.value) return;
            const res = normalizeSaleDate(el.value);
            if (res.valid) {
                if (typeof isFutureDate === 'function' && isFutureDate(res.iso)) {
                    showAlert('Future dates are not allowed. Please enter today or a previous date.', '⚠️');
                    resetSaleDateToToday();
                } else {
                    el.value = res.display;
                    el.dataset.isoDate = res.iso;
                }
            } else {
                showAlert('Invalid date. Please enter a valid date in DDMMYYYY format.', '⚠️');
                resetSaleDateToToday();
            }
        }

        function handleNativePickerChange(el) {
            if (typeof isDemoMode === 'function' && isDemoMode()) return;
            if (el.value) {
                if (typeof isFutureDate === 'function' && isFutureDate(el.value)) {
                    showAlert('Future dates are not allowed. Please enter today or a previous date.', '⚠️');
                    resetSaleDateToToday();
                    return;
                }
                const parts = el.value.split('-');
                const display = `${parts[2]}/${parts[1]}/${parts[0]}`;
                const textInput = document.getElementById('customSaleDate');
                if (textInput) {
                    textInput.value = display;
                    textInput.dataset.isoDate = el.value;
                }
            }
        }

        function resetSaleDateToToday() {
            const el = document.getElementById('customSaleDate');
            if (el) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                el.value = `${day}/${month}/${year}`;
                el.dataset.isoDate = `${year}-${month}-${day}`;
            }
        }
        
        // Add to window load so it gets evaluated immediately and overrides any cached values
        window.addEventListener('DOMContentLoaded', resetSaleDateToToday);

        function completeSale() {

            if (typeof isDemoMode === 'function' && isDemoMode()) {
                const systemDateStr = new Date().toISOString().slice(0, 10);
                if (!canCreateDemoSale(systemDateStr)) {
                    showDemoLimitMessage('sales');
                    return;
                }
            }

            if (!navigator.onLine) {
                showAlert('⚠️ Warning: You are offline. Changes will be saved locally.', 'offline');
            }
            if (cart.length === 0) {
                showAlert('Cart is empty. Please add items first.', '⚠️');
                return;
            }

            let customerId = '';
            let customerName = 'Walk-in Customer';
            let customerType = 'walk-in';
            let customerGSTIN = '';
            let customerAddress = '';
            let customerState = '';
            let customerPhone = '';

            customerId = document.getElementById('activeCustomerId').value;
            if (customerId) {
                customerType = 'existing';
                customerName = document.getElementById('displayCustomerName').innerText;
                if (!customerName) customerName = 'Walk-in Customer';
                customerGSTIN = document.getElementById('displayCustomerGSTIN').innerText;
                if (customerGSTIN === 'No GSTIN') customerGSTIN = '';
                customerState = document.getElementById('displayCustomerState').innerText;
                if (customerState === 'No State') customerState = '';
                customerPhone = document.getElementById('displayCustomerPhone').innerText;
                if (customerPhone === 'No Phone') customerPhone = '';
            }

            // Fallback for legacy fields if Walk-in or no customer selected
            if ((!customerId || customerType === 'walk-in') && document.getElementById('customerName')) {
                customerName = document.getElementById('customerName').value || 'Walk-in Customer';
                customerGSTIN = document.getElementById('customerGSTIN') ? document.getElementById('customerGSTIN').value : '';
                customerAddress = document.getElementById('customerAddress') ? document.getElementById('customerAddress').value : '';
                const customerStateEl = document.getElementById('customerState');
                customerState = customerStateEl ? customerStateEl.value : '';
            }
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const taxTypeEl = document.getElementById('saleTaxType');
            let taxTypeInput = taxTypeEl ? taxTypeEl.value : (settings.defaultTaxType || 'auto');
            
            let taxType = taxTypeInput;
            if (taxType === 'auto') {
                const businessState = settings.businessState || '';
                if (businessState && customerState && businessState !== customerState) {
                    taxType = 'inter';
                } else {
                    taxType = 'intra';
                }
            }
            
            const paymentMethod = document.getElementById('paymentMethod').value;
            const discount = parseFloat(document.getElementById('discountAmount').value) || 0;
            const courier = parseFloat(document.getElementById('courierCharges').value) || 0;
            const subtotal = cart.reduce((sum, item) => sum + (item.finalTotal !== undefined ? item.finalTotal : item.total), 0);
            const total = parseFloat(document.getElementById('cartTotal').value) || 0;

            if (paymentMethod === 'credit' && (!customerId || customerType === 'walk-in' || customerName === 'Walk-in Customer')) {
                showAlert('❌ Customer details are required for credit sales.\n\nPlease select or add a customer before completing the sale.', '⚠️');
                const searchCustomerInput = document.getElementById('saleCustomerSearch');
                if (searchCustomerInput) {
                    searchCustomerInput.focus();
                    searchCustomerInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }

            // Validate Cash Received field for cash and mixed payments
            if (paymentMethod === 'cash' || paymentMethod === 'mixed') {
                const cashAmountInput = document.getElementById('customerAmount');
                const customerAmount = parseFloat(cashAmountInput.value);

                // Check if Cash Received is filled
                if (!customerAmount || customerAmount <= 0) {
                    showAlert('❌ Cash Received (₹) is required!\n\nPlease enter the cash amount received from the customer.', '💵');
                    document.getElementById('customerAmount').focus();
                    return;
                }

                // Check if Cash Received is negative
                if (customerAmount < 0) {
                    negativeChangeCount++;
                    localStorage.setItem('negativeChangeCount', negativeChangeCount.toString());
                    document.getElementById('negativeChangeCount').textContent = negativeChangeCount;
                    showAlert('❌ Sale cannot be completed!\n\nCash Received cannot be negative.\n\nPlease enter a valid positive amount.', '⚠️');
                    return;
                }
            }

            const customerAmount = parseFloat(document.getElementById('customerAmount').value) || 0;
            const otherPaymentAmount = parseFloat(document.getElementById('otherPaymentAmount').value) || 0;
            const creditAmountPaid = parseFloat(document.getElementById('creditAmountPaid').value) || 0;
            const creditOutstanding = total - creditAmountPaid;
            const creditPaymentMethod = document.getElementById('creditPaymentMethod') ? document.getElementById('creditPaymentMethod').value : 'cash';
            const creditDueDate = document.getElementById('creditDueDate') ? document.getElementById('creditDueDate').value : '';

            // Calculate total received
            let totalReceived = 0;
            if (paymentMethod === 'cash') {
                totalReceived = customerAmount;
            } else if (paymentMethod === 'mixed') {
                totalReceived = customerAmount + otherPaymentAmount;
            } else if (paymentMethod === 'credit') {
                totalReceived = creditAmountPaid;
            } else {
                totalReceived = total; // Card/UPI - assume full payment
            }

            if (paymentMethod === 'credit' && totalReceived > total) {
                showAlert(`❌ Amount Paid cannot be greater than Total Amount for a credit sale!`, '⚠️');
                return;
            }
            
            if (paymentMethod === 'credit' && totalReceived > 0 && (!creditPaymentMethod || creditPaymentMethod === '')) {
                showAlert('❌ Please select an advance payment method.', '⚠️');
                return;
            }

            // Prevent sale if amount is short (negative) (skip for credit as it implies a short payment)
            if (paymentMethod !== 'credit' && totalReceived < total) {
                const shortBy = total - totalReceived;
                negativeChangeCount++;
                localStorage.setItem('negativeChangeCount', negativeChangeCount.toString());
                document.getElementById('negativeChangeCount').textContent = negativeChangeCount;
                showAlert(`❌ Sale cannot be completed!\n\nTotal: ₹${total.toFixed(2)}\nReceived: ₹${totalReceived.toFixed(2)}\nShort by: ₹${shortBy.toFixed(2)}\n\nPlease collect the full amount before completing the sale.`, '⚠️');
                return;
            }

            // Additional validation for cash payments
            if (paymentMethod === 'cash' && customerAmount < total) {
                const shortBy = total - customerAmount;
                negativeChangeCount++;
                localStorage.setItem('negativeChangeCount', negativeChangeCount.toString());
                document.getElementById('negativeChangeCount').textContent = negativeChangeCount;
                showAlert(`❌ Sale cannot be completed!\n\nTotal: ₹${total.toFixed(2)}\nCash Received: ₹${customerAmount.toFixed(2)}\nShort by: ₹${shortBy.toFixed(2)}\n\nPlease collect the full amount before completing the sale.`, '⚠️');
                return;
            }

            // Check stock availability
            for (let item of cart) {
                const product = products.find(p => p.id === item.productId);
                let itemAvailStock = 0;
                if (product) {
                    if (item.variantId) {
                        const vObj = window.getVariantById(product, item.variantId);
                        itemAvailStock = vObj ? (vObj.stock || 0) : 0;
                    } else {
                        itemAvailStock = product.stock || 0;
                    }
                }
                const neededBaseQty = (item.quantity || 0) * (item.baseQuantity || 1);
                if (!product || itemAvailStock < neededBaseQty) {
                    showAlert(`Insufficient stock for ${item.productName}! Available: ${itemAvailStock} units`, '⚠️');
                    return;
                }
            }

            const _settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            if (_settings.enableSalesDate && !(typeof isDemoMode === 'function' && isDemoMode())) {
                const _customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').dataset.isoDate : '';
                if (_customDateVal && typeof isFutureDate === 'function' && isFutureDate(_customDateVal)) {
                    showAlert('Future dates are not allowed. Please enter today or a previous date.', '⚠️');
                    if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();
                    return;
                }
            }

            // Confirm Completion
            showConfirm(`Complete sale for ₹${totalReceived.toFixed(2)}?`, async () => {
                // Generate receipt number in format: {saleNumber}-{month}{year}
                const receiptNumber = generateReceiptNumber();

                // Create sale records and update stock
                const saleId = Date.now();
                let saleDate = new Date().toISOString();
                const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
                if (settings.enableSalesDate) {
                    if (typeof isDemoMode === 'function' && isDemoMode()) {
                        // Demo Mode forces system date
                    } else {
                        const customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').dataset.isoDate : '';
                        if (customDateVal) {
                            // Use custom date but preserve current time for ordering
                            const now = new Date();
                            const timePart = now.toISOString().split('T')[1];
                            saleDate = `${customDateVal}T${timePart}`;
                        }
                    }
                }
                const saleItems = [];

                // Calculate payment details
                let cashAmount = 0;
                let otherAmount = 0;
                let change = 0;

                if (paymentMethod === 'cash') {
                    cashAmount = customerAmount;
                    change = customerAmount - total;
                } else if (paymentMethod === 'mixed') {
                    cashAmount = customerAmount;
                    otherAmount = otherPaymentAmount;
                    change = customerAmount - (total - otherPaymentAmount);
                } else {
                    otherAmount = total;
                }

                cart.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        // Optimistically deduct stock locally for display (will be overwritten by cloud logic)
                        // Actually, we should NOT update local stock yet. 
                        // We will refresh from cloud after success.
                        // But to keep UI snappy, we might want to?
                        // "i dont want local data saving" -> User wants strict cloud truth.

                        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null') || {};

                        const sale = {
                            id: saleId + saleItems.length,
                            saleId: saleId, // Group items from same sale
                            receiptNumber: receiptNumber, // Receipt number in format
                            isDemo: (typeof isDemoMode === 'function' && isDemoMode()),
                            userId: currentUser.id || '',
                            username: currentUser.username || currentUser.name || '',
                            userCode: currentUser.userCode || '-',
                            counterCode: currentUser.userCode || '-',
                            date: saleDate,
                            createdAt: new Date().toISOString(),
                            productId: item.productId,
                            variantId: item.variantId || undefined,
                            variantName: item.variantName || undefined,
                            productName: item.productName,
                            barcode: item.barcode,
                            unit: item.unit || 'Piece',
                            quantity: item.quantity,
                            price: item.price,
                            total: item.finalTotal !== undefined ? item.finalTotal : item.total,
                            grossAmount: item.grossAmount || 0,
                            taxableValue: item.taxableValue || 0,
                            cgst: item.cgst || 0,
                            sgst: item.sgst || 0,
                            igst: item.igst || 0,
                            totalTax: item.totalTax || 0,
                            itemDiscount: item.discount || 0,
                            discountType: item.discountType || 'percentage',
                            discountValue: item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0),
                            discountPercent: item.discountPercent || 0,
                            gstRate: item.gstRate || 0,
                            hsn: item.hsn || '',
                            customerId: customerId,
                            customerType: customerType,
                            customerName: customerName,
                            customerPhone: customerPhone,
                            customerGSTIN: customerGSTIN,
                            customerAddress: customerAddress,
                            customerState: customerState,
                            taxType: taxType,
                            paymentMethod: paymentMethod,
                            subtotal: subtotal,
                            discount: discount,
                            courier: courier,
                            cashAmount: cashAmount,
                            otherPaymentAmount: otherAmount,
                            customerAmount: totalReceived,
                            change: change,
                            // Store base unit quantity for stock deduction logic
                            baseQuantity: item.baseQuantity || 1,
                            gstApplied: settings.gstEnabled === true,
                            
                            // Credit Payment Tracking
                            paymentStatus: paymentMethod === 'credit' ? (creditOutstanding <= 0 ? 'fully_paid' : (creditAmountPaid > 0 ? 'partially_paid' : 'unpaid')) : 'fully_paid',
                            amountPaid: paymentMethod === 'credit' ? creditAmountPaid : totalReceived,
                            outstandingAmount: paymentMethod === 'credit' ? creditOutstanding : 0,
                            dueDate: paymentMethod === 'credit' ? creditDueDate : '',
                            paymentHistory: paymentMethod === 'credit' && creditAmountPaid > 0 ? [{
                                date: saleDate,
                                amount: creditAmountPaid,
                                method: creditPaymentMethod,
                                reference: document.getElementById('creditReference') ? document.getElementById('creditReference').value : '',
                                notes: 'Initial Payment'
                            }] : []
                        };

                        // sales.push(sale); // DO NOT PUSH LOCALLY YET
                        saleItems.push(sale);
                    }
                });

                // LOCAL SAVE
                const currentUserObj = JSON.parse(sessionStorage.getItem('currentUser') || 'null') || {};
                // Store sale data for receipt
                lastSaleData = {
                    saleId: saleId,
                    receiptNumber: receiptNumber,
                    date: saleDate,
                    counterCode: currentUserObj.userCode || '-',
                    items: saleItems, // These are just the objects we created
                    customerName: customerName,
                    paymentMethod: paymentMethod,
                    subtotal: subtotal,
                    discount: discount,
                    courier: courier,
                    total: total,
                    cashAmount: cashAmount,
                    otherPaymentAmount: otherAmount,
                    customerAmount: totalReceived,
                    change: change,
                    gstApplied: settings.gstEnabled === true
                };

                // Deduct stock locally
                saleItems.forEach(sale => {
                    const productIndex = products.findIndex(p => p.id === sale.productId);
                    if (productIndex !== -1) {
                        const qtyToDeduct = (sale.quantity * (sale.baseQuantity || 1));
                        const productRef = products[productIndex];
                        let variantRef = null;
                        if (sale.variantId) {
                            variantRef = window.getVariantById(productRef, sale.variantId);
                        }
                        
                        if (variantRef) {
                            variantRef.stock = parseFloat(((variantRef.stock || 0) - qtyToDeduct).toFixed(3));
                        } else {
                            productRef.stock = parseFloat(((productRef.stock || 0) - qtyToDeduct).toFixed(3));
                        }
                        
                        // Add to stock history
                        stockHistory.push({
                            date: sale.date,
                            productId: sale.productId,
                            variantId: sale.variantId || undefined,
                            productName: sale.productName,
                            type: 'sale',
                            quantity: sale.quantity,
                            details: `Sold (Receipt: ${sale.receiptNumber})`
                        });
                    }
                });

                // Calculate discount distribution to prevent duplicating the bill discount
                let remainingDiscount = lastSaleData.discount;
                const totalAmountForDiscount = lastSaleData.subtotal;
                
                saleItems.forEach((sale, index) => {
                    let itemDiscount = 0;
                    if (lastSaleData.discount > 0 && totalAmountForDiscount > 0) {
                        if (index === saleItems.length - 1) {
                            itemDiscount = parseFloat(remainingDiscount.toFixed(2));
                        } else {
                            itemDiscount = parseFloat(((sale.total / totalAmountForDiscount) * lastSaleData.discount).toFixed(2));
                            remainingDiscount -= itemDiscount;
                        }
                    }

                    // Push to master sales array
                    sales.push({
                        ...sale,
                        discount: itemDiscount, // OVERWRITE with proportional item discount
                        billDiscount: lastSaleData.discount // Save total for reference if needed
                    });
                });

                // Save locally
                saveData();

                // Clear cart and form
                cart = [];
                document.getElementById('addItemForm').reset();
                if(typeof clearCustomerSelection === 'function') clearCustomerSelection();
                if(document.getElementById('customerName')) document.getElementById('customerName').value = '';
                
                document.getElementById('otherPaymentAmount').value = '0';
                document.getElementById('discountAmount').value = '0'; // Reset Discount
                document.getElementById('courierCharges').value = '0'; // Reset Courier
                document.getElementById('paymentMethod').value = 'cash';
                document.getElementById('paymentMethodSearch').value = 'Cash Only'; // Update combobox input
                
                updateCartDisplay();
                togglePaymentFields();
                
                document.getElementById('changeAmount').value = '';
                document.getElementById('creditAmountPaid').value = '0';
                document.getElementById('creditOutstanding').value = '0';
                document.getElementById('creditPaymentMethod').value = 'cash';
                document.getElementById('creditDueDate').value = '';

                // Refresh UI immediately
                updateTodaysSales();
                updateDashboard();
                updateInventoryTable();

                // Show receipt
                showReceipt();
            });
        }

        function openPOModal(clear = true) {
            const modal = document.getElementById('purchaseOrderModal');
            modal.classList.add('active');

            const dateInput = document.getElementById('poDate');
            const numberInput = document.getElementById('poNumber');
            const supplierInput = document.getElementById('poSupplier');

            if (clear) {
                dateInput.valueAsDate = new Date();
                numberInput.value = generatePONumber();
                supplierInput.value = '';
                poCart = [];
                resetPOSearch();
            } else {
                // If not clearing, ensure we have values
                if (!dateInput.value) dateInput.valueAsDate = new Date();
                if (!numberInput.value) numberInput.value = generatePONumber();
            }

            updatePOTable();
            updatePOCount(); // Ensure count is synced
        }

        function showReceipt() {
            if (!lastSaleData) return;
            document.getElementById('saleReceipt').style.display = 'flex';

            const receiptContent = document.getElementById('receiptContent');
            const date = new Date(lastSaleData.date);

            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            
            // Determine if GST was applied for THIS sale
            // For historical sales: use the stored gstApplied flag
            // For new sales without flag: fall back to current settings
            const saleGstApplied = lastSaleData.gstApplied !== undefined ? lastSaleData.gstApplied : settings.gstEnabled;
            // Show GST on receipt only if GST was applied AND receipt showGST is enabled
            const showGstOnReceipt = saleGstApplied && settings.showGST;
            
            const businessNameStr = settings.businessName || 'Sales Receipt';
            const addressStr = settings.address ? `<p style="font-size:12px; margin:2px 0;">${settings.address.replace(/\n/g, '<br>')}</p>` : '';
            const mobileStr = settings.mobile ? `<p style="font-size:12px; margin:2px 0;">Ph: ${settings.mobile}</p>` : '';
            const gstinStr = settings.gstin && showGstOnReceipt ? `<p style="font-size:12px; margin:2px 0;">GSTIN: ${settings.gstin}</p>` : '';
            
            const firstItem = lastSaleData.items && lastSaleData.items.length > 0 ? lastSaleData.items[0] : null;
            let customerStr = '';
            if (settings.showCustomer && lastSaleData.customerName) {
                customerStr += `<p><strong>Customer:</strong> ${lastSaleData.customerName}</p>`;
                if (firstItem && firstItem.customerGSTIN) customerStr += `<p><strong>GSTIN:</strong> ${firstItem.customerGSTIN}</p>`;
                if (firstItem && firstItem.customerAddress) customerStr += `<p><strong>Address:</strong> ${firstItem.customerAddress}</p>`;
                if (firstItem && firstItem.customerState) customerStr += `<p><strong>State:</strong> ${firstItem.customerState}</p>`;
            }
            
            const footerStr = settings.footerMsg ? `<hr><p style="text-align: center; margin-top: 20px;">${settings.footerMsg.replace(/\n/g, '<br>')}</p>` : '<hr><p style="text-align: center; margin-top: 20px;">Thank you for your purchase!</p>';

            receiptContent.innerHTML = `
                <div class="receipt-container">
                    <h3 style="text-align: center; margin-bottom: 5px;">${businessNameStr}</h3>
                    ${addressStr}
                    ${mobileStr}
                    ${gstinStr}
                    <hr>
                    <p><strong>Date:</strong> ${date.toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${date.toLocaleTimeString()}</p>
                    <p><strong>Receipt #:</strong> ${lastSaleData.receiptNumber}</p>
                    <p><strong>Counter:</strong> ${lastSaleData.counterCode || '-'}</p>
                    <div style="text-align: center; margin: 10px 0;">
                        <svg id="receiptBarcode"></svg>
                    </div>
                    ${customerStr}
                    <hr>
                    <table style="width: 100%; margin: 10px 0;">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Item</th>
                                ${showGstOnReceipt ? '' : '<th style="text-align: left;">Unit</th>'}
                                <th style="text-align: right;">Qty</th>
                                <th style="text-align: right;">Rate</th>
                                ${showGstOnReceipt ? '<th style="text-align: right;">GST%</th>' : ''}
                                <th style="text-align: right;">${showGstOnReceipt ? 'Amount' : 'Total'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lastSaleData.items.map(item => `
                                <tr>
                                    <td>${item.productName}</td>
                                    ${showGstOnReceipt ? '' : `<td>${item.unit || 'Piece'}</td>`}
                                    <td style="text-align: right;">${item.quantity} ${item.unit || ''}</td>
                                    <td style="text-align: right;">₹${item.price.toFixed(2)}</td>
                                    ${showGstOnReceipt ? `<td style="text-align: right;">${item.gstRate || 0}%</td>` : ''}
                                    <td style="text-align: right;">₹${item.total.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" style="text-align: right;">Subtotal:</td>
                                <td style="text-align: right;">₹${(lastSaleData.subtotal || 0).toFixed(2)}</td>
                            </tr>
                            ${(settings.showDiscount && lastSaleData.discount > 0) ? `
                            <tr>
                                <td colspan="4" style="text-align: right;">Discount:</td>
                                <td style="text-align: right;">- ₹${lastSaleData.discount.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            ${lastSaleData.courier && lastSaleData.courier > 0 ? `
                            <tr>
                                <td colspan="4" style="text-align: right;">Courier Charges:</td>
                                <td style="text-align: right;">₹${lastSaleData.courier.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            ${showGstOnReceipt ? `
                            <tr>
                                <td colspan="4" style="text-align: right;">Total Taxable Value:</td>
                                <td style="text-align: right;">₹${lastSaleData.items.reduce((sum, item) => sum + (item.taxableValue || 0), 0).toFixed(2)}</td>
                            </tr>
                            ${lastSaleData.items.some(i => i.taxType === 'inter') ? `
                            <tr>
                                <td colspan="4" style="text-align: right;">Total IGST:</td>
                                <td style="text-align: right;">₹${lastSaleData.items.reduce((sum, item) => sum + (item.igst || 0), 0).toFixed(2)}</td>
                            </tr>
                            ` : `
                            <tr>
                                <td colspan="4" style="text-align: right;">Total CGST:</td>
                                <td style="text-align: right;">₹${lastSaleData.items.reduce((sum, item) => sum + (item.cgst || 0), 0).toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td colspan="4" style="text-align: right;">Total SGST:</td>
                                <td style="text-align: right;">₹${lastSaleData.items.reduce((sum, item) => sum + (item.sgst || 0), 0).toFixed(2)}</td>
                            </tr>
                            `}
                            ` : ''}
        <tr style="font-weight: bold; border-top: 2px solid #333;">
            <td colspan="4" style="text-align: right;">Grand Total:</td>
            <td style="text-align: right;">₹${lastSaleData.total.toFixed(2)}</td>
        </tr>
                            ${settings.showPayment && lastSaleData.paymentMethod === 'cash' ? `
                                <tr>
                                    <td colspan="4" style="text-align: right;">Cash Received:</td>
                                    <td style="text-align: right;">₹${lastSaleData.cashAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right;">Change:</td>
                                    <td style="text-align: right;">₹${lastSaleData.change.toFixed(2)}</td>
                                </tr>
                            ` : ''
                }
                            ${settings.showPayment && lastSaleData.paymentMethod === 'mixed' ? `
                                <tr>
                                    <td colspan="4" style="text-align: right;">Cash:</td>
                                    <td style="text-align: right;">₹${lastSaleData.cashAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right;">UPI/Balance:</td>
                                    <td style="text-align: right;">₹${lastSaleData.otherPaymentAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right;">Total Received:</td>
                                    <td style="text-align: right;">₹${lastSaleData.customerAmount.toFixed(2)}</td>
                                </tr>
                                ${lastSaleData.change !== 0 ? `
                                <tr>
                                    <td colspan="4" style="text-align: right;">Change:</td>
                                    <td style="text-align: right;">₹${lastSaleData.change.toFixed(2)}</td>
                                </tr>
                                ` : ''}
                            ` : ''
                }
        ${settings.showPayment ? `
        <tr>
            <td colspan="4" style="text-align: right;">Payment Method:</td>
            <td style="text-align: right;">${lastSaleData.paymentMethod.toUpperCase()}</td>
        </tr>
        ` : ''}
                        </tfoot >
                    </table >
                    ${footerStr}
            </div>
        `;

            try {
                JsBarcode("#receiptBarcode", lastSaleData.receiptNumber, {
                    format: "CODE128",
                    width: 1.5,
                    height: 40,
                    displayValue: false
                });
            } catch(e) {}

            document.getElementById('saleReceipt').style.display = 'flex';
            // Modal doesn't need scrollIntoView
            
            if (settings.autoPrint) {
                setTimeout(printReceipt, 500);
            }
        }

        function printReceipt() {
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            let bodyStyle = 'margin: 0; padding: 5px;';
            if (settings.receiptSize === '58mm') {
                bodyStyle += ' width: 58mm; max-width: 58mm; margin: 0 auto;';
            } else if (settings.receiptSize === '80mm') {
                bodyStyle += ' width: 80mm; max-width: 80mm; margin: 0 auto;';
            }

            const printContent = document.getElementById('receiptContent').innerHTML;
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write(`
            < html >
                    <head>
                        <title>Receipt</title>
                        <style>
                            @media print {
                                @page { margin: 0; }
                                body { ${bodyStyle} }
                                /* Override container styles for full width */
                                div { 
                                    max-width: 100% !important; 
                                    width: 100% !important;
                                    border: none !important; 
                                    padding: 0 !important; 
                                    margin: 0 !important; 
                                }
                            }
                            body { font-family: Arial, sans-serif; padding: 20px; ${settings.receiptSize !== 'A4' ? 'width: ' + settings.receiptSize + '; margin: 0 auto;' : ''} }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { padding: 4px; text-align: left; border-bottom: 1px solid #ddd; font-size: 12px; }
                            th { background-color: #f2f2f2; }
                            /* Center align header text */
                            h3, p { text-align: center; margin: 5px 0; }
                            /* Left align table content */
                            td, th { text-align: left; }
                            /* Right align numbers */
                            td:nth-child(3), td:nth-child(4), td:nth-child(5),
                            th:nth-child(3), th:nth-child(4), th:nth-child(5) {
                                text-align: right;
                            }
                        </style>
                    </head>
                    <body>${printContent}</body>

                </html >
            `);
            printWindow.document.close();
            // Wait for content to load before printing (important for images/styles)
            printWindow.onload = function () {
                printWindow.print();
                printWindow.close();
            };
        }

        function saveReceiptPDF() {
            const receiptContent = document.getElementById('receiptContent').innerHTML;
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write(`
            < html >
                    <head>
                        <title>Receipt</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                            th { background-color: #f2f2f2; }
                        </style>
                    </head>
                    <body>${receiptContent}</body>

                </html >
            `);
            printWindow.document.close();
            printWindow.print();
            // Note: Browser print dialog can save as PDF
        }

        function sendReceiptToWhatsApp() {
            if (!lastSaleData) {
                showAlert('No receipt data available!', '⚠️');
                return;
            }

            const date = new Date(lastSaleData.date);
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();

            // Format Receipt as text message
            let message = `🧾 * ${settings.businessName || 'Sales Receipt'} *\n\n`;
            message += `* Receipt #:* ${lastSaleData.receiptNumber} \n`;
            message += `* Date:* ${date.toLocaleDateString()} \n`;
            message += `* Time:* ${date.toLocaleTimeString()} \n`;
            message += `* Customer:* ${lastSaleData.customerName || 'Walk-in'} \n\n`;
            message += `* Items:*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n`;

            lastSaleData.items.forEach((item, index) => {
                message += `${index + 1}. ${item.productName} \n`;
                message += `   ${item.quantity} ${item.unit || ''} × ₹${item.price.toFixed(2)} = ₹${item.total.toFixed(2)} \n`;
            });

            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `Subtotal: ₹${(lastSaleData.subtotal || 0).toFixed(2)} \n`;

            if (lastSaleData.discount > 0) {
                message += `Discount: - ₹${lastSaleData.discount.toFixed(2)} \n`;
            }

            message += `* Total: ₹${lastSaleData.total.toFixed(2)}*\n`;
            message += `Payment Method: ${lastSaleData.paymentMethod.toUpperCase()} \n`;

            if (lastSaleData.paymentMethod === 'cash' && lastSaleData.cashAmount) {
                message += `Cash Received: ₹${lastSaleData.cashAmount.toFixed(2)} \n`;
                if (lastSaleData.change !== undefined && lastSaleData.change > 0) {
                    message += `Change: ₹${lastSaleData.change.toFixed(2)} \n`;
                }
            }

            if (lastSaleData.paymentMethod === 'mixed') {
                if (lastSaleData.cashAmount) {
                    message += `Cash: ₹${lastSaleData.cashAmount.toFixed(2)} \n`;
                }
                if (lastSaleData.otherPaymentAmount) {
                    message += `UPI / Balance: ₹${lastSaleData.otherPaymentAmount.toFixed(2)} \n`;
                }
                if (lastSaleData.change !== undefined && lastSaleData.change !== 0) {
                    message += `Change: ₹${lastSaleData.change.toFixed(2)} \n`;
                }
            }

            message += `\n${settings.footerMsg || 'Thank you for your purchase! 🙏'}`;

            // Encode message for URL
            const encodedMessage = encodeURIComponent(message);

            // Open WhatsApp Web/App with pre-filled message
            const whatsappUrl = `https://web.whatsapp.com/send?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
        }

        
        function closeGSTInvoice() {
            document.getElementById('gstInvoiceModal').style.display = 'none';
        }

        function numberToWords(num) {
            if (num === 0) return 'Zero';
            const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
            const format = (n) => {
                if (n < 20) return a[n];
                if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
                if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + format(n % 100) : '');
                if (n < 100000) return format(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + format(n % 1000) : '');
                if (n < 10000000) return format(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + format(n % 100000) : '');
                return format(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + format(n % 10000000) : '');
            };
            const wholeNum = Math.floor(num);
            const decimalNum = Math.round((num - wholeNum) * 100);
            let result = 'Rupees ' + format(wholeNum);
            if (decimalNum > 0) {
                result += ' and ' + format(decimalNum) + ' Paise';
            }
            return result + ' Only';
        }

        function generateTAXInvoiceHTML(saleData) {
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            // Determine if GST was applied for THIS sale
            const invoiceGstApplied = saleData.gstApplied !== undefined ? saleData.gstApplied : settings.gstEnabled;
            const bName = settings.businessName || 'Business Name';
            const bAddress = settings.address ? settings.address.replace(/\n/g, '<br>') : 'Business Address';
            const bMobile = settings.mobile || '';
            const bEmail = settings.email || '';
            const bGstin = settings.gstin || '';
            
            // Build Seller Header
            let contactInfo = [];
            if (bMobile) contactInfo.push(`Ph: ${bMobile}`);
            if (bEmail) contactInfo.push(`Email: ${bEmail}`);
            let contactHtml = contactInfo.length > 0 ? `<div style="font-size: 12px; margin-top: 5px;">${contactInfo.join(' | ')}</div>` : '';

            // Customer Details
            const cName = saleData.customerName || 'Cash Customer';
            const cGstin = saleData.customerGSTIN && saleData.customerGSTIN !== '-' ? saleData.customerGSTIN.toUpperCase() : 'Not Provided';
            const cAddress = saleData.customerAddress && saleData.customerAddress !== '-' ? saleData.customerAddress.replace(/\n/g, '<br>') : '-';
            const cState = saleData.customerState && saleData.customerState !== '-' ? saleData.customerState : '-';
            const taxTypeStr = saleData.taxType === 'intra' ? 'Intra-State (CGST + SGST)' : (saleData.taxType === 'inter' ? 'Inter-State (IGST)' : '-');

            let paymentStr = saleData.paymentMethod ? saleData.paymentMethod.toUpperCase() : '-';
            if (saleData.paymentMethod === 'mixed') paymentStr = `CASH + UPI`;

            const dateStr = new Date(saleData.date).toLocaleDateString();
            const enteredAtHtml = saleData.createdAt ? `<div><strong>Entered At:</strong> ${new Date(saleData.createdAt).toLocaleString()}</div>` : '';

            // Build Item Rows & Aggregates from saved data
            let rowsHtml = '';
            let grandGross = 0, grandDisc = 0, grandTaxable = 0, grandCGST = 0, grandSGST = 0, grandIGST = 0, grandTotal = 0;
            
            if (saleData.items) {
                saleData.items.forEach((item, index) => {
                    const qty = item.quantity || 0;
                    const rate = item.price || 0;
                    const amount = item.grossAmount || (rate * qty);
                    let discPerc = '0';
                    if ((item.discountType || 'percentage') === 'percentage') {
                        discPerc = (item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0)) + '%';
                    } else {
                        discPerc = '₹' + (item.discountValue || 0);
                    }
                    const discVal = item.itemDiscount || 0;
                    const taxable = item.taxableValue || 0;
                    const cgst = item.cgst || 0;
                    const sgst = item.sgst || 0;
                    const igst = item.igst || 0;
                    const total = item.total || 0;

                    grandGross += amount;
                    grandDisc += discVal;
                    grandTaxable += taxable;
                    grandCGST += cgst;
                    grandSGST += sgst;
                    grandIGST += igst;
                    grandTotal += total;

                    rowsHtml += `
                        <tr>
                            <td style="padding: 4px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${index + 1}</td>
                            <td style="padding: 4px; border: 1px solid #ddd; font-size: 11px;">${item.productName}</td>
                            ${invoiceGstApplied ? `<td style="padding: 4px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${item.hsn || '-'}</td>` : ''}
                            ${invoiceGstApplied ? `<td style="padding: 4px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${item.gstRate || 0}%</td>` : ''}
                            <td style="padding: 4px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${qty}</td>
                            <td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px;">₹${rate.toFixed(2)}</td>
                            <td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px;">${discPerc}</td>
                            <td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px;">₹${amount.toFixed(2)}</td>
                            ${invoiceGstApplied ? `<td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px;">₹${taxable.toFixed(2)}</td>` : ''}
                            ${invoiceGstApplied ? `<td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px;">₹${cgst.toFixed(2)}</td>` : ''}
                            ${invoiceGstApplied ? `<td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px;">₹${sgst.toFixed(2)}</td>` : ''}
                            ${invoiceGstApplied ? `<td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px;">₹${igst.toFixed(2)}</td>` : ''}
                            <td style="padding: 4px; border: 1px solid #ddd; text-align: right; font-size: 11px; font-weight: bold;">₹${total.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            return `
                <div style="border: 1px solid #333; padding: 2px;">
                    <div style="border: 1px solid #333; padding: 10px;">
                        <!-- Header -->
                        <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 5px; position: relative;">
                            <div style="position: absolute; top: 0; right: 0; font-size: 9px; font-weight: bold; border: 1px solid #333; padding: 1px 3px;">ORIGINAL FOR RECIPIENT</div>
                            <h2 style="margin: 0; font-size: 18px; font-weight: bold;">${invoiceGstApplied ? 'TAX INVOICE' : 'INVOICE'}</h2>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                            <!-- Seller -->
                            <div style="flex: 1;">
                                ${settings.logoData ? `<img src="${settings.logoData}" style="max-height: 40px; margin-bottom: 4px;">` : ''}
                                <h3 style="margin: 0 0 4px 0; font-size: 14px;">${bName}</h3>
                                <div style="font-size: 11px; line-height: 1.3;">
                                    ${bAddress}<br>
                                    ${contactHtml}
                                    ${invoiceGstApplied && bGstin ? `<strong>GSTIN:</strong> ${bGstin.toUpperCase()}` : ''}
                                </div>
                            </div>
                            
                            <!-- Invoice Details -->
                            <div style="flex: 1; text-align: right; font-size: 11px; line-height: 1.4;">
                                <div><strong>Invoice No:</strong> ${saleData.receiptNumber}</div>
                                <div><strong>Invoice Date:</strong> ${dateStr}</div>
                                ${enteredAtHtml}
                                <div><strong>Payment Method:</strong> ${paymentStr}</div>
                                ${invoiceGstApplied ? `<div><strong>Tax Type:</strong> ${taxTypeStr}</div>` : ''}
                            </div>
                        </div>

                        <!-- Buyer -->
                        <div style="border: 1px solid #333; padding: 5px 10px; margin-bottom: 10px; font-size: 11px; line-height: 1.3;">
                            <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid #ccc; display: inline-block;">Bill To:</div>
                            <div style="display: flex;">
                                <div style="flex: 1;">
                                    <div><strong>Name:</strong> ${cName}</div>
                                    <div><strong>GSTIN:</strong> ${cGstin}</div>
                                </div>
                                <div style="flex: 1;">
                                    ${invoiceGstApplied ? `<div><strong>Address:</strong> ${cAddress}</div>` : ''}
                                    ${invoiceGstApplied ? `<div><strong>State:</strong> ${cState}</div>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Item Table -->
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">S.No</th>
                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Product Name</th>
                                    ${invoiceGstApplied ? `<th style="padding: 4px; border: 1px solid #333; font-size: 10px;">HSN</th>` : ''}
                                    ${invoiceGstApplied ? `<th style="padding: 4px; border: 1px solid #333; font-size: 10px;">GST%</th>` : ''}
                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Qty</th>
                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Rate</th>
                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Discount</th>
                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Amount</th>
                                    ${invoiceGstApplied ? `<th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Subtotal</th>` : ''}
                                    ${invoiceGstApplied ? `<th style="padding: 4px; border: 1px solid #333; font-size: 10px;">CGST</th>` : ''}
                                    ${invoiceGstApplied ? `<th style="padding: 4px; border: 1px solid #333; font-size: 10px;">SGST</th>` : ''}
                                    ${invoiceGstApplied ? `<th style="padding: 4px; border: 1px solid #333; font-size: 10px;">IGST</th>` : ''}
                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>

                        <!-- Footer Summaries -->
                        <div style="display: flex; gap: 15px; font-size: 11px; align-items: stretch;">
                            ${invoiceGstApplied ? `
                            <!-- Tax Summary Box -->
                            <div style="flex: 1; border: 1px solid #333; padding: 6px;">
                                <div style="font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid #333; padding-bottom: 2px;">TAX SUMMARY</div>
                                <table style="width: 100%; font-size: 10px; line-height: 1.2;">
                                    <tr><td>Gross Amount:</td><td style="text-align: right;">₹${grandGross.toFixed(2)}</td></tr>
                                    <tr><td>Total Item Discount:</td><td style="text-align: right;">₹${grandDisc.toFixed(2)}</td></tr>
                                    <tr><td>Taxable Value:</td><td style="text-align: right;">₹${grandTaxable.toFixed(2)}</td></tr>
                                    <tr><td>CGST:</td><td style="text-align: right;">₹${grandCGST.toFixed(2)}</td></tr>
                                    <tr><td>SGST:</td><td style="text-align: right;">₹${grandSGST.toFixed(2)}</td></tr>
                                    <tr><td>IGST:</td><td style="text-align: right;">₹${grandIGST.toFixed(2)}</td></tr>
                                    <tr><td colspan="2"><hr style="border: 0; border-top: 1px solid #ccc; margin: 3px 0;"></td></tr>
                                    <tr><td><strong>Subtotal / Taxable Total:</strong></td><td style="text-align: right;"><strong>₹${grandTaxable.toFixed(2)}</strong></td></tr>
                                    <tr><td><strong>Invoice Total:</strong></td><td style="text-align: right;"><strong>₹${grandTotal.toFixed(2)}</strong></td></tr>
                                </table>
                            </div>
                            ` : ''}

                            <!-- Invoice Total & Signatory -->
                            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div style="border: 1px solid #333; padding: 6px;">
                                    <table style="width: 100%; font-size: 11px; line-height: 1.3;">
                                        ${invoiceGstApplied ? `
                                        <tr><td>Total Taxable Value:</td><td style="text-align: right;">₹${grandTaxable.toFixed(2)}</td></tr>
                                        <tr><td>Total CGST:</td><td style="text-align: right;">₹${grandCGST.toFixed(2)}</td></tr>
                                        <tr><td>Total SGST:</td><td style="text-align: right;">₹${grandSGST.toFixed(2)}</td></tr>
                                        <tr><td>Total IGST:</td><td style="text-align: right;">₹${grandIGST.toFixed(2)}</td></tr>
                                        <tr><td colspan="2"><hr style="border: 0; border-top: 1px solid #333; margin: 3px 0;"></td></tr>
                                        ` : ''}
                                        <tr style="font-size: 13px; font-weight: bold;">
                                            <td>Grand Total:</td><td style="text-align: right;">₹${grandTotal.toFixed(2)}</td>
                                        </tr>
                                    </table>
                                </div>
                                <div style="margin-top: 5px; font-weight: bold; font-style: italic; font-size: 10px;">
                                    Amount in Words:<br>
                                    <span style="font-weight: normal;">${numberToWords(grandTotal)}</span>
                                </div>
                                <div style="margin-top: 15px; text-align: center;">
                                    <svg class="invoiceBarcode" data-value="${saleData.receiptNumber}"></svg>
                                </div>
                                <div style="margin-top: 20px; text-align: right; border-top: 1px solid #ccc; padding-top: 3px; font-size: 10px;">
                                    <strong>For ${bName}</strong><br><br>
                                    Authorised Signatory
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function openGSTInvoice() {
            if (!lastSaleData || !lastSaleData.items || lastSaleData.items.length === 0) {
                showAlert('No sale data found to generate invoice.', '⚠️');
                return;
            }

            const invoiceHtml = generateTAXInvoiceHTML(lastSaleData);
            document.getElementById('gstInvoicePrintArea').innerHTML = invoiceHtml;
            try { JsBarcode(".invoiceBarcode").init(); } catch(e) {}
            document.getElementById('gstInvoiceModal').style.display = 'block';
        }

        function printGSTInvoice() {
            const printContent = document.getElementById('gstInvoicePrintArea').innerHTML;
            const printWindow = window.open('', '', 'height=800,width=1000');
            printWindow.document.write(`
            <html>
                <head>
                    <title>Print Invoice</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white; color: black; }
                        @media print {
                            @page { size: A4; margin: 10mm; }
                            body { margin: 0; padding: 0; }
                        }
                    </style>
                </head>
                <body>${printContent}</body>

            </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }

        function downloadGSTInvoicePDF() {
            const originalElement = document.getElementById('gstInvoicePrintArea');
            const receiptNo = lastSaleData ? lastSaleData.receiptNumber : 'invoice';
            
            // Clone the element to avoid scrolling/UI issues affecting the capture
            const element = originalElement.cloneNode(true);
            
            // Ensure absolute sizing for A4 (794px width is standard A4 at 96 DPI)
            element.style.padding = '20px';
            element.style.margin = '0';
            element.style.width = '794px';
            element.style.maxWidth = 'none';
            element.style.position = 'absolute';
            element.style.top = '0';
            element.style.left = '-9999px'; // Hide it off-screen
            element.style.background = 'white'; // Ensure background is white, not transparent
            
            document.body.appendChild(element);

            const opt = {
                margin:       10,
                filename:     `Invoice_${receiptNo}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, scrollY: 0, scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(element).save().then(() => {
                document.body.removeChild(element);
            }).catch(err => {
                console.error("PDF generation error:", err);
                if (document.body.contains(element)) {
                    document.body.removeChild(element);
                }
            });
        }

        function sendInvoiceToWhatsApp() {
            if (!lastSaleData) return;
            
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const bName = settings.businessName || 'Business Name';
            const cName = lastSaleData.customerName || 'Customer';
            const cGstin = lastSaleData.customerGSTIN && lastSaleData.customerGSTIN !== '-' ? lastSaleData.customerGSTIN.toUpperCase() : 'Not Provided';
            
            let grandGross = 0, grandTaxable = 0, grandTotalTax = 0, grandTotal = 0;
            let itemsList = '';
            
            lastSaleData.items.forEach(item => {
                const qty = item.quantity || 0;
                const rate = item.price || 0;
                grandGross += item.grossAmount || (rate * qty);
                grandTaxable += item.taxableValue || 0;
                grandTotalTax += (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
                grandTotal += item.total || 0;
                
                itemsList += `▪ ${item.productName} (Qty: ${qty}) - ₹${item.total.toFixed(2)}\n`;
            });
            
            let message = `📄 *GST TAX INVOICE*\n`;
            message += `${bName}\n`;
            message += `------------------------------\n`;
            message += `*Invoice No:* ${lastSaleData.receiptNumber}\n`;
            message += `*Date:* ${new Date(lastSaleData.date).toLocaleDateString()}\n`;
            message += `------------------------------\n`;
            message += `*Bill To:* ${cName}\n`;
            if (cGstin !== 'Not Provided') message += `*GSTIN:* ${cGstin}\n`;
            message += `------------------------------\n`;
            message += `*Items:*\n${itemsList}`;
            message += `------------------------------\n`;
            message += `*Taxable Value:* ₹${grandTaxable.toFixed(2)}\n`;
            message += `*GST Total:* ₹${grandTotalTax.toFixed(2)}\n`;
            message += `*Grand Total:* ₹${grandTotal.toFixed(2)}\n`;
            message += `------------------------------\n`;
            message += `Thank you for your business! 🙏`;
            
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }

        function closeReceipt() {
            document.getElementById('saleReceipt').style.display = 'none';
            lastSaleData = null;
            
            // Refocus product search when closing receipt (delayed to prevent event carryover)
            setTimeout(() => {
                const searchInput = document.getElementById('saleProductSearch');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
        }

        // Allow Enter key to close receipt
        document.addEventListener('keydown', function(e) { if (e.defaultPrevented) return;
            const saleReceipt = document.getElementById('saleReceipt');
            if (saleReceipt && saleReceipt.style.display === 'block' && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                closeReceipt();
            }
        }, true); // Use capture phase to intercept before focused elements

        function updateTodaysSales() {
            const dateInput = document.getElementById('recordSalesDate');
            let selectedDate = new Date();
            let selectedDateString = "";

            if (dateInput && dateInput.value) {
                selectedDateString = dateInput.value;
                const [year, month, day] = selectedDateString.split('-');
                selectedDate = new Date(year, month - 1, day);
            } else {
                // Default to today
                selectedDate = new Date();
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                selectedDateString = `${year}-${month}-${day}`;
                if (dateInput) {
                    dateInput.value = selectedDateString;
                }
            }

            selectedDate.setHours(0, 0, 0, 0);

            // Update Title
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dateLabel = selectedDate.toLocaleDateString('en-US', options);
            const titleEl = document.getElementById('recordSalesTitle');
            if (titleEl) titleEl.textContent = `Sales for ${dateLabel}`;

            // Use LOCAL TIME strings (YYYY-MM-DD) to respect 12 AM - 12 AM in user's timezone
            const getLocalDateString = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // selectedDateString is already defined above
            // just to be safe, we can reassign it if we want, but it's a const!
            // Wait, we defined it as `let selectedDateString` earlier.
            // Let's just remove the const declaration here and assign it.
            selectedDateString = getLocalDateString(selectedDate);

            const todaySales = sales.filter(sale => {
                if (!sale.date) return false;
                const saleDate = new Date(sale.date);
                return getLocalDateString(saleDate) === selectedDateString;
            });

            const tbody = document.getElementById('todaySalesBody');

            if (todaySales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6c757d;">No sales today</td></tr>';
                return;
            }

            // Group sales by saleId to get complete transaction info
            const salesByTransaction = {};
            todaySales.forEach(sale => {
                if (!salesByTransaction[sale.saleId]) {
                    salesByTransaction[sale.saleId] = {
                        saleId: sale.saleId,
                        date: sale.date,
                        createdAt: sale.createdAt,
                        receiptNumber: sale.receiptNumber || '-',
                        customerName: sale.customerName,
                        paymentMethod: sale.paymentMethod,
                        subtotal: 0,
                        discount: 0,
                        courier: 0,
                        total: 0,
                        items: [],
                        cashAmount: sale.cashAmount,
                        otherPaymentAmount: sale.otherPaymentAmount,
                        hasBillLevelData: false
                    };
                }

                salesByTransaction[sale.saleId].items.push(sale);

                // REFACTOR: We ALWAYS sum up item totals to ensure accuracy.
                salesByTransaction[sale.saleId].subtotal += sale.total; // item grossAmount

                if (sale.discount) {
                    salesByTransaction[sale.saleId].discount = sale.discount;
                }
                if (sale.courier) {
                    salesByTransaction[sale.saleId].courier = sale.courier;
                }
            });

            // Calculate final totals
            Object.values(salesByTransaction).forEach(transaction => {
                transaction.total = transaction.subtotal - transaction.discount + (transaction.courier || 0);
            });

            // Convert to array and sort by date (most recent first)
            const transactions = Object.values(salesByTransaction).sort((a, b) => new Date(b.date) - new Date(a.date));

            // Generate rows - one row per BILL
            const rows = transactions.map(transaction => {
                let paymentDisplay = transaction.paymentMethod ? transaction.paymentMethod.toUpperCase() : '-';
                if (transaction.paymentMethod === 'mixed') {
                    if (transaction.cashAmount !== undefined && transaction.otherPaymentAmount !== undefined) {
                        paymentDisplay = `Cash: ₹${transaction.cashAmount.toFixed(2)} + UPI: ₹${transaction.otherPaymentAmount.toFixed(2)}`;
                    } else {
                        paymentDisplay = 'Mixed';
                    }
                }

                return `
                    <tr>
                        <td>${new Date(transaction.date).toLocaleDateString('en-GB')}</td>
                        <td>${transaction.createdAt ? new Date(transaction.createdAt).toLocaleString('en-GB') : 'N/A'}</td>
                        <td>${transaction.receiptNumber}</td>
                        <td>₹${transaction.subtotal.toFixed(2)}</td>
                        <td>₹${transaction.discount.toFixed(2)}</td>
                        <td>₹${(transaction.courier || 0).toFixed(2)}</td>
                        <td><strong>₹${transaction.total.toFixed(2)}</strong></td>
                        <td>${transaction.customerName || '-'}</td>
                        <td>${paymentDisplay}</td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="viewBill('${transaction.saleId}')" title="View Receipt">
                                👁️ View
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteSale('${transaction.saleId}')" title="Delete this entire bill">
                                🗑️ Delete
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = rows.join('');
        }

        function viewBill(saleId) {
            const id = parseInt(saleId);
            const billItems = sales.filter(s => s.saleId === id);
            if (billItems.length === 0) return;

            const firstItem = billItems[0];

            // Reconstruct lastSaleData
            lastSaleData = {
                saleId: firstItem.saleId,
                receiptNumber: firstItem.receiptNumber,
                date: firstItem.date,
                customerName: firstItem.customerName,
                paymentMethod: firstItem.paymentMethod,
                subtotal: 0,
                discount: 0,
                total: 0,
                items: [],
                cashAmount: firstItem.cashAmount,
                otherPaymentAmount: firstItem.otherPaymentAmount,
                customerAmount: firstItem.customerAmount,
                change: firstItem.change,
                courier: 0
            };

            // Handle Subtotal/Discount logic (same as in updateTodaysSales)
            let hasBillLevelData = false;
            if (firstItem.subtotal !== undefined && firstItem.subtotal !== null) {
                hasBillLevelData = true;
                lastSaleData.subtotal = firstItem.subtotal;
                lastSaleData.discount = firstItem.discount || 0;
                lastSaleData.courier = firstItem.courier || 0;
            }

            billItems.forEach(item => {
                lastSaleData.items.push({ ...item });

                if (!hasBillLevelData) {
                    lastSaleData.subtotal += item.total;
                }
            });

            lastSaleData.total = lastSaleData.subtotal - lastSaleData.discount + (lastSaleData.courier || 0);

            showReceipt();
            // Modal doesn't need scrollIntoView
        }

        function searchBill() {
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const billNumber = document.getElementById('billSearchInput').value.trim();
            const container = document.getElementById('billDetailsContainer');

            if (!billNumber) {
                showAlert('Please enter a bill number', '⚠️');
                return;
            }

            // Find all sales with this bill number
            const billItems = sales.filter(sale => sale.receiptNumber === billNumber);

            if (billItems.length === 0) {
                container.style.display = 'block';
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <h4 style="color: #dc3545;">❌ Bill Not Found</h4>
                        <p>No bill found with number: <strong>${billNumber}</strong></p>
                        <p style="color: #6c757d; font-size: 0.9em;">Please check the bill number and try again.</p>
                    </div>
                `;
                return;
            }

            // Get bill information (all items have same bill info)
            const firstItem = billItems[0];
            
            const saleData = {
                receiptNumber: billNumber,
                date: firstItem.date,
                customerName: firstItem.customerName,
                customerGSTIN: firstItem.customerGSTIN,
                customerAddress: firstItem.customerAddress,
                customerState: firstItem.customerState,
                taxType: firstItem.taxType,
                paymentMethod: firstItem.paymentMethod,
                items: billItems
            };

            const invoiceHtml = generateTAXInvoiceHTML(saleData);

            // Display bill details
            container.style.display = 'block';
            container.innerHTML = `
                ${invoiceHtml}

                <div style="margin-top: 20px; text-align: right; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-primary" onclick="printBillDetails('${billNumber}')">🖨️ Print Bill</button>
                    <button class="btn btn-primary" onclick="printReceiptFromBill('${billNumber}')">🧾 Print Receipt</button>
                    <button class="btn btn-warning" onclick="editBillSales('${billNumber}')" style="background-color: #ffc107; color: #000;">✏️ Edit Sales</button>
                    <button class="btn btn-danger" onclick="deleteBillFromView('${billNumber}')">🗑️ Delete Bill</button>
                    <button class="btn" style="background-color: #6c757d; color: white;" onclick="closeBillDetails()">✖️ Close</button>
                </div>
            `;
            try { JsBarcode(".invoiceBarcode").init(); } catch(e) {}
        }

        function printReceiptFromBill(billNumber) {
            const billItems = sales.filter(sale => sale.receiptNumber === billNumber);
            if (billItems.length === 0) return;
            const saleData = {
                receiptNumber: billNumber,
                date: billItems[0].date,
                customerName: billItems[0].customerName,
                customerGSTIN: billItems[0].customerGSTIN,
                customerAddress: billItems[0].customerAddress,
                customerState: billItems[0].customerState,
                subtotal: billItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                discount: billItems[0].discount || 0,
                total: billItems[0].total,
                cashAmount: billItems[0].cashAmount || 0,
                otherPaymentAmount: billItems[0].otherPaymentAmount || 0,
                customerAmount: billItems[0].customerAmount || 0,
                change: billItems[0].change || 0,
                paymentMethod: billItems[0].paymentMethod || 'cash',
                gstApplied: billItems[0].gstApplied,
                counterCode: billItems[0].counterCode || '-',
                items: billItems
            };
            const tempLastSale = lastSaleData;
            lastSaleData = saleData;
            showReceipt();
            setTimeout(() => {
                printReceipt();
                lastSaleData = tempLastSale;
            }, 300);
        }

        function printBillDetails(billNumber) {
            const billItems = sales.filter(sale => sale.receiptNumber === billNumber);
            if (billItems.length === 0) return;
            const firstItem = billItems[0];
            
            const saleData = {
                receiptNumber: billNumber,
                date: firstItem.date,
                customerName: firstItem.customerName,
                customerGSTIN: firstItem.customerGSTIN,
                customerAddress: firstItem.customerAddress,
                customerState: firstItem.customerState,
                taxType: firstItem.taxType,
                paymentMethod: firstItem.paymentMethod,
                items: billItems
            };

            const printContent = generateTAXInvoiceHTML(saleData);
            const printWindow = window.open('', '', 'height=800,width=1000');
            printWindow.document.write(`
            <html>
                <head>
                    <title>Print Invoice - ${billNumber}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white; color: black; }
                        @media print {
                            @page { size: A4; margin: 10mm; }
                            body { margin: 0; padding: 0; }
                        }
                    </style>
                    <\/script>
                </head>
                <body>
                    ${printContent}
                    
                        window.onload = function() {
                            try { JsBarcode(".invoiceBarcode").init(); } catch(e) {}
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                    <\/script></body>

            </html>
            `);
            printWindow.document.close();
            printWindow.focus();
        }

        function closeBillDetails() {
            const container = document.getElementById('billDetailsContainer');
            container.style.display = 'none';
            container.innerHTML = '';
            document.getElementById('billSearchInput').value = '';
        }

        function editBillSales(billNumber) {
            // Button is only visible to admins
            if (!window.isUserAdmin) {
                showAlert('Access denied. Admin privileges required.', '🔒');
                return;
            }

            // Find all sales with this bill number
            const billItems = sales.filter(sale => sale.receiptNumber === billNumber);

            if (billItems.length === 0) {
                showAlert('Bill not found!', '❌');
                return;
            }

            // Show edit interface
            showEditSalesInterface(billNumber, billItems);
        }

        function showEditSalesInterface(billNumber, billItems) {
            const container = document.getElementById('billDetailsContainer');
            const firstItem = billItems[0];

            // Build editable items table
            let itemsHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background: #007bff; color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Product</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">Quantity</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">Unit Price</th>
                            <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">Total</th>
                        </tr>
                    </thead>
                    <tbody id="editItemsBody">
            `;

            billItems.forEach((item, index) => {
                itemsHTML += `
                    <tr style="border-bottom: 1px solid #dee2e6;">
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${item.productName}</td>
                        <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">
                            <input type="number" min="0" step="any" value="${item.quantity}" 
                                id="editQty_${index}" 
                                onchange="updateEditTotal(${index})"
                                style="width: 60px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        </td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">
                            <input type="number" step="0.01" min="0" value="${item.price.toFixed(2)}" 
                                id="editPrice_${index}"
                                onchange="updateEditTotal(${index})"
                                style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        </td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">
                            <span id="editTotal_${index}">₹${item.total.toFixed(2)}</span>
                        </td>
                    </tr>
                `;
            });

            itemsHTML += `
                    </tbody>
                </table>
            `;

            // Display edit interface
            container.style.display = 'block';
            container.innerHTML = `
                <h4 style="color: #007bff; margin-bottom: 20px;">✏️ Edit Bill #${billNumber}</h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <label style="font-weight: bold;">Customer Name:</label><br>
                        <input type="text" id="editCustomerName" value="${firstItem.customerName || 'Walk-in Customer'}"
                            style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="font-weight: bold;">Payment Method:</label><br>
                        <select id="editPaymentMethod" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="cash" ${firstItem.paymentMethod === 'cash' ? 'selected' : ''}>Cash</option>
                            <option value="card" ${firstItem.paymentMethod === 'card' ? 'selected' : ''}>Card</option>
                            <option value="upi" ${firstItem.paymentMethod === 'upi' ? 'selected' : ''}>UPI</option>
                            <option value="credit" ${firstItem.paymentMethod === 'credit' ? 'selected' : ''}>Credit</option>
                        </select>
                    </div>
                </div>

                <h4 style="margin: 20px 0 10px 0; color: #007bff;">Items</h4>
                ${itemsHTML}

                <div style="margin-top: 20px; text-align: right; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-success" onclick="saveEditedBill('${billNumber}')">💾 Save Changes</button>
                    <button class="btn" style="background-color: #6c757d; color: white;" onclick="searchBill()">❌ Cancel</button>
                </div>
            `;

            // Store original bill items for reference
            window.editingBillItems = billItems;
            window.editingBillNumber = billNumber;
        }

        function updateEditTotal(index) {
            const qty = parseFloat(document.getElementById(`editQty_${index}`).value) || 0;
            const price = parseFloat(document.getElementById(`editPrice_${index}`).value) || 0;
            const total = qty * price;
            document.getElementById(`editTotal_${index}`).textContent = `₹${total.toFixed(2)}`;
        }

        function saveEditedBill(billNumber) {
            if (!requireLicensedForWrite('editing a bill')) return;
            try {
                const billItems = window.editingBillItems;

                if (!billItems || billItems.length === 0) {
                    showAlert('Error: Bill data not found!', '❌');
                    return;
                }

                // Collect edited data
                const newCustomerName = document.getElementById('editCustomerName').value || 'Walk-in Customer';
                const newPaymentMethod = document.getElementById('editPaymentMethod').value;

                // 1. Transaction Start: Restore original stock using robust matching
                const restoredItems = [];

                for (const item of billItems) {
                    // Try to find product by ID, fallback to barcode or name matching if needed
                    // But here we need to find the PRODUCT definition, not the sale
                    const product = products.find(p => p.id == item.productId);
                    if (product) {
                        product.stock += item.quantity;
                        restoredItems.push({ product: product, qty: item.quantity });
                    }
                }

                // 2. Validation Phase
                for (let i = 0; i < billItems.length; i++) {
                    const item = billItems[i];
                    const qtyInput = document.getElementById(`editQty_${i}`);
                    if (!qtyInput) continue;

                    const newQty = parseInt(qtyInput.value) || 1;
                    const product = products.find(p => p.id == item.productId);

                    if (product) {
                        if (product.stock < newQty) {
                            showAlert(`Insufficient stock for ${item.productName}! Available: ${product.stock} units`, '⚠️');

                            // Rollback
                            restoredItems.forEach(r => {
                                r.product.stock -= r.qty;
                            });
                            return;
                        }
                    }
                }

                // 3. Execution Phase
                let updatedCount = 0;

                // First pass: Calculate new Bill Subtotal
                let newBillSubtotal = 0;
                for (let i = 0; i < billItems.length; i++) {
                    const qtyInput = document.getElementById(`editQty_${i}`);
                    const priceInput = document.getElementById(`editPrice_${i}`);
                    if (qtyInput && priceInput) {
                        const q = parseInt(qtyInput.value) || 0;
                        const p = parseFloat(priceInput.value) || 0;
                        newBillSubtotal += (q * p);
                    }
                }

                // Second pass: Update items
                for (let i = 0; i < billItems.length; i++) {
                    const item = billItems[i];
                    const qtyInput = document.getElementById(`editQty_${i}`);
                    const priceInput = document.getElementById(`editPrice_${i}`);

                    if (!qtyInput || !priceInput) continue;

                    const newQty = parseInt(qtyInput.value) || 1;
                    const newPrice = parseFloat(priceInput.value) || 0;
                    const newTotal = newQty * newPrice;

                    // Update Sale Record - ROBUST MATCHING
                    // 1. Try matching by unique ID
                    let saleIndex = -1;
                    if (item.id) {
                        saleIndex = sales.findIndex(s => s.id == item.id);
                    }

                    // 2. Fallback: Match by saleId + productId
                    if (saleIndex === -1) {
                        saleIndex = sales.findIndex(s =>
                            s.saleId == item.saleId &&
                            s.productId == item.productId
                        );
                    }

                    if (saleIndex >= 0) {
                        sales[saleIndex].quantity = newQty;
                        sales[saleIndex].price = newPrice;
                        sales[saleIndex].total = newTotal; // Item Total
                        sales[saleIndex].customerName = newCustomerName;
                        sales[saleIndex].paymentMethod = newPaymentMethod;

                        // CRITICAL FIX: Update Bill-Level Subtotal
                        // The report view relies on this property being accurate
                        sales[saleIndex].subtotal = newBillSubtotal;

                        updatedCount++;
                    } else {
                        console.warn('Could not find sale record for item:', item);
                    }

                    // Deduct new stock
                    const product = products.find(p => p.id == item.productId);
                    if (product) {
                        product.stock -= newQty;
                    }
                }

                if (updatedCount === 0) {
                    throw new Error("No items were matched/updated. Please define unique IDs for sales.");
                }

                // Save changes
                saveData();

                // Firebase sync removed

                // Refresh and show success
                updateDashboard();
                updateTodaysSales(); // Refresh the "Sales for [Date]" report
                searchBill();

                showAlert(`✅ Successfully updated ${updatedCount} items! New Total: ₹${newBillSubtotal.toFixed(2)}`, '💾');

            } catch (error) {
                console.error("Save Error:", error);
                showAlert('Error saving bill: ' + error.message, '❌');
            }
        }

        function deleteBillFromView(billNumber) {
            if (!window.isUserAdmin) return showAlert('Unauthorized: Only Administrators can delete data.', 'error');

            showConfirm('⚠️ Delete Bill?<br><br>This will permanently delete this bill and restore stock.<br>This action cannot be undone!',
                function () {
                    // Find all sales with this bill number
                    const billItems = sales.filter(sale => sale.receiptNumber === billNumber);

                    if (billItems.length === 0) {
                        showAlert('Bill not found!', '❌');
                        return;
                    }

                    // Restore stock for each item
                    billItems.forEach(sale => {
                        const product = products.find(p => p.id === sale.productId);
                        if (product) {
                            product.stock += sale.quantity;
                        }
                    });

                    // Remove all sales with this bill number
                    const originalLength = sales.length;
                    sales = sales.filter(sale => sale.receiptNumber !== billNumber);
                    const deletedCount = originalLength - sales.length;

                    // Save changes
                    saveData();

                    // Firebase sync removed

                    // Close bill details and refresh
                    closeBillDetails();
                    updateDashboard();

                    showAlert(`✅ Bill deleted successfully!<br>${deletedCount} item(s) removed and stock restored.`, '🗑️');
                });
        }

        function generateReports() {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            document.getElementById('reportStartDate').value = formatDateLocal(startDate);
            document.getElementById('reportEndDate').value = formatDateLocal(endDate);

            // Initialize chart date filters to last 7 days
            const chartEndDate = new Date();
            const chartStartDate = new Date();
            chartStartDate.setDate(chartStartDate.getDate() - 6);

            const chartStartInput = document.getElementById('chartStartDate');
            const chartEndInput = document.getElementById('chartEndDate');
            const productChartStartInput = document.getElementById('productChartStartDate');
            const productChartEndInput = document.getElementById('productChartEndDate');

            if (chartStartInput) chartStartInput.value = formatDateLocal(chartStartDate);
            if (chartEndInput) chartEndInput.value = formatDateLocal(chartEndDate);
            if (productChartStartInput) productChartStartInput.value = formatDateLocal(chartStartDate);
            if (productChartEndInput) productChartEndInput.value = formatDateLocal(chartEndDate);

            generateCustomReport();
            generateDailySalesChart();
            generateProductWiseSales();
            generateProductWiseChart();
        }

        function setChartFilter(period) {
            const endDate = new Date();
            const startDate = new Date();
            const chartStartInput = document.getElementById('chartStartDate');
            const chartEndInput = document.getElementById('chartEndDate');

            switch (period) {
                case '7days':
                    startDate.setDate(endDate.getDate() - 6);
                    break;
                case 'weekly':
                    // Current week (last 7 days)
                    startDate.setDate(endDate.getDate() - 6);
                    break;
                case 'monthly':
                    // Last 30 days
                    startDate.setDate(endDate.getDate() - 29);
                    break;
                case '3months':
                    // Last 90 days
                    startDate.setDate(endDate.getDate() - 89);
                    break;
            }

            if (chartStartInput) chartStartInput.value = formatDateLocal(startDate);
            if (chartEndInput) chartEndInput.value = formatDateLocal(endDate);

            applyChartFilter();
        }

        function setProductChartFilter(period) {
            const endDate = new Date();
            const startDate = new Date();
            const chartStartInput = document.getElementById('productChartStartDate');
            const chartEndInput = document.getElementById('productChartEndDate');

            switch (period) {
                case '7days':
                    startDate.setDate(endDate.getDate() - 6);
                    break;
                case 'weekly':
                    startDate.setDate(endDate.getDate() - 6);
                    break;
                case 'monthly':
                    startDate.setDate(endDate.getDate() - 29);
                    break;
                case '3months':
                    startDate.setDate(endDate.getDate() - 89);
                    break;
            }

            if (chartStartInput) chartStartInput.value = formatDateLocal(startDate);
            if (chartEndInput) chartEndInput.value = formatDateLocal(endDate);

            applyProductChartFilter();
        }

        function applyChartFilter() {
            const chartStartInput = document.getElementById('chartStartDate');
            const chartEndInput = document.getElementById('chartEndDate');

            if (!chartStartInput || !chartEndInput || !chartStartInput.value || !chartEndInput.value) {
                showAlert('Please select both start and end dates', '⚠️');
                return;
            }

            const startDate = new Date(chartStartInput.value + 'T00:00:00');
            const endDate = new Date(chartEndInput.value + 'T23:59:59');

            if (startDate > endDate) {
                showAlert('Start date cannot be after end date', '⚠️');
                return;
            }

            generateDailySalesChart(startDate, endDate);
        }

        function applyProductChartFilter() {
            const chartStartInput = document.getElementById('productChartStartDate');
            const chartEndInput = document.getElementById('productChartEndDate');

            if (!chartStartInput || !chartEndInput || !chartStartInput.value || !chartEndInput.value) {
                showAlert('Please select both start and end dates', '⚠️');
                return;
            }

            const startDate = new Date(chartStartInput.value + 'T00:00:00');
            const endDate = new Date(chartEndInput.value + 'T23:59:59');

            if (startDate > endDate) {
                showAlert('Start date cannot be after end date', '⚠️');
                return;
            }

            generateProductWiseChart(startDate, endDate);
        }

        function generateCustomReport() {
            const startDateStr = document.getElementById('reportStartDate').value;
            const endDateStr = document.getElementById('reportEndDate').value;

            const startDate = new Date(startDateStr ? startDateStr + 'T00:00:00' : new Date().setHours(0, 0, 0, 0));
            const endDate = new Date(endDateStr ? endDateStr + 'T00:00:00' : new Date());
            endDate.setHours(23, 59, 59, 999);

            const filteredSales = sales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= startDate && saleDate <= endDate;
            });

            // Group by saleId to get unique transactions with discount
            const uniqueSales = {};
            filteredSales.forEach(sale => {
                if (!uniqueSales[sale.saleId]) {
                    // For each unique sale, store subtotal and discount
                    // If these fields don't exist in old data, we'll calculate them
                    const subtotal = sale.subtotal !== undefined && sale.subtotal !== null ? sale.subtotal : 0;
                    const discount = sale.discount !== undefined && sale.discount !== null ? sale.discount : 0;

                    uniqueSales[sale.saleId] = {
                        subtotal: subtotal,
                        discount: discount,
                        items: []
                    };
                }

                // Collect items for this sale
                uniqueSales[sale.saleId].items.push(sale);
            });

            // Calculate totals from unique sales
            let totalSubtotal = 0;
            let totalDiscount = 0;
            let totalSalesAfterDiscount = 0;
            let totalTaxableValue = 0;
            let totalCGST = 0;
            let totalSGST = 0;
            let totalIGST = 0;

            Object.values(uniqueSales).forEach(saleGroup => {
                // If subtotal/discount not in data, calculate from items
                if (saleGroup.subtotal === 0) {
                    saleGroup.subtotal = saleGroup.items.reduce((sum, item) => sum + (item.finalTotal !== undefined ? item.finalTotal : item.total), 0);
                }

                totalSubtotal += saleGroup.subtotal;
                totalDiscount += saleGroup.discount;
                totalSalesAfterDiscount += saleGroup.subtotal - saleGroup.discount;
                
                saleGroup.items.forEach(item => {
                    totalTaxableValue += item.taxableValue || 0;
                    totalCGST += item.cgst || 0;
                    totalSGST += item.sgst || 0;
                    totalIGST += item.igst || 0;
                });
            });

            // Calculate product totals (after discount)
            const totalSales = filteredSales.reduce((sum, sale) => sum + (sale.finalTotal !== undefined ? sale.finalTotal : sale.total), 0);
            const uniqueSaleCount = Object.keys(uniqueSales).length;
            const avgTransaction = uniqueSaleCount > 0 ? totalSalesAfterDiscount / uniqueSaleCount : 0;

            const productSales = {};
            filteredSales.forEach(sale => {
                productSales[sale.productName] = (productSales[sale.productName] || 0) + (sale.finalTotal !== undefined ? sale.finalTotal : sale.total);
            });

            const topProduct = Object.keys(productSales).length > 0
                ? Object.keys(productSales).reduce((a, b) =>
                    productSales[a] > productSales[b] ? a : b, '')
                : '-';

            // Update report display
            const reportTotalSalesEl = document.getElementById('reportTotalSales');
            const reportTotalDiscountEl = document.getElementById('reportTotalDiscount');
            const reportTransactionsEl = document.getElementById('reportTransactions');
            const reportAvgTransactionEl = document.getElementById('reportAvgTransaction');
            const reportTopProductEl = document.getElementById('reportTopProduct');
            
            // GST Fields
            const reportTaxableValueEl = document.getElementById('reportTaxableValue');
            const reportTotalCGSTEl = document.getElementById('reportTotalCGST');
            const reportTotalSGSTEl = document.getElementById('reportTotalSGST');
            const reportTotalIGSTEl = document.getElementById('reportTotalIGST');

            if (reportTotalSalesEl) {
                reportTotalSalesEl.textContent = '₹' + totalSalesAfterDiscount.toFixed(2);
            }
            if (reportTotalDiscountEl) {
                reportTotalDiscountEl.textContent = '₹' + totalDiscount.toFixed(2);
            }
            if (reportTaxableValueEl) reportTaxableValueEl.textContent = '₹' + totalTaxableValue.toFixed(2);
            if (reportTotalCGSTEl) reportTotalCGSTEl.textContent = '₹' + totalCGST.toFixed(2);
            if (reportTotalSGSTEl) reportTotalSGSTEl.textContent = '₹' + totalSGST.toFixed(2);
            if (reportTotalIGSTEl) reportTotalIGSTEl.textContent = '₹' + totalIGST.toFixed(2);
            if (reportTransactionsEl) {
                reportTransactionsEl.textContent = uniqueSaleCount;
            }
            if (reportAvgTransactionEl) {
                reportAvgTransactionEl.textContent = '₹' + avgTransaction.toFixed(2);
            }
            if (reportTopProductEl) {
                reportTopProductEl.textContent = topProduct;
            }
        }

        // Delete Sale with Role-Based Access Control
        function deleteSale(saleId) {
            console.log('Attempting to delete sale with ID:', saleId);
            console.log('Current sales:', sales.map(s => ({ id: s.saleId, product: s.productName })));

            if (!window.isUserAdmin) return showAlert('Unauthorized: Only Administrators can delete data.', 'error');

            // Confirm deletion
            showConfirm('⚠️ Are you sure you want to delete this sale?<br><br>This action cannot be undone!',
                function () {
                    // Find and delete all items with this saleId (convert both to string for comparison)
                    const originalLength = sales.length;
                    sales = sales.filter(sale => String(sale.saleId) !== String(saleId));
                    const deletedCount = originalLength - sales.length;

                    console.log('Deleted count:', deletedCount);

                    if (deletedCount > 0) {
                        // Save changes to localStorage
                        saveData();

                        // Refresh tables AFTER saving
                        updateTodaysSales(); // Refresh today's sales table
                        updateDashboard(); // Refresh dashboard

                        // Firebase sync removed

                        // Show success message
                        console.log('About to show success alert...');
                        showAlert(`✅ Sale deleted successfully!<br>${deletedCount} item(s) removed.`, '🗑️');
                    } else {
                        showAlert('❌ Sale not found! Check console for details.', '⚠️');
                    }
                }
            );
        }

        function generateDailySalesChart(startDate, endDate) {
            const chartContainer = document.getElementById('dailySalesChart');
            if (!chartContainer) {
                console.error('dailySalesChart container not found');
                return;
            }

            // Check if sales array exists and has data
            if (!sales || !Array.isArray(sales) || sales.length === 0) {
                chartContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #6c757d;">No sales data available in the system. Make some sales first!</p>';
                console.log('No sales data found in system');
                return;
            }

            // If dates not provided, get from input fields or default to last 7 days
            if (!startDate || !endDate) {
                const startInput = document.getElementById('chartStartDate');
                const endInput = document.getElementById('chartEndDate');
                if (startInput && startInput.value && endInput && endInput.value) {
                    startDate = new Date(startInput.value + 'T00:00:00');
                    endDate = new Date(endInput.value + 'T23:59:59');
                } else {
                    // Default to last 7 days
                    endDate = new Date();
                    endDate.setHours(23, 59, 59, 999);
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - 6);
                    startDate.setHours(0, 0, 0, 0);
                }
            } else {
                // Normalize dates if they were passed as parameters
                startDate = new Date(startDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(endDate);
                endDate.setHours(23, 59, 59, 999);
            }

            const startDateNormalized = getStartOfDay(startDate);
            const endDateNormalized = getEndOfDay(endDate);

            // Initialize all days in the date range
            const dateRange = [];
            const salesByDay = {};
            const currentDate = new Date(startDateNormalized);
            const endDateForLoop = new Date(endDateNormalized);

            while (currentDate <= endDateForLoop) {
                const dateStr = formatDateLocal(currentDate);
                dateRange.push(dateStr);
                salesByDay[dateStr] = 0;
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // Group by saleId and calculate daily totals
            // Each sale (identified by saleId) should only be counted once per day
            const saleGroups = {};

            const startTime = startDateNormalized.getTime();
            const endTime = endDateNormalized.getTime();

            const filteredSales = sales.filter(sale => {
                if (!sale || !sale.date) return false;
                const saleDate = new Date(sale.date);
                if (Number.isNaN(saleDate.getTime())) {
                    console.error('Error parsing sale date:', sale.date);
                    return false;
                }
                const saleTime = saleDate.getTime();
                return saleTime >= startTime && saleTime <= endTime;
            });

            // Debug: log filtered sales count and sample data
            console.log('Daily Sales Chart Debug:');
            console.log('- Total sales in system:', sales.length);
            console.log('- Filtered sales:', filteredSales.length);
            console.log('- Date range:', formatDateLocal(startDateNormalized), 'to', formatDateLocal(endDateNormalized));
            if (sales.length > 0) {
                console.log('- Sample sale date:', sales[0].date);
                console.log('- Sample sale date parsed:', formatDateLocal(sales[0].date));
            }
            if (filteredSales.length > 0) {
                console.log('- First filtered sale:', filteredSales[0]);
            }

            filteredSales.forEach(sale => {
                const saleDate = new Date(sale.date);
                const dateStr = formatDateLocal(saleDate);

                if (salesByDay.hasOwnProperty(dateStr)) {
                    // Group by saleId
                    if (!saleGroups[sale.saleId]) {
                        saleGroups[sale.saleId] = {
                            date: dateStr,
                            subtotal: 0,
                            discount: 0,
                            itemTotals: [] // Track individual item totals for calculation
                        };
                    }

                    // Store item total for later calculation
                    saleGroups[sale.saleId].itemTotals.push(sale.total);

                    // If subtotal/discount exist, use them (they're same for all items in a sale)
                    if (sale.subtotal !== undefined && sale.subtotal !== null && sale.subtotal > 0) {
                        saleGroups[sale.saleId].subtotal = sale.subtotal;
                    }

                    if (sale.discount !== undefined && sale.discount !== null) {
                        saleGroups[sale.saleId].discount = sale.discount;
                    }
                }
            });

            // Calculate daily totals from grouped sales
            Object.values(saleGroups).forEach(saleData => {
                const dateStr = saleData.date;
                if (salesByDay.hasOwnProperty(dateStr)) {
                    let saleTotal = 0;

                    // If we have subtotal and discount, use them
                    if (saleData.subtotal > 0) {
                        saleTotal = saleData.subtotal - (saleData.discount || 0);
                    } else {
                        // For old sales without subtotal/discount, sum item totals
                        saleTotal = saleData.itemTotals.reduce((sum, total) => sum + total, 0);
                    }

                    salesByDay[dateStr] += saleTotal;
                }
            });

            // Find max value for scaling
            const maxSales = Math.max(...Object.values(salesByDay), 1);

            // Generate chart HTML
            if (filteredSales.length === 0) {
                const startStr = startDateNormalized ? startDateNormalized.toLocaleDateString() : 'N/A';
                const endStr = endDateNormalized ? endDateNormalized.toLocaleDateString() : 'N/A';
                chartContainer.innerHTML = `<p style="text-align: center; padding: 40px; color: #6c757d;">No sales data found for the selected date range (${startStr} to ${endStr})</p>`;
                console.log('No filtered sales found. Date range:', formatDateLocal(startDateNormalized), 'to', formatDateLocal(endDateNormalized));
                return;
            }

            if (maxSales === 0 || Object.keys(salesByDay).length === 0) {
                chartContainer.innerHTML = `<p style="text-align: center; padding: 40px; color: #6c757d;">No sales data for the selected date range. Total sales in system: ${sales.length}</p>`;
                console.log('Max sales is 0, but filtered sales:', filteredSales.length);
                return;
            }

            // Determine label format based on date range length
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            const showMonth = daysDiff > 14;

            chartContainer.innerHTML = dateRange.map(date => {
                const salesTotal = salesByDay[date] || 0;
                const height = maxSales > 0 ? Math.max((salesTotal / maxSales) * 100, 5) : 5; // Minimum 5% height for visibility
                const dateObj = parseDateKey(date);

                let labelText = '';
                if (showMonth) {
                    // For longer ranges, show month/day
                    labelText = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else {
                    // For shorter ranges, show weekday/day
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const dateNum = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
                    labelText = `${dayName}<br>${dateNum}`;
                }

                return `
                    <div class="bar" style="height: ${height}%; min-height: 40px;">
                        <span class="bar-value">₹${salesTotal.toFixed(0)}</span>
                        <span class="bar-label">${labelText}</span>
                    </div>
                `;
            }).join('');
        }

        function generateProductWiseSales() {
            const productSales = {};
            let totalRevenue = 0;
            let totalDiscount = 0;
            let oldTotalRevenue = 0;
            const uniqueOldSales = {}; 

            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const gstEnabled = settings.gstEnabled === true;

            // First, collect unique OLD sales to calculate their total old discount
            sales.forEach(sale => {
                if (!sale.hasOwnProperty('billDiscount')) {
                    if (!uniqueOldSales[sale.saleId]) {
                        uniqueOldSales[sale.saleId] = {
                            discount: sale.discount || 0
                        };
                    }
                    oldTotalRevenue += sale.total;
                }
            });

            // Calculate total old discount
            const oldTotalDiscount = Object.values(uniqueOldSales).reduce((sum, s) => sum + (s.discount || 0), 0);

            // Group products and calculate revenue (before discount)
            sales.forEach(sale => {
                if (!productSales[sale.productName]) {
                    productSales[sale.productName] = {
                        units: 0,
                        revenue: 0,
                        exactDiscount: 0,
                        oldRevenue: 0,
                        taxableValue: 0,
                        cgst: 0,
                        sgst: 0,
                        igst: 0,
                        hsn: sale.hsn || '',
                        gstRate: sale.gstRate || 0
                    };
                }
                productSales[sale.productName].units += sale.quantity;
                const saleTotal = sale.finalTotal !== undefined ? sale.finalTotal : sale.total;
                productSales[sale.productName].revenue += saleTotal;
                
                productSales[sale.productName].taxableValue += sale.taxableValue || 0;
                productSales[sale.productName].cgst += sale.cgst || 0;
                productSales[sale.productName].sgst += sale.sgst || 0;
                productSales[sale.productName].igst += sale.igst || 0;
                
                totalRevenue += saleTotal;
                
                if (sale.hasOwnProperty('billDiscount')) {
                    productSales[sale.productName].exactDiscount += (sale.discount || 0);
                    totalDiscount += (sale.discount || 0); // accumulate new discounts directly
                } else {
                    productSales[sale.productName].oldRevenue += sale.total;
                }
            });
            
            totalDiscount += oldTotalDiscount; // Total discount across all data

            const tbody = document.getElementById('productWiseSales');

            if (Object.keys(productSales).length === 0) {
                const colSpan = gstEnabled ? "9" : "5";
                tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; color: #6c757d;">No sales data available</td></tr>`;
                return;
            }

            // Calculate proportional discount for each product
            tbody.innerHTML = Object.entries(productSales)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([product, data]) => {
                    const oldProductDiscount = oldTotalRevenue > 0 ? (oldTotalDiscount * (data.oldRevenue / oldTotalRevenue)) : 0;
                    const finalProductDiscount = data.exactDiscount + oldProductDiscount;
                    
                    const percentage = totalRevenue > 0 ? (data.revenue / totalRevenue * 100).toFixed(1) : 0;
                    return `
                        <tr>
                            <td>${product}</td>
                            ${gstEnabled ? `<td>${data.hsn || ''}</td>` : ''}
                            ${gstEnabled ? `<td>${data.gstRate || 0}%</td>` : ''}
                            <td>${data.units}</td>
                            ${gstEnabled ? `<td style="text-align: right;">₹${data.taxableValue.toFixed(2)}</td>` : ''}
                            ${gstEnabled ? `<td style="text-align: right;">₹${data.cgst.toFixed(2)}</td>` : ''}
                            ${gstEnabled ? `<td style="text-align: right;">₹${data.sgst.toFixed(2)}</td>` : ''}
                            ${gstEnabled ? `<td style="text-align: right;">₹${data.igst.toFixed(2)}</td>` : ''}
                            <td>₹${data.revenue.toFixed(2)}</td>
                            <td>₹${finalProductDiscount.toFixed(2)}</td>
                            <td>${percentage}%</td>
                        </tr>
                    `;
                }).join('');

            // Add total row
            const totalRow = `
                <tr style="font-weight: bold; border-top: 2px solid #333; background: #f8f9fa;">
                    <td>Total</td>
                    ${gstEnabled ? `<td></td><td></td>` : ''}
                    <td>${Object.values(productSales).reduce((sum, p) => sum + p.units, 0)}</td>
                    ${gstEnabled ? `<td style="text-align: right;">₹${Object.values(productSales).reduce((sum, p) => sum + p.taxableValue, 0).toFixed(2)}</td>` : ''}
                    ${gstEnabled ? `<td style="text-align: right;">₹${Object.values(productSales).reduce((sum, p) => sum + p.cgst, 0).toFixed(2)}</td>` : ''}
                    ${gstEnabled ? `<td style="text-align: right;">₹${Object.values(productSales).reduce((sum, p) => sum + p.sgst, 0).toFixed(2)}</td>` : ''}
                    ${gstEnabled ? `<td style="text-align: right;">₹${Object.values(productSales).reduce((sum, p) => sum + p.igst, 0).toFixed(2)}</td>` : ''}
                    <td>₹${totalRevenue.toFixed(2)}</td>
                    <td>₹${totalDiscount.toFixed(2)}</td>
                    <td>100%</td>
                </tr>
            `;
            tbody.innerHTML += totalRow;
        }

        let peakSalesChartInstance = null;
        let topProductsChartInstance = null;

        function showAllProductChartData() {
            if (!sales || sales.length === 0) return;

            // Find min and max dates from all sales
            let minDate = new Date();
            let maxDate = new Date(0); // Epoch

            sales.forEach(sale => {
                if (sale.date) {
                    const d = new Date(sale.date);
                    if (d < minDate) minDate = d;
                    if (d > maxDate) maxDate = d;
                }
            });

            // Update inputs
            const startInput = document.getElementById('productChartStartDate');
            const endInput = document.getElementById('productChartEndDate');
            if (startInput) startInput.value = formatDateLocal(minDate);
            if (endInput) endInput.value = formatDateLocal(maxDate);

            generateProductWiseChart(minDate, maxDate);
        }

        function generateProductWiseChart(startDate, endDate) {
            // This function now orchestrates the two new charts
            generatePeakSalesTimeChart(startDate, endDate);
            generateTopProductsChart(startDate, endDate);
        }

        function generatePeakSalesTimeChart(startDate, endDate) {
            const chartCanvas = document.getElementById('peakSalesChart');
            if (!chartCanvas) return;

            // Date filtering logic (reused)
            if (!startDate || !endDate) {
                const startInput = document.getElementById('productChartStartDate');
                const endInput = document.getElementById('productChartEndDate');
                if (startInput && startInput.value && endInput && endInput.value) {
                    startDate = new Date(startInput.value + 'T00:00:00');
                    endDate = new Date(endInput.value + 'T23:59:59');
                } else {
                    endDate = new Date();
                    endDate.setHours(23, 59, 59, 999);
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - 29);
                    startDate.setHours(0, 0, 0, 0);
                }
            } else {
                startDate = new Date(startDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(endDate);
                endDate.setHours(23, 59, 59, 999);
            }

            const startTime = startDate.getTime();
            const endTime = endDate.getTime();

            const filteredSales = sales.filter(sale => {
                if (!sale || !sale.date) return false;
                const saleDate = new Date(sale.date);
                const saleTime = saleDate.getTime();
                return saleTime >= startTime && saleTime <= endTime;
            });

            // Group by Hour (0-23)
            const salesByHour = new Array(24).fill(0);
            filteredSales.forEach(sale => {
                const hour = new Date(sale.date).getHours();
                salesByHour[hour]++; // Counting number of sales. Could also sum amount.
            });

            const ctx = chartCanvas.getContext('2d');
            if (peakSalesChartInstance) peakSalesChartInstance.destroy();

            peakSalesChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                    datasets: [{
                        label: 'Number of Sales',
                        data: salesByHour,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Count' } },
                        x: { title: { display: true, text: 'Hour of Day' } }
                    }
                }
            });
        }

        function generateTopProductsChart(startDate, endDate) {
            const chartCanvas = document.getElementById('topProductsChart');
            if (!chartCanvas) return;

            // Date filtering logic (reused - ideally refactor to helper)
            if (!startDate || !endDate) {
                const startInput = document.getElementById('productChartStartDate');
                const endInput = document.getElementById('productChartEndDate');
                if (startInput && startInput.value && endInput && endInput.value) {
                    startDate = new Date(startInput.value + 'T00:00:00');
                    endDate = new Date(endInput.value + 'T23:59:59');
                } else {
                    endDate = new Date();
                    endDate.setHours(23, 59, 59, 999);
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - 29);
                    startDate.setHours(0, 0, 0, 0);
                }
            } else {
                startDate = new Date(startDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(endDate);
                endDate.setHours(23, 59, 59, 999);
            }

            const startTime = startDate.getTime();
            const endTime = endDate.getTime();

            const filteredSales = sales.filter(sale => {
                if (!sale || !sale.date) return false;
                const saleDate = new Date(sale.date);
                const saleTime = saleDate.getTime();
                return saleTime >= startTime && saleTime <= endTime;
            });

            // Group by Product
            const productTotals = {};
            filteredSales.forEach(sale => {
                const productName = sale.productName || 'Unknown';
                // Using count of items sold would be better if quantity is available, 
                // but sale.total is amount. Let's use amount for "Best Selling" usually means revenue.
                // Or count? User said "what product going good". Revenue is safer.
                // Wait, sale object here is per line item? 
                // Let's check how sales are stored. 
                // 'sales' array contains individual line items from 'completeSale' pushing '...saleItems'.
                // Yes, saleItems are pushed individually with 'productName', 'quantity', 'total'.
                // So we can sum quantity or total. Let's sum Quantity for "Popularity".

                const qty = parseInt(sale.quantity) || 1;
                productTotals[productName] = (productTotals[productName] || 0) + qty;
            });

            // Sort and Top 5
            const top5 = Object.entries(productTotals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            const ctx = chartCanvas.getContext('2d');
            if (topProductsChartInstance) topProductsChartInstance.destroy();

            topProductsChartInstance = new Chart(ctx, {
                type: 'bar', // Horizontal bar is better for names
                indexAxis: 'y',
                data: {
                    labels: top5.map(p => p[0]),
                    datasets: [{
                        label: 'Units Sold',
                        data: top5.map(p => p[1]),
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(255, 205, 86, 0.6)',
                            'rgba(201, 203, 207, 0.6)',
                            'rgba(54, 162, 235, 0.6)'
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(255, 205, 86, 1)',
                            'rgba(201, 203, 207, 1)',
                            'rgba(54, 162, 235, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { beginAtZero: true, title: { display: true, text: 'Units Sold' } }
                    }
                }
            });
        }

        const UNIT_OPTIONS_HTML = `
            <option value="">Select Unit...</option>
            <option value="Piece">Piece</option>
            <option value="Pack">Pack</option>
            <option value="Box">Box</option>
            <option value="Set">Set</option>
            <option value="Pair">Pair</option>
            <option value="Dozen">Dozen</option>
            <option value="Bundle">Bundle</option>
            <option value="Carton">Carton</option>
            <option value="Roll">Roll</option>
            <option value="Bag">Bag</option>
            <option value="Packet">Packet</option>
            <option value="Kilogram">Kilogram (kg)</option>
            <option value="Gram">Gram (g)</option>
            <option value="Litre">Litre (L)</option>
            <option value="Millilitre">Millilitre (ml)</option>
            <option value="Meter">Meter (m)</option>
            <option value="Centimeter">Centimeter (cm)</option>
            <option value="Inch">Inch</option>
            <option value="Feet">Feet</option>
            <option value="Bottle">Bottle</option>
            <option value="Tin">Tin</option>
            <option value="Can">Can</option>
            <option value="Tube">Tube</option>
            <option value="Tray">Tray</option>
            <option value="Cup">Cup</option>
            <option value="Unit">Unit</option>
            <option value="Sheet">Sheet</option>
        `;

        // Pack Size Functions
        function addPackSizeInput(name = '', quantity = '', price = '', containerId = 'packSizesContainer') {
            const container = document.getElementById(containerId);
            const id = Date.now() + Math.random().toString(36).substr(2, 9);

            const div = document.createElement('div');
            div.className = 'pack-size-row';
            div.style.display = 'grid';
            div.style.gridTemplateColumns = '2fr 1fr 1fr auto';
            div.style.gap = '10px';
            div.style.marginBottom = '10px';
            div.style.alignItems = 'end';

            div.innerHTML = `
                <div>
                    <label style="font-size: 0.8em; color: #6c757d;">Pack Unit</label>
                    <select class="pack-name" required style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                        ${UNIT_OPTIONS_HTML}
                    </select>
                </div>
                <div>
                    <label style="font-size: 0.8em; color: #6c757d;">Qty (box/pack total units)</label>
                    <input type="number" class="pack-qty" placeholder="10" min="1" value="${quantity}" required>
                </div>
                <div>
                    <label style="font-size: 0.8em; color: #6c757d;">Price (₹)</label>
                    <input type="number" class="pack-price" placeholder="45" step="0.01" value="${price}" required>
                </div>
                <button type="button" class="btn btn-cart-remove btn-sm" onclick="this.parentElement.remove()" style="height: 42px;">×</button>
            `;

            container.appendChild(div);

            // Set selected value if provided
            if (name) {
                const select = div.querySelector('.pack-name');
                if ([...select.options].some(opt => opt.value === name)) {
                    select.value = name;
                } else {
                    // If the saved name isn't in the list (e.g. custom), add it or handle it
                    // For now, we'll just append it as an option if it's not empty
                    const option = new Option(name, name, true, true);
                    select.add(option);
                }
            }
        }

        function getPackSizesFromForm(containerId = 'packSizesContainer') {
            const container = document.getElementById(containerId);
            const rows = container.querySelectorAll('.pack-size-row');
            const packSizes = [];

            rows.forEach(row => {
                const name = row.querySelector('.pack-name').value.trim();
                const quantity = parseInt(row.querySelector('.pack-qty').value);
                const price = parseFloat(row.querySelector('.pack-price').value);

                if (name && quantity && !isNaN(price)) {
                    packSizes.push({ name, quantity, price });
                }
            });

            return packSizes;
        }

        // Barcode Management Functions

        function generateAutoBarcode() {
            // Format: DDS-TIMESTAMP (Unique enough for single store)
            const code = 'DDS-' + Date.now().toString().slice(-6);
            document.getElementById('productBarcode').value = code;
        }

        function generateAutoBarcodeForEdit() {
            const code = 'DDS-' + Date.now().toString().slice(-6);
            document.getElementById('editProductBarcode').value = code;
        }

        function toggleSelectAllProducts(checkbox) {
            const checkboxes = document.querySelectorAll('.product-select-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = checkbox.checked;
                const id = parseInt(cb.dataset.id);
                if (checkbox.checked) {
                    selectedLabelProductIds.add(id);
                } else {
                    selectedLabelProductIds.delete(id);
                }
            });
            updatePrintButtonState();
            checkbox.indeterminate = false;
        }

        function updateMainLabelQty(id, qty) {
            const product = products.find(p => p.id == id);
            if(product) {
                product._labelQty = parseInt(qty) || 0;
            }
        }

        function setMainLabelQuantitiesToStock() {
            // Only update quantities for *selected* products in the current view
            const checkboxes = document.querySelectorAll('.product-select-checkbox:checked');
            checkboxes.forEach(cb => {
                const id = parseInt(cb.dataset.id);
                const product = products.find(p => String(p.id) === String(id));
                if (product) {
                    const stockQty = Math.max(0, parseInt(product.stock) || 0);
                    product._labelQty = stockQty;
                    // update input visually
                    const input = document.querySelector(`.main-label-qty[data-id="${id}"]`);
                    if (input) input.value = stockQty;
                }
            });
            if(checkboxes.length > 0) showAlert('Quantities updated from stock.', '✅');
            else showAlert('Please select products first!', '⚠️');
        }

        function openCustomQtyModal() {
            const checkboxes = document.querySelectorAll('.product-select-checkbox:checked');
            if(checkboxes.length === 0) {
                showAlert('Please select products first!', '⚠️');
                return;
            }
            document.getElementById('customQtyInput').value = '10'; // default value
            document.getElementById('customQtyModal').style.display = 'flex';
        }

        function closeCustomQtyModal() {
            document.getElementById('customQtyModal').style.display = 'none';
        }

        function applyCustomQty() {
            const qtyVal = document.getElementById('customQtyInput').value;
            const parsedQty = parseInt(qtyVal) || 0;
            
            const checkboxes = document.querySelectorAll('.product-select-checkbox:checked');
            checkboxes.forEach(cb => {
                const id = parseInt(cb.dataset.id);
                const product = products.find(p => String(p.id) === String(id));
                if (product) {
                    product._labelQty = parsedQty;
                    // update input visually
                    const input = document.querySelector(`.main-label-qty[data-id="${id}"]`);
                    if (input) input.value = parsedQty;
                }
            });
            closeCustomQtyModal();
        }

        function printSelectedLabels() {
            if (selectedLabelProductIds.size === 0) {
                showAlert('Please select products to print labels!', '⚠️');
                return;
            }

            const selectedProducts = products.filter(p => selectedLabelProductIds.has(p.id));

            if (selectedProducts.length === 0) {
                showAlert('Error matching selected products. Please try again.', '❌');
                return;
            }

            const printItems = [];
            let totalQty = 0;

            selectedProducts.forEach(p => {
                const qty = p._labelQty !== undefined ? p._labelQty : 1;
                if (qty > 0) {
                    printItems.push({
                        product: p,
                        qty: qty
                    });
                    totalQty += qty;
                }
            });

            if(printItems.length === 0) {
                showAlert('Please set a quantity greater than 0 for the selected products.', '⚠️');
                return;
            }

            printLabels(printItems);
        }

        function printSingleLabel(productId) {
            const product = products.find(p => p.id == productId);
            if (!product) {
                showAlert('Product not found.', '❌');
                return;
            }

            const qty = product._labelQty !== undefined ? product._labelQty : 1;
            
            if (qty <= 0) {
                showAlert('Please enter a label quantity greater than 0.', '⚠️');
                return;
            }

            printLabels([{
                product: product,
                qty: qty
            }]);
        }

        function printLabels(printItems) {
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            
            // Allow override from Label Center if not default
            let w = settings.labelWidth || 50;
            let h = settings.labelHeight || 30;
            const sizeOverride = document.getElementById('labelCenterSize');
            if (sizeOverride && sizeOverride.value !== 'default') {
                if (sizeOverride.value === 'pen') { w = 50; h = 30; }
                else if (sizeOverride.value === 'standard') { w = 38; h = 25; }
                else if (sizeOverride.value === 'large') { w = 100; h = 150; }
            }

            const gapX = settings.labelGapX || 2;
            const gapY = settings.labelGapY || 2;
            const mt = settings.labelMarginTop || 0;
            const mr = settings.labelMarginRight || 0;
            const mb = settings.labelMarginBottom || 0;
            const ml = settings.labelMarginLeft || 0;
            
            const fontSize = settings.labelFontSize || 10;
            const fontWeight = settings.labelFontBold !== false ? 'bold' : 'normal';
            const align = settings.labelAlignment || 'center';
            
            // Barcode dimensions based on size setting
            let bcWidth = 1.5;
            let bcHeight = 30;
            if (settings.labelBarcodeSize === 'small') { bcWidth = 1; bcHeight = 20; }
            else if (settings.labelBarcodeSize === 'large') { bcWidth = 2; bcHeight = 40; }

            let labelsHtml = '';
            let labelIndex = 0;

            printItems.forEach((item) => {
                const product = item.product;
                const qty = item.qty;

                // Determine barcode value
                let barcodeValue = product.barcode;
                let barcodeFormat = "CODE128";

                if (!barcodeValue) {
                    barcodeValue = "DDS-" + product.id; // Fallback
                }
                if (barcodeValue.length === 13 && /^\d+$/.test(barcodeValue)) {
                    barcodeFormat = "EAN13";
                }

                for(let i = 0; i < qty; i++) {
                    let productNameDisplay = product.name;
                    
                    // Month Code Logic
                    if (settings.labelShowMonthCode) {
                        const currentMonthIndex = new Date().getMonth(); // 0 to 11
                        const mc = (settings.labelMonthCodes && settings.labelMonthCodes[currentMonthIndex]) ? settings.labelMonthCodes[currentMonthIndex] : '';
                        if (mc) {
                            productNameDisplay = mc + " " + productNameDisplay;
                        }
                    }

                    // Expiry Date Logic
                    let expiryHtml = '';
                    if (settings.labelShowExpiry && product.expiryDays) {
                        const expDate = new Date();
                        expDate.setDate(expDate.getDate() + parseInt(product.expiryDays));
                        const formattedExp = String(expDate.getDate()).padStart(2, '0') + '/' + String(expDate.getMonth() + 1).padStart(2, '0') + '/' + String(expDate.getFullYear()).slice(-2);
                        expiryHtml = `<div class="meta-info">Exp: ${formattedExp}</div>`;
                    }

                    // Mfg Date Logic
                    let mfgHtml = '';
                    if (settings.labelShowMfgDate) {
                        const today = new Date();
                        const formattedMfg = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0') + '/' + String(today.getFullYear()).slice(-2);
                        mfgHtml = `<div class="meta-info">Mfg: ${formattedMfg}</div>`;
                    }

                    // Business Name Logic
                    let bNameHtml = '';
                    if (settings.labelShowBusinessName && settings.businessName) {
                        bNameHtml = `<div class="business-name">${settings.businessName}</div>`;
                    }
                    
                    // Unit Logic removed as per request

                    // MRP / Price Logic
                    let priceHtml = '';
                    if (settings.labelShowMRP) {
                        priceHtml = `<div class="price">MRP: ₹${parseFloat(product.price).toFixed(2)}</div>`;
                    }

                    // Barcode Toggle
                    let barcodeHtml = '';
                    if (settings.labelShowBarcode !== false) {
                        barcodeHtml = `<svg id="barcode-svg-${labelIndex}" class="barcode-svg" data-value="${barcodeValue}" data-format="${barcodeFormat}"></svg>`;
                    }

                    labelsHtml += `
                        <div class="label" style="text-align: ${align};">
                            ${bNameHtml}
                            <div class="product-name">${productNameDisplay}</div>
                            ${barcodeHtml}
                            ${priceHtml}
                            <div style="display: flex; gap: 5px; justify-content: ${align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center')}; width: 100%;">
                                ${mfgHtml}
                                ${expiryHtml}
                            </div>
                        </div>
                    `;
                    labelIndex++;
                }
            });

            const finalHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Print Labels</title>
                    <\/script>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 0; 
                            padding: 10px; 
                        }
                        .sheet {
                            display: flex;
                            flex-wrap: wrap;
                            gap: ${gapY}mm ${gapX}mm;
                            justify-content: flex-start;
                            align-content: flex-start;
                        }
                        .label {
                            width: ${w}mm;
                            height: ${h}mm;
                            border: 1px dashed #ccc;
                            display: flex;
                            flex-direction: column;
                            align-items: ${align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center')};
                            justify-content: center;
                            padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;
                            box-sizing: border-box;
                            page-break-inside: avoid;
                            overflow: hidden;
                        }
                        .product-name { 
                            font-size: ${fontSize}px; 
                            font-weight: ${fontWeight}; 
                            white-space: nowrap; 
                            overflow: hidden; 
                            max-width: 100%; 
                            text-overflow: ellipsis;
                        }
                        .price { 
                            font-size: ${fontSize + 2}px; 
                            font-weight: bold; 
                            margin-top: 2px; 
                        }
                        .business-name {
                            font-size: ${Math.max(fontSize - 2, 8)}px;
                            font-weight: bold;
                            margin-bottom: 2px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            max-width: 100%;
                        }
                        .meta-info {
                            font-size: ${Math.max(fontSize - 4, 6)}px;
                            color: #333;
                            margin-top: 1px;
                        }
                        svg { max-width: 100%; max-height: 50%; }
                        
                        @media print {
                            body { padding: 0; }
                            .label { border: none; } /* Hide border for actual print */
                            @page { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        ${labelsHtml}
                    </div>
                    
                        window.onload = function() {
                            document.querySelectorAll('.barcode-svg').forEach(svg => {
                                try {
                                    JsBarcode('#' + svg.id, svg.dataset.value, {
                                        format: svg.dataset.format,
                                        width: ${bcWidth},
                                        height: ${bcHeight},
                                        displayValue: true,
                                        fontSize: ${fontSize - 1},
                                        margin: 0
                                    });
                                } catch (error) {
                                    console.warn("Barcode rendering failed for " + svg.dataset.value + " with format " + svg.dataset.format + ", falling back to CODE128.");
                                    try {
                                        JsBarcode('#' + svg.id, svg.dataset.value, {
                                            format: "CODE128",
                                            width: ${bcWidth},
                                            height: ${bcHeight},
                                            displayValue: true,
                                            fontSize: ${fontSize - 1},
                                            margin: 0
                                        });
                                    } catch (fallbackError) {
                                        console.error("Barcode fallback failed for " + svg.dataset.value);
                                    }
                                }
                            });
                            // Auto print after rendering
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                    <\/script></body>

                </html>
            `;

            const blob = new Blob([finalHtml], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
            
            if (!printWindow) {
                showAlert('Pop-up blocked! Please allow pop-ups to print.', '⚠️');
                return;
            }
            
            // Clean up the blob URL after a minute to ensure it has time to load
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 60000);
        }

        function calculateSimilarity(s1, s2) {
            let longer = s1;
            let shorter = s2;
            if (s1.length < s2.length) {
                longer = s2;
                shorter = s1;
            }
            let longerLength = longer.length;
            if (longerLength === 0) {
                return 1.0;
            }
            const distance = editDistance(longer, shorter);
            const similarity = (longerLength - distance) / parseFloat(longerLength);
            // console.log(`Similarity between "${s1}" and "${s2}": ${similarity.toFixed(2)} (Dist: ${distance})`);
            return similarity;
        }

        function editDistance(s1, s2) {
            s1 = s1.toLowerCase();
            s2 = s2.toLowerCase();
            const costs = [];
            for (let i = 0; i <= s1.length; i++) {
                let row = [];
                for (let j = 0; j <= s2.length; j++) {
                    row.push(0);
                }
                costs.push(row);
            }

            for (let i = 0; i <= s1.length; i++) {
                costs[i][0] = i;
            }
            for (let j = 0; j <= s2.length; j++) {
                costs[0][j] = j;
            }

            for (let i = 1; i <= s1.length; i++) {
                for (let j = 1; j <= s2.length; j++) {
                    let cost = 1;
                    if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
                        cost = 0;
                    }
                    costs[i][j] = Math.min(
                        costs[i - 1][j] + 1,     // deletion
                        costs[i][j - 1] + 1,     // insertion
                        costs[i - 1][j - 1] + cost // substitution
                    );
                }
            }
            return costs[s1.length][s2.length];
        }

        function addProduct(event) {
            event.preventDefault();

            if (!navigator.onLine) {
                showAlert('⚠️ Warning: You are offline. Changes will be saved locally.', 'offline');
            }

            const barcode = document.getElementById('productBarcode').value;
            const name = document.getElementById('productName').value.trim();

            // 1. Check if barcode already exists
            if (products.find(p => p.barcode === barcode)) {
                showAlert('A product with this barcode already exists!', '⚠️');
                return;
            }

            // 2. Strict Name Check (100% Match)
            const exactMatch = products.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
            if (exactMatch) {
                showAlert(`Duplicate Name! Product "${exactMatch.name}" already exists.`, '⚠️');
                return;
            }

            // 3. Fuzzy Name Check (≥ 80% Match)
            // Find the most similar product
            let maxSimilarity = 0;
            let similarProduct = null;

            products.forEach(p => {
                const similarity = calculateSimilarity(name, p.name);
                if (similarity > maxSimilarity) {
                    maxSimilarity = similarity;
                    similarProduct = p;
                }
            });

            console.log(`🔎 Similarity Check for "${name}": Max Score = ${maxSimilarity.toFixed(2)} with "${similarProduct ? similarProduct.name : 'None'}"`);

            const expDaysVal = document.getElementById('newProductExpiryDays') && document.getElementById('newProductExpiryDays').value !== '' ? parseInt(document.getElementById('newProductExpiryDays').value) || 0 : 0;
            let expDateVal = null;
            if (expDaysVal > 0) {
                let d = new Date();
                d.setDate(d.getDate() + expDaysVal);
                expDateVal = d.toISOString().split('T')[0];
            }
            
            // Prepare product object
            const productData = {
                id: Date.now(),
                barcode: barcode,
                name: name,
                // Category handling needs to be resolved before this object is final
                category: '', // Placeholder, will set in finalize
                unit: document.getElementById('newProductUnit').value,
                expiryDays: expDaysVal,
                expiryDate: expDateVal,
                quantityType: document.getElementById('newProductQuantityType').value || 'whole',
                // decimalPrecision removed
                packSizes: getPackSizesFromForm('packSizesContainer'),
                price: parseFloat(document.getElementById('productPrice').value),
                stock: parseFloat(document.getElementById('productStock').value),
                minStock: parseFloat(document.getElementById('productMinStock').value),
                supplier: document.getElementById('productSupplier').value || 'N/A',
                description: document.getElementById('productDescription').value || ''
            };

            // Logic to get correct category
            const categorySelect = document.getElementById('productCategory');
            const customCategoryInput = document.getElementById('customCategory');
            let categoryValue = categorySelect ? categorySelect.value : '';

            if (categoryValue === 'Other' && customCategoryInput && customCategoryInput.value.trim() !== '') {
                // We'll handle custom category addition in finalize
                categoryValue = customCategoryInput.value.trim();
            }
            productData.category = categoryValue;


            if (maxSimilarity >= 0.65) {
                // 4. Show Verification Popup
                showConfirm(
                    `Similar Product Found!\n"${similarProduct.name}" is ${(maxSimilarity * 100).toFixed(0)}% similar to "${name}".\n\nDo you want to add it anyway?`,
                    () => {
                        finalizeAddProduct(productData, categorySelect, customCategoryInput);
                    },
                    () => {
                        // Cancelled
                        console.log('Add product cancelled due to similarity');
                    },
                    '⚠️'
                );
            } else {
                // No similarity issues
                finalizeAddProduct(productData, categorySelect, customCategoryInput);
            }
        }

        function finalizeAddProduct(product, categorySelect, customCategoryInput) {
            if (typeof isDemoMode === 'function' && isDemoMode()) {
                if (!canCreateDemoProduct()) {
                    showDemoLimitMessage('products');
                    return;
                }
                product.isDemo = true;
            }
            // Handle Custom Category persistence
            if (categorySelect.value === 'Other' && customCategoryInput.value.trim() !== '') {
                const customValue = product.category;

                // Add to localStorage
                let categories = JSON.parse(localStorage.getItem('customCategories') || '[]');
                if (!categories.includes(customValue)) {
                    categories.push(customValue);
                    localStorage.setItem('customCategories', JSON.stringify(categories));
                    
                }

                // Add to select if not exists
                if (![...categorySelect.options].some(opt => opt.value === customValue)) {
                    categorySelect.insertBefore(new Option(customValue, customValue), categorySelect.lastElementChild);
                }

                categorySelect.value = customValue;
            }

            products.push(product);
            saveData();

            document.getElementById('productForm').reset();
            updateProductsTable();
            showAlert('Product added successfully!', '✅');
        }

        // Global Set to track selected product IDs across searches
        const selectedLabelProductIds = new Set();

        function updateProductExpiryDays(id, value) {
            const product = products.find(p => String(p.id) === String(id));
            if (product) {
                const numVal = parseInt(value);
                const newExpiryDays = (numVal && numVal > 0) ? numVal : 0;
                
                if (newExpiryDays !== (product.expiryDays || 0)) {
                    product.expiryDays = newExpiryDays > 0 ? newExpiryDays : '';
                    if (newExpiryDays > 0) {
                        let d = new Date();
                        d.setDate(d.getDate() + newExpiryDays);
                        product.expiryDate = d.toISOString().split('T')[0];
                    } else {
                        product.expiryDate = null;
                    }
                    saveData();
                }
            }
        }

        function toggleProductSelection(id, isChecked) {
            id = parseInt(id);
            if (isChecked) {
                selectedLabelProductIds.add(id);
            } else {
                selectedLabelProductIds.delete(id);
            }
            updatePrintButtonState();
            
            const allCheckboxes = document.querySelectorAll('.product-select-checkbox');
            const checkedCount = document.querySelectorAll('.product-select-checkbox:checked').length;
            const selectAllCb = document.getElementById('selectAllProducts');
            if (selectAllCb && allCheckboxes.length > 0) {
                selectAllCb.checked = (checkedCount === allCheckboxes.length);
                selectAllCb.indeterminate = (checkedCount > 0 && checkedCount < allCheckboxes.length);
            }
        }

        function updatePrintButtonState() {
            const printBtn = document.querySelector('button[onclick="printSelectedLabels()"]');
            if (printBtn) {
                const count = selectedLabelProductIds.size;
                if (count > 0) {
                    printBtn.innerHTML = `🖨️ Print Selected (${count})`;
                } else {
                    printBtn.innerHTML = `🖨️ Print Selected`;
                }
            }
        }

        // Unified Search Handler
        function handleLabelCenterSearch() {
            if (window.isPriceManagerActive) {
                updatePriceManagerTable();
            } else {
                updateProductsTable();
            }
        }

        function updateProductsTable() {
            const tbody = document.getElementById('productsTableBody');
            if (!tbody) return; // Prevent crash

            const searchInput = document.getElementById('productSearchLabelCenter');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const showExpDays = settings.labelShowExpiry === true;
            const expHeader = document.getElementById('labelCenterExpDaysHeader');
            if (expHeader) expHeader.style.display = showExpDays ? 'table-cell' : 'none';

            console.log('Search Debug:', { searchTerm, totalProducts: products.length });

            // Filter products based on search term
            let filteredProducts = searchProductsUnified(searchTerm, products);
            
            const filterVal = document.getElementById('filterLabelCenter') ? document.getElementById('filterLabelCenter').value : 'all';
            if (filterVal === 'selected') {
                filteredProducts = filteredProducts.filter(p => selectedLabelProductIds.has(p.id));
            } else if (filterVal === 'instock') {
                filteredProducts = filteredProducts.filter(p => parseFloat(p.stock) > 0);
            } else if (filterVal === 'outstock') {
                filteredProducts = filteredProducts.filter(p => parseFloat(p.stock) <= 0);
            } else if (filterVal.startsWith('cat_')) {
                const catStr = filterVal.replace('cat_', '');
                filteredProducts = filteredProducts.filter(p => p.category === catStr);
            }

            if (filteredProducts.length === 0) {
                const message = searchTerm ? 'No matching products found' : 'No products added yet';
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #6c757d;">${message}</td></tr>`;

                // Update "Select All" checkbox state
                const selectAllCb = document.getElementById('selectAllProducts');
                if (selectAllCb) selectAllCb.checked = false;

                return;
            }

            const col = window.labelCenterSortColumn || 'id';
            const desc = window.labelCenterSortDesc !== undefined ? window.labelCenterSortDesc : true;
            
            const sortedProducts = [...filteredProducts].sort((a, b) => {
                let valA = a[col] !== undefined ? a[col] : (col === '_labelQty' ? 1 : '');
                let valB = b[col] !== undefined ? b[col] : (col === '_labelQty' ? 1 : '');
                
                if (col === 'stock' || col === 'price' || col === '_labelQty' || col === 'id') {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                    return desc ? valB - valA : valA - valB;
                } else {
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                    if (valA < valB) return desc ? 1 : -1;
                    if (valA > valB) return desc ? -1 : 1;
                    return 0;
                }
            });

            // Update sort indicators
            const sortCols = ['barcode', 'name', 'category', 'stock', 'price', '_labelQty'];
            sortCols.forEach(c => {
                const span = document.getElementById('labelSort-' + c);
                if (span) {
                    if (c === col) {
                        span.textContent = desc ? ' ↓' : ' ↑';
                    } else {
                        span.textContent = ' ↕️';
                    }
                }
            });

            // Check if all visible items are selected to update "Select All" checkbox
            const selectedVisibleCount = sortedProducts.filter(p => selectedLabelProductIds.has(p.id)).length;
            const selectAllCb = document.getElementById('selectAllProducts');
            if (selectAllCb) {
                selectAllCb.checked = (sortedProducts.length > 0 && selectedVisibleCount === sortedProducts.length);
                selectAllCb.indeterminate = (selectedVisibleCount > 0 && selectedVisibleCount < sortedProducts.length);
            }

            tbody.innerHTML = sortedProducts.map(product => `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="product-select-checkbox" 
                               data-id="${product.id}" 
                               ${selectedLabelProductIds.has(product.id) ? 'checked' : ''}
                               onchange="toggleProductSelection('${product.id}', this.checked)"
                               onkeydown="handleLabelCheckboxKeydown(event, this)">
                    </td>
                    <td>${product.barcode || 'N/A'}</td>
                    <td>
                        <span onclick="toggleFavourite('${product.id}')" style="cursor: pointer; font-size: 1.2em; margin-right: 5px; user-select: none;" title="Toggle Favourite">
                            ${product.isFavourite ? '⭐' : '☆'}
                        </span>
                        ${product.name}
                    </td>
                    <td>${product.category}</td>
                    ${showExpDays ? `<td style="text-align: right;"><input type="number" class="form-control form-control-sm" value="${product.expiryDays || ''}" onchange="updateProductExpiryDays('${product.id}', this.value)" onfocus="this.select()" min="0" style="width: 60px; height: 26px; font-size: 13px; text-align: right; margin: 0 0 0 auto; padding: 2px 5px;" placeholder="—"></td>` : ''}
                    <td style="text-align: right;">${product.stock} ${product.unit || ''}</td>
                    <td style="text-align: right;">₹${product.price.toFixed(2)}</td>
                    <td style="text-align: center;">
                        <input type="number" class="form-control form-control-sm main-label-qty" data-id="${product.id}" value="${product._labelQty !== undefined ? product._labelQty : 1}" min="0" onfocus="this.select()" style="width: 60px; height: 26px; font-size: 13px; margin: 0 auto; padding: 2px 5px;" onchange="updateMainLabelQty('${product.id}', this.value)" onkeydown="handleLabelQtyKeydown(event, this)">
                    </td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="printSingleLabel('${product.id}')" title="Print Label">🖨️</button>
                        ${window.hasPermission('product_add_edit') ? `<button class="btn btn-warning btn-sm" onclick="editProduct('${product.id}')" title="Edit">✏️</button>` : ''}
                        ${window.hasPermission('delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.id}')" title="Delete">🗑️</button>` : ''}
                    </td>
                </tr>
            `).join('');

            if (typeof renderQuickSaleCards === 'function') renderQuickSaleCards();
        }

        function deleteProduct(id) {
            if (!window.isUserAdmin) return showAlert('Unauthorized: Only Administrators can delete data.', 'error');
            const product = products.find(p => String(p.id) === String(id));
            if (!product) return;

            // Check if product has sales history
            const hasSales = sales.some(sale => String(sale.productId) === String(id));

            // Check if product has stock
            if (product.stock > 0) {
                showAlert(`Cannot delete product with existing stock (${product.stock} units). Please update stock to 0 first or adjust inventory.`, '⚠️');
                return;
            }

            const executeDelete = () => {
                products = products.filter(p => String(p.id) !== String(id));
                saveData();
                updateProductsTable();
                updateInventoryTable();
                updateDashboard();
                showAlert('Product deleted successfully!', '✅');
            };

            if (hasSales) {
                showConfirm(`This product has sales history. Deleting it will remove it from inventory but sales records will remain. Continue?`, executeDelete);
            } else {
                showConfirm('Are you sure you want to delete this product?', executeDelete);
            }
        }

        function toggleEditVariantUI() {
            const hasVariantsCb = document.getElementById('editProductHasVariants');
            const variantSection = document.getElementById('editVariantSection');
            if (hasVariantsCb && variantSection) {
                variantSection.style.display = hasVariantsCb.checked ? 'block' : 'none';
            }
        }

        function renderEditVariantsTable(product) {
            const tbody = document.getElementById('editVariantsTableBody');
            if (!tbody) return;
            if (!product || !product.variants || product.variants.length === 0) {
                tbody.innerHTML = '<tr id="editNoVariantsRow"><td colspan="7" style="padding: 15px; text-align: center; color: #666; font-style: italic;">No variants added yet. Click + to add variant.</td></tr>';
                return;
            }

            tbody.innerHTML = product.variants.map((v, index) => {
                const discText = (v.productDiscount !== undefined && v.productDiscount !== null && v.productDiscount !== '') ? `${v.productDiscount}%` : '—';
                const sellP = parseFloat(v.sellingPrice !== undefined ? v.sellingPrice : (v.price || 0)).toFixed(2);
                const buyP = parseFloat(v.buyingPrice || 0).toFixed(2);
                return `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px; font-weight:600; color:#333;">${v.variantName}</td>
                        <td style="padding: 10px; font-size:13px; color:#555;">${v.barcode || '—'}</td>
                        <td style="padding: 10px; font-weight:600; color:#0d6efd;">₹${sellP}</td>
                        <td style="padding: 10px;" class="buying-price-feature">₹${buyP}</td>
                        <td style="padding: 10px;">${discText}</td>
                        <td style="padding: 10px; font-weight:600;">${v.stock || 0}</td>
                        <td style="padding: 10px; text-align:center;">
                            <button type="button" class="btn btn-warning btn-sm" onclick="closeEditProductModal(); setTimeout(()=>editInventoryVariant('${product.id}','${v.id}'),80);" title="Edit Variant" style="padding:4px 10px; font-size:14px; font-weight:600;">✏️ Edit</button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="deleteInventoryVariant('${product.id}','${v.id}'); setTimeout(()=>editProduct('${product.id}'),150);" title="Delete Variant" style="padding:4px 8px; font-size:14px; margin-left:4px;">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function editProduct(id) {
            const product = products.find(p => String(p.id) === String(id));
            if (!product) return;

            currentEditingProductId = id;

            // Populate edit form
            document.getElementById('editProductId').value = product.id;
            document.getElementById('editProductBarcode').value = product.barcode || '';
            document.getElementById('editProductName').value = product.name;
            const editPurchasePrice = document.getElementById('editProductPurchasePrice');
            if(editPurchasePrice) editPurchasePrice.value = product.costPrice || '';

            const editImgBase64 = document.getElementById('editProductImageBase64');
            const editImgPreview = document.getElementById('editProductImagePreview');
            const editImgClear = document.getElementById('editProductImageClear');
            if (product.image) {
                editImgBase64.value = product.image;
                editImgPreview.src = product.image;
                editImgPreview.style.display = 'block';
                editImgClear.style.display = 'block';
            } else {
                editImgBase64.value = '';
                editImgPreview.src = '';
                editImgPreview.style.display = 'none';
                editImgClear.style.display = 'none';
            }

            // Refresh dropdowns from master data
            populateCategoryDropdowns();
            populateUnitDropdowns();

            // Handle category - add to dropdown if it's a custom category not in the list
            const categorySelect = document.getElementById('editProductCategory');
            const categoryExists = [...categorySelect.options].some(opt => opt.value === product.category);

            if (!categoryExists && product.category !== 'Other') {
                // Add custom category to dropdown before "Other" option
                const otherOption = categorySelect.querySelector('option[value="Other"]');
                const newOption = new Option(product.category, product.category);
                categorySelect.insertBefore(newOption, otherOption);
            }

            categorySelect.value = product.category;

            const editExpiryDaysEl = document.getElementById('editProductExpiryDays');
            if (editExpiryDaysEl) {
                editExpiryDaysEl.value = product.expiryDays || '';
            }

            // Set unit if available
            if (document.getElementById('editProductUnit')) {
                document.getElementById('editProductUnit').value = product.unit || 'Piece';
            }
            if (document.getElementById('editProductQuantityType')) {
                const qtyType = product.quantityType || 'whole';
                document.getElementById('editProductQuantityType').value = qtyType;
            }

            document.getElementById('editProductPrice').value = product.price;

            const editDiscEl = document.getElementById('editProductDiscount');
            if (editDiscEl) {
                editDiscEl.value = (product.productDiscount !== undefined && product.productDiscount !== null && product.productDiscount !== "") ? product.productDiscount : '';
            }
            const editHsnEl = document.getElementById('editProductHSN');
            if (editHsnEl) editHsnEl.value = product.hsn || '';
            
            const editGstEl = document.getElementById('editProductGSTRate');
            const editCustomGstEl = document.getElementById('editProductCustomGSTRate');
            if (editGstEl && editCustomGstEl) {
                let gstVal = product.gstRate || 0;
                if ([0, 5, 12, 18, 28].includes(gstVal)) {
                    editGstEl.value = gstVal;
                    editCustomGstEl.style.display = 'none';
                } else {
                    editGstEl.value = 'custom';
                    editCustomGstEl.value = gstVal;
                    editCustomGstEl.style.display = 'block';
                }
            }

            document.getElementById('editProductStock').value = product.stock;
            document.getElementById('editProductMinStock').value = product.minStock;
            document.getElementById('editProductSupplier').value = product.supplier || '';

            // Description
            const editDescEl = document.getElementById('editProductDescription');
            if (editDescEl) editDescEl.value = product.description || '';

            // Product Variants section
            const hasVariants = window.hasVariants(product) && Array.isArray(product.variants) && product.variants.length > 0;
            const hasVariantsCb = document.getElementById('editProductHasVariants');
            const variantSection = document.getElementById('editVariantSection');
            if (hasVariantsCb) {
                hasVariantsCb.checked = hasVariants;
            }
            if (variantSection) {
                variantSection.style.display = hasVariants ? 'block' : 'none';
            }
            renderEditVariantsTable(product);

            // Populate Pack Sizes
            const editPackSizesContainer = document.getElementById('editPackSizesContainer');
            editPackSizesContainer.innerHTML = ''; // Clear existing
            if (product.packSizes && product.packSizes.length > 0) {
                product.packSizes.forEach(pack => {
                    addPackSizeInput(pack.name, pack.quantity, pack.price, 'editPackSizesContainer');
                });
            }

            // Handle Permissions
            const canEditGeneral = window.hasPermission('product_add_edit');
            const canEditPrice = window.hasPermission('product_add_edit');
            const canEditGst = window.hasPermission('product_add_edit');
            const canEditDiscount = window.hasPermission('product_add_edit');

            document.getElementById('editProductName').disabled = !canEditGeneral;
            document.getElementById('editProductBarcode').disabled = !canEditGeneral;
            categorySelect.disabled = !canEditGeneral;
            if(document.getElementById('editProductUnit')) document.getElementById('editProductUnit').disabled = !canEditGeneral;
            document.getElementById('editProductStock').disabled = !canEditGeneral;
            document.getElementById('editProductMinStock').disabled = !canEditGeneral;
            document.getElementById('editProductSupplier').disabled = !canEditGeneral;
            if (document.getElementById('editProductImage')) document.getElementById('editProductImage').disabled = !canEditGeneral;

            document.getElementById('editProductPrice').disabled = !canEditPrice;

            if (editGstEl) editGstEl.disabled = !canEditGst;
            if (editCustomGstEl) editCustomGstEl.disabled = !canEditGst;
            if (editHsnEl) editHsnEl.disabled = !canEditGst;

            if (editDiscEl) editDiscEl.disabled = !canEditDiscount;

            // Hide/Show Save button
            const saveBtn = document.querySelector('#editProductForm button[type="submit"]');
            if (saveBtn) {
                if (!canEditGeneral && !canEditPrice && !canEditGst && !canEditDiscount) {
                    saveBtn.style.display = 'none';
                } else {
                    saveBtn.style.display = 'block';
                }
            }

            // Show modal
            document.getElementById('editProductModal').style.display = 'flex';
            setTimeout(() => { const nm = document.getElementById('editProductName'); if(nm) nm.focus(); }, 50);
        }

        function closeEditProductModal() {
            document.getElementById('editProductModal').style.display = 'none';
            currentEditingProductId = null;
            document.getElementById('editProductForm').reset();
        }

        function saveEditedProduct(event) {
            if (!requireLicensedForWrite('editing a product')) return;
            event.preventDefault();

            try {
                if (!currentEditingProductId) {
                    console.error("No product ID for editing");
                    return;
                }

                const product = products.find(p => String(p.id) === String(currentEditingProductId));
                if (!product) {
                    showAlert("Error: Product not found!", "❌");
                    return;
                }

                // Handle category
                const categorySelect = document.getElementById('editProductCategory');
                let categoryValue = categorySelect.value;

                // Update product
                const newBarcode = document.getElementById('editProductBarcode').value.trim();
                // Check for duplicate barcode if changed
                if (newBarcode && newBarcode !== (product.barcode || '')) {
                    const existingProduct = products.find(p => p.barcode === newBarcode && p.id !== product.id);
                    if (existingProduct) {
                        showAlert('Barcode already exists for another product!', '⚠️');
                        return;
                    }
                }

                product.barcode = newBarcode;
                product.name = document.getElementById('editProductName').value;
                product.category = categoryValue;
                product.unit = document.getElementById('editProductUnit').value;
                
                const expEl = document.getElementById('editProductExpiryDays');
                const newExpiryDays = expEl && expEl.value !== '' ? parseInt(expEl.value) || 0 : 0;
                if (newExpiryDays !== (product.expiryDays || 0)) {
                    product.expiryDays = newExpiryDays;
                    if (newExpiryDays > 0) {
                        let d = new Date();
                        d.setDate(d.getDate() + newExpiryDays);
                        product.expiryDate = d.toISOString().split('T')[0];
                    } else {
                        product.expiryDate = null;
                    }
                }
                
                const editQtyType = document.getElementById('editProductQuantityType');
                if (editQtyType) {
                    product.quantityType = editQtyType.value;

                }
                
                product.price = parseFloat(document.getElementById('editProductPrice').value);
                const editPurchasePriceEl = document.getElementById('editProductPurchasePrice');
                if (editPurchasePriceEl) {
                    product.costPrice = editPurchasePriceEl.value !== '' ? parseFloat(editPurchasePriceEl.value) || 0 : 0;
                }
                
                const discVal = document.getElementById('editProductDiscount').value;
                product.productDiscount = discVal.trim() === "" ? "" : parseFloat(discVal);
                
                const hsnEl = document.getElementById('editProductHSN');
                product.hsn = hsnEl ? hsnEl.value : '';

                const gstRateEl = document.getElementById('editProductGSTRate');
                let gstRate = gstRateEl ? gstRateEl.value : '0';
                if (gstRate === 'custom') {
                    const customGstEl = document.getElementById('editProductCustomGSTRate');
                    gstRate = customGstEl ? customGstEl.value : '0';
                }
                product.gstRate = parseFloat(gstRate) || 0;

                product.stock = parseFloat(document.getElementById('editProductStock').value);
                product.minStock = parseFloat(document.getElementById('editProductMinStock').value);
                product.supplier = document.getElementById('editProductSupplier').value || 'N/A';

                // Description
                const descEl = document.getElementById('editProductDescription');
                if (descEl) product.description = descEl.value || '';

                const editImgBase64 = document.getElementById('editProductImageBase64');
                if (editImgBase64) {
                    product.image = editImgBase64.value;
                }

                // Pack sizes - check if container exists first to be safe
                const packSizesContainer = document.getElementById('editPackSizesContainer');
                if (packSizesContainer) {
                    product.packSizes = getPackSizesFromForm('editPackSizesContainer');
                } else {
                    product.packSizes = [];
                }

                saveData();
                updateProductsTable();
                updateInventoryTable();
                updateDashboard();
                closeEditProductModal();
                showAlert('Product updated successfully!', '✅');
            } catch (error) {
                console.error("CRITICAL ERROR in saveEditedProduct:", error);
                // alert("Debug Error: " + error.message); // Uncomment for debugging
                showAlert("Error saving: " + error.message, "❌");
            }
        }

        function editInventoryProduct(id) {
            editProduct(id);
        }

        // Helper: open Add Variant modal from the Edit Product form
        function openAddVariantFromEdit() {
            const prodId = document.getElementById('editProductId') && document.getElementById('editProductId').value;
            if (!prodId) return;
            closeEditProductModal();
            setTimeout(() => openAddVariantModal(prodId), 80);
        }

        // Esc closes the Edit Variant modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const evModal = document.getElementById('editVariantModal');
                if (evModal && evModal.style.display === 'flex') {
                    e.preventDefault();
                    closeEditVariantModal();
                }
            }
        });

        function editInventoryVariant(productId, variantId) {
            const product = products.find(p => String(p.id) === String(productId));
            if (!product) return;
            const variant = window.getVariantById(product, variantId);
            if (!variant) return;

            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const buyTrack = settings.buyingPriceTracking !== undefined ? settings.buyingPriceTracking : false;

            // Remove any old inline overlay
            const oldOverlay = document.getElementById('editVariantModalOverlay');
            if (oldOverlay) oldOverlay.remove();

            // Store context for save
            window._evProductId = String(productId);
            window._evVariantId = String(variantId);

            // Parent name
            document.getElementById('evParentName').textContent = product.name;

            // Basic fields
            document.getElementById('evName').value = variant.variantName || '';
            document.getElementById('evBarcode').value = variant.barcode || '';
            document.getElementById('evSellPrice').value = variant.sellingPrice || 0;
            document.getElementById('evBuyPrice').value = variant.buyingPrice || 0;
            document.getElementById('evDiscount').value = (variant.productDiscount !== undefined && variant.productDiscount !== null && variant.productDiscount !== '') ? variant.productDiscount : 0;
            document.getElementById('evStock').value = variant.stock || 0;
            document.getElementById('evMinStock').value = variant.minimumStock || 0;

            // Buying price visibility
            const buyGroup = document.getElementById('evBuyPriceGroup');
            if (buyGroup) buyGroup.style.display = buyTrack ? '' : 'none';

            // GST fields visibility
            const gstVisible = settings.enableGST !== false;
            const hsnGroup = document.getElementById('evHSNGroup');
            const gstGroup = document.getElementById('evGSTGroup');
            if (hsnGroup) hsnGroup.style.display = gstVisible ? '' : 'none';
            if (gstGroup) gstGroup.style.display = gstVisible ? '' : 'none';

            // HSN
            const evHSNCustom = document.getElementById('evHSNCustom');
            if (evHSNCustom) evHSNCustom.value = variant.hsn || '';

            // Category dropdown — populate from master
            const evCat = document.getElementById('evCategory');
            evCat.innerHTML = '<option value="">Same as parent</option>';
            (typeof categories !== 'undefined' ? categories : []).forEach(cat => {
                const o = document.createElement('option');
                o.value = cat.name || cat;
                o.textContent = cat.name || cat;
                evCat.appendChild(o);
            });
            evCat.value = variant.category || '';

            // Base Unit dropdown — populate from master
            const evUnit = document.getElementById('evUnit');
            evUnit.innerHTML = '<option value="">Same as parent</option>';
            const unitList = (typeof units !== 'undefined' && units.length) ? units
                : ['Piece','Box','Kg','Gram','Litre','Ml','Meter','Pack','Set','Dozen','Pair','Roll','Sheet','Bag','Bottle','Can','Carton','Tube','Strip','Tablet'];
            unitList.forEach(u => {
                const o = document.createElement('option');
                const val = u.name || u;
                o.value = val; o.textContent = val;
                evUnit.appendChild(o);
            });
            evUnit.value = variant.unit || '';

            // Qty Type
            document.getElementById('evQtyType').value = variant.quantityType || '';

            // GST
            const evGST = document.getElementById('evGST');
            const evGSTCustom = document.getElementById('evGSTCustom');
            const varGST = (variant.gstRate !== undefined && variant.gstRate !== null && variant.gstRate !== '') ? String(variant.gstRate) : '';
            if (varGST === '') {
                evGST.value = '';
                evGSTCustom.style.display = 'none';
            } else if (['0','5','12','18','28'].includes(varGST)) {
                evGST.value = varGST;
                evGSTCustom.style.display = 'none';
            } else {
                evGST.value = '__custom__';
                evGSTCustom.value = varGST;
                evGSTCustom.style.display = 'block';
            }

            // Pack sizes
            const container = document.getElementById('evPackSizesContainer');
            container.innerHTML = '';
            if (variant.packSizes && variant.packSizes.length > 0) {
                variant.packSizes.forEach(ps => addPackSizeInput(ps.name, ps.quantity, ps.price, 'evPackSizesContainer'));
            }

            // Show modal
            const modal = document.getElementById('editVariantModal');
            modal.style.display = 'flex';
            setTimeout(() => { const f = document.getElementById('evName'); if (f) f.focus(); }, 60);
        }

        function closeEditVariantModal() {
            document.getElementById('editVariantModal').style.display = 'none';
            window._evProductId = null;
            window._evVariantId = null;
        }

        function saveEditedVariantFull() {
            if (!requireLicensedForWrite('editing a variant')) return;

            const productId = window._evProductId;
            const variantId = window._evVariantId;
            const product = products.find(p => String(p.id) === String(productId));
            if (!product) { showAlert('Product not found!', '❌'); return; }
            const variant = window.getVariantById(product, variantId);
            if (!variant) { showAlert('Variant not found!', '❌'); return; }

            const name = document.getElementById('evName').value.trim();
            if (!name) { showAlert('Variant Name is required.', '⚠️'); return; }

            // Duplicate name check (excluding self)
            const dup = product.variants.find(v => String(v.id) !== String(variantId) && String(v.variantName).toLowerCase().trim() === name.toLowerCase());
            if (dup) { showAlert(`Variant "${name}" already exists for ${product.name}.`, '⚠️'); return; }

            const barcode = document.getElementById('evBarcode').value.trim();
            // Barcode uniqueness
            if (barcode && barcode !== variant.barcode) {
                const bExists = products.some(p => {
                    if (String(p.id) === String(productId)) {
                        return (p.variants || []).some(v => String(v.id) !== String(variantId) && v.barcode === barcode);
                    }
                    if (p.barcode === barcode) return true;
                    return (p.variants || []).some(v => v.barcode === barcode);
                });
                if (bExists) { showAlert('Barcode already exists globally!', '⚠️'); return; }
            }

            // Read HSN
            const evHSNCustom = document.getElementById('evHSNCustom');
            const hsn = evHSNCustom ? evHSNCustom.value.trim() : '';

            // Read GST
            const evGST = document.getElementById('evGST');
            let gstRate = null;
            if (evGST.value === '') {
                gstRate = null; // inherit parent
            } else if (evGST.value === '__custom__') {
                gstRate = parseFloat(document.getElementById('evGSTCustom').value) || 0;
            } else {
                gstRate = parseFloat(evGST.value);
            }

            const buyPriceEl = document.getElementById('evBuyPrice');

            // Apply all changes to variant object
            variant.variantName = name;
            variant.barcode = barcode;
            variant.sellingPrice = parseFloat(document.getElementById('evSellPrice').value) || 0;
            variant.buyingPrice = buyPriceEl ? (parseFloat(buyPriceEl.value) || 0) : (variant.buyingPrice || 0);
            const discRaw = document.getElementById('evDiscount').value;
            variant.productDiscount = discRaw === '' ? '' : (parseFloat(discRaw) || 0);
            variant.stock = parseFloat(document.getElementById('evStock').value) || 0;
            variant.minimumStock = parseFloat(document.getElementById('evMinStock').value) || 0;
            variant.hsn = hsn;
            const catVal = document.getElementById('evCategory').value;
            variant.category = catVal || '';
            const unitVal = document.getElementById('evUnit').value;
            variant.unit = unitVal || '';
            const qtyVal = document.getElementById('evQtyType').value;
            variant.quantityType = qtyVal || '';
            if (gstRate !== null) {
                variant.gstRate = gstRate;
            } else {
                delete variant.gstRate;
            }
            // Pack sizes — independent from parent
            if (typeof getPackSizesFromForm === 'function') {
                variant.packSizes = getPackSizesFromForm('evPackSizesContainer');
            }

            saveData();
            updateInventoryTable();
            closeEditVariantModal();
            showAlert(`Variant "${name}" updated successfully!`, '✅');
        }

        // Compatibility alias
        function saveEditedVariant(productId, variantId) { saveEditedVariantFull(); }

        function deleteInventoryVariant(productId, variantId) {
            const product = products.find(p => String(p.id) === String(productId));
            if (!product) return;
            const variant = window.getVariantById(product, variantId);
            if (!variant) return;

            const displayName = window.getVariantDisplayName(product, variant);
            showConfirm(`Are you sure you want to delete variant "${displayName}"?`, () => {
                product.variants = product.variants.filter(v => String(v.id) !== String(variantId));
                saveData();
                updateInventoryTable();
                showAlert(`Variant "${displayName}" deleted successfully!`, '✅');
            });
        }

        function exportInventoryCSV() {
            if (products.length === 0) {
                showAlert('No inventory data to export', '⚠️');
                return;
            }

            let csv = 'Barcode,Product Name,Category,Current Stock,Unit Price,Total Value,Min Stock,Status,Supplier\n';

            products.forEach(product => {
                const totalValue = (product.price * product.stock).toFixed(2);
                const status = product.stock <= product.minStock ? 'Low Stock' : 'In Stock';
                csv += `${product.barcode || 'N/A'},${product.name},${product.category},${product.stock},${product.price},${totalValue},${product.minStock},${status},${product.supplier || 'N/A'}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventory_report_${formatDateLocal(new Date())}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        function exportInventoryPDF() {
            if (products.length === 0) {
                showAlert('No inventory data to export', '⚠️');
                return;
            }

            // Create HTML content for PDF
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Inventory Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { text-align: center; color: #333; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
                        th { background-color: #667eea; color: white; }
                        tr:nth-child(even) { background-color: #f2f2f2; }
                        .low-stock { color: #dc3545; font-weight: bold; }
                        .footer { margin-top: 30px; text-align: center; color: #666; }
                    </style>
                </head>
                <body>
                    <h1>Inventory Report</h1>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Total Products:</strong> ${products.length}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Barcode</th>
                                <th>Product Name</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Unit Price</th>
                                <th>Total Value</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            products.forEach(product => {
                const totalValue = (product.price * product.stock).toFixed(2);
                const status = product.stock <= product.minStock ? 'Low Stock' : 'In Stock';
                const statusClass = product.stock <= product.minStock ? 'low-stock' : '';
                htmlContent += `
                    <tr data-product-id="${product.id}" onclick="if(window.selectInventoryRowKeyboard) window.selectInventoryRowKeyboard('${product.id}')">
                    <td>${product.barcode || 'N/A'}</td>
                        <td>${product.name}</td>
                        <td>${product.category}</td>
                        <td class="${statusClass}">${product.stock}</td>
                        <td>₹${product.price.toFixed(2)}</td>
                        <td>₹${totalValue}</td>
                        <td class="${statusClass}">${status}</td>
                    </tr>
                `;
            });

            htmlContent += `
                        </tbody>
                    </table>
                    <div class="footer">
                        <p>Generated on ${new Date().toLocaleString()}</p>
                    </div></body>

                </html>
            `;

            // Open print window for PDF
            const printWindow = window.open('', '', 'width=800,height=600');
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();

            // Wait for content to load then print
            setTimeout(() => {
                printWindow.print();
                // Note: User can save as PDF from print dialog
            }, 500);
        }

        function exportReport() {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;

            const filteredSales = sales.filter(sale => {
                const saleDate = formatDateLocal(sale.date);
                return saleDate >= startDate && saleDate <= endDate;
            });

            if (filteredSales.length === 0) {
                showAlert('No sales data to export for selected period', '⚠️');
                return;
            }

            let csv = 'Sale Date,Entry Date & Time,Bill No,Customer Name,Customer GSTIN / GST No,Customer Address,Customer State,Tax Type (Intra-State / Inter-State),Subtotal,Discount,Taxable Amount,CGST,SGST,IGST,Total,Payment Method\n';

            // Group by bill
            const bills = {};
            filteredSales.forEach(sale => {
                if (!bills[sale.saleId]) {
                    bills[sale.saleId] = {
                        saleId: sale.saleId,
                        date: sale.date,
                        createdAt: sale.createdAt,
                        receiptNumber: sale.receiptNumber || '-',
                        customerName: sale.customerName || '-',
                        customerGSTIN: sale.customerGSTIN || '-',
                        customerAddress: sale.customerAddress || '-',
                        customerState: sale.customerState || '-',
                        taxType: sale.taxType || '-',
                        paymentMethod: sale.paymentMethod || '-',
                        subtotal: 0,
                        discount: 0,
                        taxableValue: 0,
                        cgst: 0,
                        sgst: 0,
                        igst: 0,
                        total: 0,
                        cashAmount: sale.cashAmount,
                        otherPaymentAmount: sale.otherPaymentAmount
                    };
                }

                bills[sale.saleId].subtotal += sale.total;
                bills[sale.saleId].taxableValue += (sale.taxableValue || 0);
                bills[sale.saleId].cgst += (sale.cgst || 0);
                bills[sale.saleId].sgst += (sale.sgst || 0);
                bills[sale.saleId].igst += (sale.igst || 0);

                if (sale.discount) {
                    bills[sale.saleId].discount = sale.discount;
                }
                
                // Inherit customer data from any item if not set (fallback)
                if (bills[sale.saleId].customerGSTIN === '-' && sale.customerGSTIN) bills[sale.saleId].customerGSTIN = sale.customerGSTIN;
                if (bills[sale.saleId].customerAddress === '-' && sale.customerAddress) bills[sale.saleId].customerAddress = sale.customerAddress;
                if (bills[sale.saleId].customerState === '-' && sale.customerState) bills[sale.saleId].customerState = sale.customerState;
                if (bills[sale.saleId].taxType === '-' && sale.taxType) bills[sale.saleId].taxType = sale.taxType;
            });

            let grandSubtotal = 0;
            let grandDiscount = 0;
            let grandTaxable = 0;
            let grandCGST = 0;
            let grandSGST = 0;
            let grandIGST = 0;
            let grandTotalInvoice = 0;

            // Calculate final totals and generate CSV rows
            Object.values(bills).forEach(bill => {
                bill.total = bill.taxableValue + bill.cgst + bill.sgst + bill.igst;
                
                grandSubtotal += bill.subtotal;
                grandDiscount += bill.discount;
                grandTaxable += bill.taxableValue;
                grandCGST += bill.cgst;
                grandSGST += bill.sgst;
                grandIGST += bill.igst;
                grandTotalInvoice += bill.total;

                const date = new Date(bill.date);
                const sd = date.toLocaleDateString('en-GB');
                const ed = bill.createdAt ? new Date(bill.createdAt).toLocaleString('en-GB') : 'N/A';

                let paymentDisplay = bill.paymentMethod.toUpperCase();
                if (bill.paymentMethod === 'mixed') {
                    if (bill.cashAmount !== undefined && bill.otherPaymentAmount !== undefined) {
                        paymentDisplay = `Cash: ${bill.cashAmount.toFixed(2)} + UPI: ${bill.otherPaymentAmount.toFixed(2)}`;
                    } else {
                        paymentDisplay = 'Mixed';
                    }
                }
                
                let taxTypeDisplay = bill.taxType === 'intra' ? 'Intra-State (CGST + SGST)' : (bill.taxType === 'inter' ? 'Inter-State (IGST)' : '-');

                // Escape commas in fields
                const customerName = `"${bill.customerName.replace(/"/g, '""')}"`;
                const customerGSTIN = `"${bill.customerGSTIN.toUpperCase().replace(/"/g, '""')}"`;
                const customerAddress = `"${bill.customerAddress.replace(/"/g, '""')}"`;
                const payment = `"${paymentDisplay.replace(/"/g, '""')}"`;

                csv += `${sd},${ed},${bill.receiptNumber},${customerName},${customerGSTIN},${customerAddress},${bill.customerState},${taxTypeDisplay},${bill.subtotal.toFixed(2)},${bill.discount.toFixed(2)},${bill.taxableValue.toFixed(2)},${bill.cgst.toFixed(2)},${bill.sgst.toFixed(2)},${bill.igst.toFixed(2)},${bill.total.toFixed(2)},${payment}\n`;
            });
            
            // Append Grand Total Row
            csv += `GRAND TOTAL,,,,,,,,${grandSubtotal.toFixed(2)},${grandDiscount.toFixed(2)},${grandTaxable.toFixed(2)},${grandCGST.toFixed(2)},${grandSGST.toFixed(2)},${grandIGST.toFixed(2)},${grandTotalInvoice.toFixed(2)},\n`;

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales_report_${startDate}_to_${endDate}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        // Initialize dashboard on load
        updateDashboard();
        // Note: populateSaleProductSelect() is called by refreshUI() after data loads from Firebase
        updateCartDisplay();

        // Initialize payment method
        togglePaymentFields();

        // Display negative change count on load
        document.getElementById('negativeChangeCount').textContent = negativeChangeCount;

        // Category dynamic input and persistence
        function toggleCategoryInput() {
            const select = document.getElementById('productCategory');
            const custom = document.getElementById('customCategory');
            if (select.value === 'Other') {
                custom.style.display = 'block';
                custom.focus();
            } else {
                custom.style.display = 'none';
            }
        }

        // When submitting the product form, use custom category if present
        const productForm = document.getElementById('productForm');

        // On page load, populate custom categories
        (function () {
            const select = document.getElementById('productCategory');
            let categories = JSON.parse(localStorage.getItem('customCategories') || '[]');
            if (categories.length > 0 && select) {
                categories.forEach(cat => {
                    if (![...select.options].some(opt => opt.value === cat)) {
                        select.insertBefore(new Option(cat, cat), select.lastElementChild);
                    }
                });
            }
        })();

        // Discount logic
        function updateDiscount() {
            const discount = parseFloat(document.getElementById('discountAmount').value) || 0;
            const courier = parseFloat(document.getElementById('courierCharges').value) || 0;
            const subtotal = parseFloat(document.getElementById('cartSubtotal').value) || 0;
            let newTotal = subtotal - discount + courier;
            newTotal = Math.max(newTotal, 0);
            document.getElementById('cartTotal').value = newTotal.toFixed(2);
            const elTopRightTotal = document.getElementById('topRightTotalAmount');
            if (elTopRightTotal) elTopRightTotal.textContent = newTotal.toFixed(2);
            calculateChange();
        }

        // Custom Modal Logic
        function closePopup() {
            document.getElementById('popupModal').style.display = 'none';
            if (typeof window.popupCloseCallback === 'function') {
                window.popupCloseCallback();
                window.popupCloseCallback = null;
            }
        }

        function showAlert(msg, icon = '⚠️') {
            document.getElementById('popupIcon').textContent = icon;
            document.getElementById('popupMsg').innerHTML = msg.replace(/\n/g, '<br>');
            const btnContainer = document.getElementById('popupButtons');
            btnContainer.innerHTML = `<button id="alertOkBtn" class="btn btn-primary" onclick="closePopup()">OK</button>`;
            document.getElementById('popupModal').style.display = 'flex';

            // Auto-focus OK button for Enter key support
            setTimeout(() => {
                const btn = document.getElementById('alertOkBtn');
                if (btn) btn.focus();
            }, 50);
        }

        function showConfirm(msg, onYes, onNo = null, icon = '❓') {
            document.getElementById('popupIcon').textContent = icon;
            document.getElementById('popupMsg').innerHTML = msg.replace(/\n/g, '<br>');
            const btnContainer = document.getElementById('popupButtons');

            // Create buttons programmatically
            btnContainer.innerHTML = '';

            const noBtn = document.createElement('button');
            noBtn.className = 'btn';
            noBtn.style.backgroundColor = '#6c757d';
            noBtn.style.color = 'white';
            noBtn.textContent = 'No';
            noBtn.onclick = function () {
                closePopup();
                if (onNo) onNo();
            };

            const yesBtn = document.createElement('button');
            yesBtn.id = 'confirmYesBtn'; // Add ID for focus
            yesBtn.className = 'btn btn-primary';  // Changed from btn-danger to btn-primary
            yesBtn.textContent = 'Yes';
            yesBtn.onclick = function () {
                closePopup();
                if (onYes) onYes();
            };

            // Arrow Key Navigation
            noBtn.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    yesBtn.focus();
                }
            });

            yesBtn.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    noBtn.focus();
                }
            });

            btnContainer.appendChild(noBtn);
            btnContainer.appendChild(yesBtn);

            document.getElementById('popupModal').style.display = 'flex';

            // Store original keydown to restore later
            const oldKeydown = window._modalKeydownHandler;
            if (oldKeydown) document.removeEventListener('keydown', oldKeydown, true);
            
            const modalKeydown = function(e) {
                if (document.getElementById('popupModal').style.display === 'none') return;
                
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    document.removeEventListener('keydown', modalKeydown, true);
                    closePopup();
                    if (onNo) onNo();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    document.removeEventListener('keydown', modalKeydown, true);
                    closePopup();
                    if (onYes) onYes();
                }
            };
            window._modalKeydownHandler = modalKeydown;
            document.addEventListener('keydown', modalKeydown, true);
            
            // Clean up original onNo/onYes to remove listener if clicked manually
            const origOnNo = noBtn.onclick;
            noBtn.onclick = function(e) {
                if(e) e.preventDefault();
                document.removeEventListener('keydown', modalKeydown, true);
                closePopup();
                if (onNo) onNo();
            };
            const origOnYes = yesBtn.onclick;
            yesBtn.onclick = function(e) {
                if(e) e.preventDefault();
                document.removeEventListener('keydown', modalKeydown, true);
                closePopup();
                if (onYes) onYes();
            };

            // Auto-focus Yes button
            setTimeout(() => {
                const btn = document.getElementById('confirmYesBtn');
                if (btn) btn.focus();
            }, 50);
        }

        function showPasswordPrompt(msg, onSubmit, icon = '🔒') {
            document.getElementById('popupIcon').textContent = icon;
            document.getElementById('popupMsg').innerHTML = msg.replace(/\n/g, '<br>');
            const btnContainer = document.getElementById('popupButtons');

            // Create password input and buttons with stacked layout
            btnContainer.innerHTML = `
                <div style="width:100%;text-align:left;margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;color:#495057;font-weight:500;font-size:14px;">Password</label>
                    <input type="password" id="passwordInput" 
                           value=""
                           placeholder="Enter admin password" 
                           autocomplete="off"
                           style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:8px;font-size:15px;box-sizing:border-box;"
                           onkeypress="if(event.key==='Enter') document.getElementById('passwordSubmitBtn').click()">
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px;width:100%;">
                    <button class="btn" style="background-color:#6c757d;color:white;padding:8px 20px;font-size:14px;" onclick="closePopup()">Cancel</button>
                    <button id="passwordSubmitBtn" class="btn btn-primary" style="padding:8px 20px;font-size:14px;" onclick="submitPassword()">Submit</button>
                </div>
            `;

            // Store the callback
            window.currentPasswordCallback = onSubmit;

            document.getElementById('popupModal').style.display = 'flex';

            // Focus the input and clear any previous value
            setTimeout(() => {
                const input = document.getElementById('passwordInput');
                if (input) {
                    input.value = ''; // Ensure it's empty
                    input.focus();
                }
            }, 100);
        }

        function submitPassword() {
            const password = document.getElementById('passwordInput').value;
            closePopup();
            if (window.currentPasswordCallback) {
                window.currentPasswordCallback(password);
                window.currentPasswordCallback = null;
            }
        }

        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('Service Worker registered:', registration.scope);
                    })
                    .catch(error => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }
    
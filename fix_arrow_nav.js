// Global Arrow Navigation feature
document.addEventListener('keydown', function(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const active = document.activeElement;
        
        // Only proceed if focused on an interactive element
        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'BUTTON' || active.tagName === 'TEXTAREA')) {
            
            // Let specific comboboxes handle their own dropdown navigation for Up/Down
            const comboboxes = ['saleCustomerSearch', 'saleProductSearch', 'purchaseSearchInput', 'paymentMethodSearch', 'saleUnitSearch', 'quickSaleBarcode', 'stockBarcode', 'inventorySearchInput', 'customerSearch'];
            if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && comboboxes.includes(active.id)) {
                return; // Let the specific handler deal with it
            }
            
            // For text/number inputs, let Left/Right arrows move the text cursor natively
            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                return; 
            }
            
            // Also let Calculator handle its own grid
            if (document.getElementById('calculator') && document.getElementById('calculator').classList.contains('active')) {
                // If they are inside the calculator, the calc handler already does something, but let's not interfere.
                if (active.classList.contains('calc-btn') || active.id === 'calcDisplay') {
                    return;
                }
            }

            // Determine context (active modal or active tab)
            let context = document.querySelector('.tab-content.active');
            
            // Check Modals (they should take precedence over tabs)
            const openModals = document.querySelectorAll('.modal, #purchaseNewProductContainer');
            for (let m of openModals) {
                // Check if visible
                if (m.style.display === 'block' || m.style.display === 'flex' || window.getComputedStyle(m).display !== 'none') {
                    context = m;
                    // For nested modals (like Add New Product on top of Purchase), the highest z-index / last one usually applies,
                    // but querySelectorAll returns them in DOM order. 
                    // Let's just pick the first visible one that contains the active element.
                    if (m.contains(active)) {
                        context = m;
                        break;
                    }
                }
            }
            
            if (!context || !context.contains(active)) return;
            
            // Get all focusable elements
            const focusable = Array.from(context.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])'))
                .filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
                });
                
            const index = focusable.indexOf(active);
            if (index > -1) {
                let nextIndex = index;
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    nextIndex = index + 1;
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    nextIndex = index - 1;
                }
                
                if (nextIndex >= 0 && nextIndex < focusable.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    focusable[nextIndex].focus();
                    if (focusable[nextIndex].select) {
                        focusable[nextIndex].select();
                    }
                }
            }
        }
    }
}, true); // Use capture to intercept before default scrolling or native behaviors

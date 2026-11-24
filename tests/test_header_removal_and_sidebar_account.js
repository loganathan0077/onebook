/**
 * Verification Test: Header Removal and Sidebar Account Controls
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
    console.log('🧪 Running Header Removal and Sidebar Account Controls Verification...');
    const htmlPath = path.join(__dirname, '..', 'OneBook.html');
    assert.strictEqual(fs.existsSync(htmlPath), true, 'OneBook.html must exist');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // 1. Verify Top Header is removed from mainAppContainer (between mainAppContainer and main-wrapper)
    const mainAppContainerSection = html.substring(
        html.indexOf('id="mainAppContainer"'),
        html.indexOf('class="main-wrapper"')
    );
    assert.strictEqual(
        mainAppContainerSection.includes('class="header"'),
        false,
        'Top business header (<div class="header">) must be removed from the dashboard container'
    );

    // 2. Verify legacy fallback container exists and is hidden
    assert.strictEqual(
        html.includes('id="headerLegacyFallbacks"'),
        true,
        'Legacy fallback elements must exist to prevent JavaScript errors'
    );
    assert.strictEqual(
        html.includes('id="headerTitle"'),
        true,
        'headerTitle fallback must exist'
    );
    assert.strictEqual(
        html.includes('id="headerLogo"'),
        true,
        'headerLogo fallback must exist'
    );
    assert.strictEqual(
        html.includes('id="userEmail"'),
        true,
        'userEmail fallback must exist'
    );

    // 3. Verify Nav Menu Scrollable container for F1-F10
    assert.strictEqual(
        html.includes('class="nav-menu-scrollable"'),
        true,
        'Navigation tabs must be wrapped inside a scrollable container'
    );
    for (let i = 1; i <= 10; i++) {
        assert.strictEqual(
            html.includes(`<kbd class="nav-shortcut">F${i}</kbd>`),
            true,
            `Shortcut key F${i} must be preserved in navigation buttons`
        );
    }

    // 4. Verify Sidebar Account Section and 3 Rows
    assert.strictEqual(
        html.includes('class="sidebar-account-section"'),
        true,
        'Right sidebar must contain a dedicated account section at the bottom'
    );

    // Row A: Current Company (Clickable Dropdown)
    assert.strictEqual(
        html.includes('id="sidebarCompanyRow"'),
        true,
        'Current Company row must exist'
    );
    assert.strictEqual(
        html.includes('id="sidebarCompanyName"'),
        true,
        'Dynamic company name span must exist in Current Company row'
    );
    assert.strictEqual(
        html.includes('fa-building'),
        true,
        'Building icon must be present'
    );
    assert.strictEqual(
        html.includes('id="sidebarCompanyChevron"'),
        true,
        'Dropdown chevron arrow must be present'
    );
    assert.strictEqual(
        html.includes('id="sidebarCompanyDropdown"'),
        true,
        'Company dropdown menu must be present'
    );

    // Verify separate Switch Company button is removed from account section
    const accountSectionStr = html.substring(
        html.indexOf('class="sidebar-account-section"'),
        html.indexOf('class="sidebar-branding-footer"')
    );
    assert.strictEqual(
        accountSectionStr.includes('id="sidebarSwitchRow"'),
        false,
        'Separate Switch Company button must be removed from the sidebar'
    );

    // Row: Logout (with Red text/icon)
    assert.strictEqual(
        html.includes('id="sidebarLogoutRow"'),
        true,
        'Logout row must exist'
    );
    assert.strictEqual(
        html.includes('class="account-row-text logout-text"'),
        true,
        'Logout text element must exist'
    );
    assert.strictEqual(
        html.includes('fa-power-off'),
        true,
        'Logout power icon must exist'
    );

    // Tooltip
    assert.strictEqual(
        html.includes('id="sidebarLogoutTooltip"'),
        true,
        'Logout hover tooltip must exist'
    );
    assert.strictEqual(
        html.includes('id="logoutTooltipEmail"'),
        true,
        'Dynamic user email element must exist in tooltip'
    );
    assert.strictEqual(
        html.includes('Logged in as'),
        true,
        'Tooltip title "Logged in as" must exist'
    );

    // 5. Verify Company Information Modal
    assert.strictEqual(
        html.includes('id="companyInfoModal"'),
        true,
        'Company Information Modal must exist'
    );
    assert.strictEqual(
        html.includes('id="infoModalCompanyName"'),
        true,
        'Company Info modal company name must exist'
    );
    assert.strictEqual(
        html.includes('id="infoModalFinancialYear"'),
        true,
        'Company Info modal FY must exist'
    );
    assert.strictEqual(
        html.includes('id="infoModalLocation"'),
        true,
        'Company Info modal location must exist'
    );

    // 6. Verify CSS definitions
    assert.strictEqual(
        html.includes('.nav-menu-scrollable'),
        true,
        'CSS for .nav-menu-scrollable must exist'
    );
    assert.strictEqual(
        html.includes('.sidebar-account-section'),
        true,
        'CSS for .sidebar-account-section must exist'
    );
    assert.strictEqual(
        html.includes('.logout-tooltip'),
        true,
        'CSS for .logout-tooltip must exist'
    );
    assert.strictEqual(
        html.includes('.sidebar-account-row.logout-row:hover .logout-tooltip'),
        true,
        'CSS hover rule for .logout-tooltip must exist'
    );

    console.log('✅ ALL HEADER REMOVAL & SIDEBAR ACCOUNT CONTROLS TESTS PASSED!');
}

runTest();

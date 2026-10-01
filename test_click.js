const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('/Users/log/onebook/OneBookTest.html', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

// Simulate DOMContentLoaded
document.dispatchEvent(new window.Event('DOMContentLoaded'));

// Find the GST button and click it
const gstBtn = document.querySelector('button[onclick="switchSettingsTab(\\\'settings-pane-gst\\\', this)"]');
if (gstBtn) {
    console.log("Found GST button. Class before click:", document.getElementById('settings-pane-gst').className);
    gstBtn.click();
    console.log("Class after click:", document.getElementById('settings-pane-gst').className);
    
    // Check if there were any errors!
    if (window.errorLogs && window.errorLogs.length > 0) {
        console.log("Errors:", window.errorLogs);
    }
} else {
    console.log("GST button not found");
}

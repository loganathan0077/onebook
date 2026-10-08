import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the GST fields in the Sale Summary to wrap their contents in a grid row so JS block toggling doesn't break them.

content = content.replace(
    '<div class="gst-field" id="summary-taxable" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap; flex: 1;">Taxable Amount</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; flex: 0 0 auto;">',
    '<div class="gst-field" id="summary-taxable" style="display: none; width: 100%;">\n                                        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 15px; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap;">Taxable Amount</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap;">'
)

content = content.replace(
    '<div class="gst-field" id="summary-cgst" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap; flex: 1;">CGST</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; flex: 0 0 auto;">',
    '<div class="gst-field" id="summary-cgst" style="display: none; width: 100%;">\n                                        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 15px; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap;">CGST</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap;">'
)

content = content.replace(
    '<div class="gst-field" id="summary-sgst" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap; flex: 1;">SGST</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; flex: 0 0 auto;">',
    '<div class="gst-field" id="summary-sgst" style="display: none; width: 100%;">\n                                        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 15px; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap;">SGST</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap;">'
)

content = content.replace(
    '<div class="gst-field" id="summary-igst" style="display: none !important;">\n                                            <span style="color: #6c757d; white-space: nowrap; flex: 1;">IGST</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; flex: 0 0 auto;">',
    '<div class="gst-field" id="summary-igst" style="display: none !important; width: 100%;">\n                                        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 15px; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap;">IGST</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap;">'
)

# Fix the closing div for each of the 4 replaced blocks
# Wait, let's use regex to reliably wrap them. 

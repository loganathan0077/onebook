import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

polyfill = """    <script>
        if (window.NodeList && !NodeList.prototype.forEach) {
            NodeList.prototype.forEach = function (callback, thisArg) {
                thisArg = thisArg || window;
                for (var i = 0; i < this.length; i++) {
                    callback.call(thisArg, this[i], i, this);
                }
            };
        }
    </script>"""

# Inject before the first <script>
if "    <script>" in content:
    content = content.replace("    <script>", polyfill + "\n    <script>", 1)
    with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Polyfill injected successfully")
else:
    print("Could not find script tag")

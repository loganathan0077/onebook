def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # Step 1: Remove the premature closing tags
    old_mid = """</body>

</html>
<script>"""
    if old_mid in content:
        content = content.replace(old_mid, "")
    else:
        # try without empty line
        old_mid2 = """</body>
</html>
<script>"""
        content = content.replace(old_mid2, "")

    # Step 2: Remove the stray </script> before function
    old_script_func = """    }
</script>function loadLicenseInfo() {"""
    new_script_func = """    }
    
    function loadLicenseInfo() {"""
    content = content.replace(old_script_func, new_script_func)

    # Step 3: Add the closing tags back at the very end of the file
    # First, strip trailing whitespace
    content = content.rstrip()
    content += "\n</script>\n</body>\n</html>\n"

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/OneBook.html')


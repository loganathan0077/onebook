with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()
    
start = content.find('function showTab')
if start != -1:
    print(content[start:start+1000])

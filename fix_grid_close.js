const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const badStructure = `                        </button>
                        
                    
                </div>
            </div>

            <!-- Receivables Tab -->`;

const goodStructure = `                        </button>
                    </div> <!-- CLOSING GRID -->
                </div> <!-- CLOSING MARGIN TOP DIV -->
            </div> <!-- CLOSING PURCHASEPARTIES TAB -->

            <!-- Receivables Tab -->`;

html = html.replace(badStructure, goodStructure);
fs.writeFileSync('final.html', html, 'utf8');
console.log("Fixed missing grid div in purchaseparties.");

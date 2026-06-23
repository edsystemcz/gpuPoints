(async function() {
    // 1. Injektujeme tvé přesné brandové barvy (Success Green a Danger Red) s 20% průhledností
    const style = document.createElement('style');
    style.innerHTML = `
        .compare-best { background-color: rgba(0, 255, 163, 0.2) !important; }
        .compare-worst { background-color: rgba(255, 59, 59, 0.2) !important; }
    `;
    document.head.appendChild(style);

    // 2. URL adresa na tvůj veřejný GitHub (Raw verze souboru)
    const GITHUB_FEED_URL = "https://raw.githubusercontent.com/edsystemcz/gpuPoints/refs/heads/main/gpuPointsMapping.json";

    let gpuMapping = {};

    // Asynchronní stažení JSON databáze grafik z CDN GitHubu
    try {
        const response = await fetch(GITHUB_FEED_URL);
        if (response.ok) {
            gpuMapping = await response.json();
        } else {
            console.warn("Nepodařilo se načíst GPU databázi z GitHubu. Řádek grafických karet nebude vyhodnocen.");
        }
    } catch (error) {
        console.error("Chyba při komunikaci s GitHub feedem:", error);
    }

    // Funkce pro normalizaci textu (odstraní balast, mezery a ne-alfanumerické znaky)
    function normalizeName(name) {
        let clean = name.toLowerCase();
        clean = clean.replace(/\b(geforce|nvidia|amd|radeon|intel|graphics|mobility|edition|pro)\b/g, '');
        clean = clean.replace(/[^a-z0-9]/g, '');
        return clean.trim();
    }

    function evaluateComparisonTable() {
        const rows = Array.from(document.querySelectorAll('.commonComparsion__table-row'));
        
        let cpuBestIdx = null;
        let cpuWorstIdx = null;
        let cpuModelRow = null;

        rows.forEach(row => {
            const captionEl = row.querySelector('.commonComparsion__table-col--caption');
            if (!captionEl) return;

            const captionText = captionEl.textContent.toLowerCase().trim();
            
            // Pokud narazíme na textový řádek procesoru, pouze si ho uložíme na později
            if (captionText.includes('model procesoru')) {
                cpuModelRow = row;
                return; 
            }

            let lowerIsBetter = false;
            let higherIsBetter = false;
            let isGpuRow = captionText.includes('model grafické karty');
            let isPassmarkRow = captionText.includes('výkon cpu dle passmark');

            // Logika číselného porovnání
            if (captionText.includes('cena') || captionText.includes('tdp')) {
                lowerIsBetter = true;
            } else if (
                captionText.includes('sleva') || captionText.includes('velikost paměti') || 
                captionText.includes('kapacita') || captionText.includes('počet') || 
                captionText.includes('frekvence') || isPassmarkRow
            ) {
                higherIsBetter = true;
            }

            if (!lowerIsBetter && !higherIsBetter && !isGpuRow) return;

            // Bereme v úvahu pouze ty sloupce, které nejsou skryté tvým CSS (max 3 produkty)
            const cols = Array.from(row.querySelectorAll('.commonComparsion__table-col:not(.commonComparsion__table-col--caption)'))
                              .filter(col => window.getComputedStyle(col).display !== 'none');

            // Vyparsování hodnot pro výpočet
            const parsedData = cols.map((col, idx) => {
                let val = null;

                if (isGpuRow) {
                    const cleanShopGpu = normalizeName(col.textContent);
                    val = gpuMapping[cleanShopGpu] || null;
                } else {
                    let text = col.textContent.replace(/\s/g, '').replace(',', '.');
                    let match = text.match(/-?\d+(\.\d+)?/);
                    val = match ? parseFloat(match[0]) : null;

                    if (val !== null && captionText.includes('sleva')) {
                        val = Math.abs(val);
                    }
                }

                return { col, val, visibleIdx: idx };
            }).filter(item => item.val !== null && !isNaN(item.val));

            // --- ZDE JE TA ZMĚNA ---
            if (parsedData.length === 0) return;

            // Pokud máme na řádku jen jedno jediné číslo (ostatní jsou pomlčky), je automaticky nejlepší
            if (parsedData.length === 1) {
                const item = parsedData[0];
                item.col.classList.remove('compare-best', 'compare-worst');
                item.col.classList.add('compare-best');
                
                if (isPassmarkRow) cpuBestIdx = item.visibleIdx; // Propisujeme výhru i do názvu CPU
                return;
            }

            // Pokud je hodnot víc (2 až 3), srovnáme je klasicky jako dřív
            const values = parsedData.map(d => d.val);
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);

            if (maxVal === minVal) return;

            // Obarvení buněk v řádku s více hodnotami
            parsedData.forEach(item => {
                item.col.classList.remove('compare-best', 'compare-worst');

                if (lowerIsBetter) {
                    if (item.val === minVal) item.col.classList.add('compare-best');
                    if (item.val === maxVal) item.col.classList.add('compare-worst');
                } else { 
                    if (item.val === maxVal) {
                        item.col.classList.add('compare-best');
                        if (isPassmarkRow) cpuBestIdx = item.visibleIdx;
                    }
                    if (item.val === minVal) {
                        item.col.classList.add('compare-worst');
                        if (isPassmarkRow) cpuWorstIdx = item.visibleIdx;
                    }
                }
            });
        });

        // 3. SYNCHRONIZACE: Obarvíme textový řádek "Model procesoru" podle indexů z PassMarku
        if (cpuModelRow && (cpuBestIdx !== null || cpuWorstIdx !== null)) {
            const cpuCols = Array.from(cpuModelRow.querySelectorAll('.commonComparsion__table-col:not(.commonComparsion__table-col--caption)'))
                                 .filter(col => window.getComputedStyle(col).display !== 'none');
            
            cpuCols.forEach((col, idx) => {
                col.classList.remove('compare-best', 'compare-worst');
                if (idx === cpuBestIdx) col.classList.add('compare-best');
                if (idx === cpuWorstIdx) col.classList.add('compare-worst');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', evaluateComparisonTable);
    } else {
        evaluateComparisonTable();
    }
})();

        // States //
        let currentPage = 0;
        let totalPages = 0;
        let allAuctions = [];
        let isLoading = false;
        let marketData = {};
        let lowestBin = {};
        let averageBin = {};
        let auctionVolume = {};
        let bazaarData = {};


        // Constants //
        const AUCTION_TAX = 0.02;        // 2% tax
        const MIN_PROFIT = 100000;      // 100k coins
        const MIN_VOLUME = 15;          // min sales/day
        const API_BASE = 'https://api.hypixel.net/v2/skyblock/auctions';
        // Moulberry APIs
        const MOULBERRY_LOWEST_BIN = 'https://moulberry.codes/lowestbin.json';
        const MOULBERRY_AVERAGES = 'https://moulberry.codes/auction_averages.json';


        const rarityColors = {
            'COMMON': 'common',
            'UNCOMMON': 'uncommon',
            'RARE': 'rare',
            'EPIC': 'epic',
            'LEGENDARY': 'legendary',
            'MYTHIC': 'mythic',
            'DIVINE': 'divine',
            'SPECIAL': 'special',
            'VERY_SPECIAL': 'very_special'
        };

        async function fetchMarketData() {
            try {
                const [binRes, avgRes] = await Promise.all([
                    fetch(MOULBERRY_LOWEST_BIN),
                    fetch(MOULBERRY_AVERAGES)
                ]);

                lowestBin = await binRes.json();
                marketData = await avgRes.json();

                console.log('Market data loaded');
            } catch (e) {
                console.error('Failed to load market data', e);
            }
        }

        
            function normalizeItemId(name) {
                return name
                    .toUpperCase()
                    .replace(/✪/g, '')
                    .replace(/[^A-Z0-9 ]/g, '')
                    .trim()
                    .replace(/\s+/g, '_');
            }

            function calculateFlipProfit(auction) {
                if (!auction.bin) return { isFlip: false };

                const buyPrice = auction.starting_bid;
                const itemId = normalizeItemId(auction.item_name);

                const sellPrice = lowestBin[itemId];
                const volume = marketData[itemId]?.sales || 0;

                if (!sellPrice || volume < MIN_VOLUME) {
                    return { isFlip: false };
                }

                const tax = sellPrice * AUCTION_TAX;
                const profit = sellPrice - buyPrice - tax;
                const profitPercent = (profit / buyPrice) * 100;

                return {
                    isFlip: profit >= MIN_PROFIT && profitPercent >= 10,
                    profit,
                    profitPercent,
                    marketPrice: sellPrice,
                    volume
                };
            }

        function formatNumber(num) {
            if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }

        function formatTimeLeft(timestamp) {
            const now = Date.now();
            const diff = timestamp - now;
            if (diff <= 0) return 'ENDED';
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (days > 0) return `${days}d ${hours}h`;
            if (hours > 0) return `${hours}h ${minutes}m`;
            if (minutes > 0) return `${minutes}m`;
            return `${seconds}s`;
        }

        function getRarityFromLore(lore) {
            if (!lore) return 'COMMON';
            const lines = lore.split('\n');
            const lastLine = lines[lines.length - 1];
            
            for (const [rarity] of Object.entries(rarityColors)) {
                if (lastLine.toUpperCase().includes(rarity)) return rarity;
            }
            return 'COMMON';
        }

        function getItemTexture(itemName) {
            // FurfSky Reborn CDN or fallback to default
            const cleanName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            return `https://sky.shiiyu.moe/item/${cleanName}`;
        }


        function parseMinecraftColors(text) {
            if (!text) return '';
            
            const colorMap = {
                '§0': 'mc-dark-gray', '§1': 'mc-dark-blue', '§2': 'mc-dark-green',
                '§3': 'mc-dark-aqua', '§4': 'mc-dark-red', '§5': 'mc-dark-purple',
                '§6': 'mc-gold', '§7': 'mc-gray', '§8': 'mc-dark-gray',
                '§9': 'mc-blue', '§a': 'mc-green', '§b': 'mc-aqua',
                '§c': 'mc-red', '§d': 'mc-light-purple', '§e': 'mc-yellow',
                '§f': 'mc-white'
            };
            
            let html = '';
            let currentColor = 'mc-gray';
            let i = 0;
            
            while (i < text.length) {
                if (text[i] === '§' && i + 1 < text.length) {
                    const code = text.substr(i, 2);
                    if (colorMap[code]) {
                        if (html && !html.endsWith('<span>')) {
                            html += '</span>';
                        }
                        currentColor = colorMap[code];
                        html += `<span class="${currentColor}">`;
                    }
                    i += 2;
                } else {
                    html += text[i];
                    i++;
                }
            }
            
            if (html && !html.endsWith('</span>')) {
                html += '</span>';
            }
            
            return html || `<span class="mc-gray">${text}</span>`;
        }

        function showTooltip(event, auction) {
            const tooltip = document.getElementById('mcTooltip');
            const rarity = getRarityFromLore(auction.item_lore);
            const rarityClass = rarityColors[rarity] || 'common';
            const loreLines = auction.item_lore ? auction.item_lore.split('\n') : [];
            const flipData = calculateFlipProfit(auction);
            
            let tooltipHTML = `
                <div class="mc-tooltip-line rarity-${rarityClass} font-bold text-lg">${auction.item_name}</div>
            `;
            
            loreLines.slice(0, -1).forEach(line => {
                tooltipHTML += `<div class="mc-tooltip-line">${parseMinecraftColors(line)}</div>`;
            });
            
            if (flipData.isFlip) {
                tooltipHTML += `<div class="mc-tooltip-line mc-gold font-bold">━━━━━━━━━━━━━━━━━━━</div>`;
                tooltipHTML += `<div class="mc-tooltip-line mc-green">✓ Potential Flip!</div>`;
                tooltipHTML += `<div class="mc-tooltip-line mc-yellow">Market Price: ${formatNumber(flipData.marketPrice)}</div>`;
                tooltipHTML += `<div class="mc-tooltip-line mc-green">Profit: +${formatNumber(flipData.profit)} (${flipData.profitPercent.toFixed(1)}%)</div>`;
            }
            
            tooltipHTML += `<div class="mc-tooltip-line mc-gold font-bold">━━━━━━━━━━━━━━━━━━━</div>`;
            tooltipHTML += `<div class="mc-tooltip-line mc-gray">Click to copy auction command</div>`;
            
            if (loreLines.length > 0) {
                tooltipHTML += `<div class="mc-tooltip-line ${rarityClass}">${loreLines[loreLines.length - 1]}</div>`;
            }
            
            tooltip.innerHTML = tooltipHTML;
            tooltip.classList.add('show');
            
            positionTooltip(event, tooltip);
        }

        function positionTooltip(event, tooltip) {
            const x = event.pageX + 15;
            const y = event.pageY + 15;
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }

        function hideTooltip() {
            const tooltip = document.getElementById('mcTooltip');
            tooltip.classList.remove('show');
        }

        function copyAuctionCommand(uuid) {
            const command = `/viewauction ${uuid}`;
            navigator.clipboard.writeText(command).then(() => {
                const copyTooltip = document.getElementById('copyTooltip');
                copyTooltip.classList.add('show');
                setTimeout(() => copyTooltip.classList.remove('show'), 2000);
            });
        }

        function showError(message) {
            const errorEl = document.getElementById('errorMessage');
            errorEl.querySelector('p').textContent = message;
            errorEl.classList.remove('hidden');
            setTimeout(() => errorEl.classList.add('hidden'), 5000);
        }

        async function fetchAuctions() {
            if (isLoading) return;
            isLoading = true;

            const loadingState = document.getElementById('loadingState');
            const auctionsGrid = document.getElementById('auctionsGrid');
            const paginationControls = document.getElementById('paginationControls');
            
            loadingState.style.display = 'flex';
            auctionsGrid.style.display = 'none';
            paginationControls.style.display = 'none';

            const refreshIcon = document.getElementById('refreshIcon');
            refreshIcon.style.animation = 'spin 1s linear infinite';

            try {
                const response = await fetch(`${API_BASE}?page=${currentPage}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    allAuctions = data.auctions || [];
                    totalPages = data.totalPages || 0;
                    
                    updateStats();
                    renderAuctions();
                    
                    loadingState.style.display = 'none';
                    auctionsGrid.style.display = 'grid';
                    paginationControls.style.display = 'flex';
                } else {
                    throw new Error('API returned success: false');
                }
            } catch (error) {
                console.error('Error fetching auctions:', error);
                showError('Failed to load auctions. Please try again.');
                loadingState.style.display = 'none';
            } finally {
                isLoading = false;
                refreshIcon.style.animation = '';
            }
        }

        function updateStats() {
            const binCount = allAuctions.filter(a => a.bin).length;
            const flips = allAuctions.filter(a => calculateFlipProfit(a).isFlip).length;
            
            document.getElementById('totalAuctions').textContent = formatNumber(allAuctions.length);
            document.getElementById('currentPageDisplay').textContent = `${currentPage + 1} / ${totalPages}`;
            document.getElementById('binCount').textContent = formatNumber(binCount);
            document.getElementById('flipsFound').textContent = formatNumber(flips);
            document.getElementById('flipCount').textContent = formatNumber(flips);
            document.getElementById('pageInfo').textContent = `Page ${currentPage + 1} of ${totalPages}`;
        }

        function getFilteredAuctions() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const rarityFilter = document.getElementById('raritySelect').value;
            const typeFilter = document.getElementById('typeSelect').value;
            const sortBy = document.getElementById('sortSelect').value;
            const minProfit = parseFloat(document.getElementById('minProfitInput').value) || 0;

            const flipData = calculateFlipProfit(auction);
            if (typeFilter === 'flips' && (!flipData.isFlip || flipData.volume < MIN_VOLUME)) {
                return false;
            }


            let filtered = allAuctions.filter(auction => {
                const matchesSearch = auction.item_name.toLowerCase().includes(searchTerm);
                const rarity = getRarityFromLore(auction.item_lore);
                const matchesRarity = rarityFilter === 'all' || rarity === rarityFilter;
                const flipData = calculateFlipProfit(auction);
                
                let matchesType = typeFilter === 'all' || 
                                 (typeFilter === 'bin' && auction.bin) ||
                                 (typeFilter === 'auction' && !auction.bin) ||
                                 (typeFilter === 'flips' && flipData.isFlip);
                
                const matchesProfit = flipData.profit >= minProfit;
                
                return matchesSearch && matchesRarity && matchesType && matchesProfit;
            });

            filtered.sort((a, b) => {
                switch(sortBy) {
                    case 'flip_profit':
                        return calculateFlipProfit(b).profit - calculateFlipProfit(a).profit;
                    case 'ending_soon':
                        return a.end - b.end;
                    case 'price_low':
                        return (a.starting_bid || a.highest_bid_amount || 0) - (b.starting_bid || b.highest_bid_amount || 0);
                    case 'price_high':
                        return (b.starting_bid || b.highest_bid_amount || 0) - (a.starting_bid || a.highest_bid_amount || 0);
                    case 'bids':
                        return (b.bids?.length || 0) - (a.bids?.length || 0);
                    default:
                        return 0;
                }
            });

            return filtered;
        }

        function renderAuctions() {
            const grid = document.getElementById('auctionsGrid');
            const filtered = getFilteredAuctions();
            
            document.getElementById('filteredCount').textContent = formatNumber(filtered.length);

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-20">
                        <p class="text-gray-400 text-xl">No auctions found matching your filters</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = filtered.slice(0, 40).map(auction => {
                const rarity = getRarityFromLore(auction.item_lore);
                const rarityClass = rarityColors[rarity] || 'common';
                const price = auction.starting_bid || auction.highest_bid_amount || 0;
                const timeLeft = formatTimeLeft(auction.end);
                const flipData = calculateFlipProfit(auction);
                const textureUrl = getItemTexture(auction.item_name);
                
                return `
                    <div class="auction-card rounded-xl border-2 border-rarity-${rarityClass} overflow-hidden relative"
                         onmouseenter="showTooltip(event, ${escapeHtml(JSON.stringify(auction))})"
                         onmousemove="positionTooltip(event, document.getElementById('mcTooltip'))"
                         onmouseleave="hideTooltip()"
                         onclick="copyAuctionCommand('${auction.uuid}')">
                        
                        ${flipData.isFlip ? `
                            <div class="flip-badge w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                                <div class="text-center">
                                    <div class="text-xs font-bold">FLIP</div>
                                    <div class="text-xs">+${flipData.profitPercent.toFixed(0)}%</div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="p-5">
                            <div class="flex items-center space-x-4 mb-4">
                                <div class="flex-shrink-0">
                                    <img src="${textureUrl}" alt="${auction.item_name}" 
                                         class="item-image"
                                         onerror="this.src='https://via.placeholder.com/80?text=Item'" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h3 class="font-bold text-base mb-1 minecraft-font rarity-${rarityClass} truncate">
                                        ${auction.item_name}
                                    </h3>
                                    <div class="text-xs text-gray-400">
                                        by ${auction.auctioneer.substring(0, 12)}...
                                    </div>
                                    ${auction.bin ? '<span class="inline-block bg-yellow-600 text-xs px-2 py-1 rounded-full font-bold mt-1">BIN</span>' : ''}
                                </div>
                            </div>

                            ${flipData.isFlip ? `
                                <div class="bg-gradient-to-r from-orange-900 to-red-900 bg-opacity-30 rounded-lg p-3 mb-3 border border-orange-500">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-xs text-orange-300 font-semibold">💰 Flip Profit</span>
                                        <span class="text-sm font-bold text-green-400">+${formatNumber(flipData.profit)}</span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-400">Market Price</span>
                                        <span class="text-xs text-gray-300">${formatNumber(flipData.marketPrice)}</span>
                                    </div>
                                </div>
                            ` : ''}

                            <div class="space-y-2 mb-4">
                                <div class="flex items-center justify-between bg-slate-900 bg-opacity-50 rounded-lg p-3">
                                    <div class="flex items-center space-x-2 text-gray-400">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <span class="text-sm font-medium">Price</span>
                                    </div>
                                    <span class="font-bold text-yellow-400">${formatNumber(price)}</span>
                                </div>

                                <div class="flex items-center justify-between bg-slate-900 bg-opacity-50 rounded-lg p-3">
                                    <div class="flex items-center space-x-2 text-gray-400">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <span class="text-sm font-medium">Ends</span>
                                    </div>
                                    <span class="font-bold ${timeLeft === 'ENDED' ? 'text-red-400' : 'text-green-400'}">${timeLeft}</span>
                                </div>

                                ${auction.bids && auction.bids.length > 0 ? `
                                    <div class="flex items-center justify-between bg-slate-900 bg-opacity-50 rounded-lg p-3">
                                        <span class="text-sm text-gray-400 font-medium">Bids</span>
                                        <span class="font-bold text-blue-400">${auction.bids.length}</span>
                                    </div>
                                ` : ''}
                            </div>

                            <button class="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-2.5 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg text-sm">
                                📋 Copy Command
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            updatePaginationButtons();
        }

        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

        function updatePaginationButtons() {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            
            prevBtn.disabled = currentPage === 0;
            nextBtn.disabled = currentPage >= totalPages - 1;
        }

        document.getElementById('refreshBtn').addEventListener('click', fetchAuctions);
        
        document.getElementById('prevBtn').addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                fetchAuctions();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                currentPage++;
                fetchAuctions();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        document.getElementById('filterToggle').addEventListener('click', () => {
            const panel = document.getElementById('filterPanel');
            panel.classList.toggle('hidden');
        });

        document.getElementById('searchInput').addEventListener('input', renderAuctions);
        document.getElementById('sortSelect').addEventListener('change', renderAuctions);
        document.getElementById('raritySelect').addEventListener('change', renderAuctions);
        document.getElementById('typeSelect').addEventListener('change', renderAuctions);
        document.getElementById('minProfitInput').addEventListener('input', renderAuctions);

        document.addEventListener('mousemove', (e) => {
            const copyTooltip = document.getElementById('copyTooltip');
            if (copyTooltip.classList.contains('show')) {
                copyTooltip.style.left = e.pageX + 15 + 'px';
                copyTooltip.style.top = e.pageY + 15 + 'px';
            }
        });

        setInterval(() => {
            if (!isLoading && document.getElementById('auctionsGrid').style.display !== 'none') {
                const filtered = getFilteredAuctions();
                document.querySelectorAll('.auction-card').forEach((card, index) => {
                    if (filtered[index]) {
                        const timeElement = card.querySelector('[class*="text-green-400"], [class*="text-red-400"]');
                        if (timeElement) {
                            const newTime = formatTimeLeft(filtered[index].end);
                            timeElement.textContent = newTime;
                            timeElement.className = `font-bold ${newTime === 'ENDED' ? 'text-red-400' : 'text-green-400'}`;
                        }
                    }
                });
            }
        }, 1000);

        (async () => {
            await fetchMarketData();
            fetchAuctions();
        })();

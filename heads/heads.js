// Head Shop JavaScript

// --- Global State ---
let headData = [];
let filteredData = [];
let cart = [];
let selectedSearchField = 'all';
let sortByCategory = true;
let categoriesExpanded = {};

const skinUrlCache = new Map();
let skinview3dReady = null;
let modalViewer = null;

// Category mappings
const categoryColors = {
    'food': 'category-food', 'lasers/arrows': 'category-lasers-arrows', 'lasers': 'category-lasers-arrows',
    'arrows': 'category-lasers-arrows', 'decoration': 'category-decoration', 'nature': 'category-nature',
    'blocks': 'category-blocks', 'misc': 'category-misc', 'animal': 'category-animal', 'emoji': 'category-emoji',
    'plants': 'category-plants', 'indoor': 'category-indoor', 'letters': 'category-letters',
    'halloween': 'category-halloween', 'christmas': 'category-christmas', 'fish': 'category-fish',
    'mob': 'category-mob', 'nation': 'category-nation', 'player': 'category-player'
};

const categoryPriority = { 'player': 1, 'nation': 2, 'decoration': 4, 'indoor': 5, 'halloween': 20 };

const getCategoryPriority = cat => categoryPriority[cat?.toLowerCase().trim()] ?? 10;
const getCategoryColorClass = cat => categoryColors[cat?.toLowerCase().trim()] || 'category-default';
const getFloorName = y => y >= 62 && y <= 64 ? 'Top Floor' : y >= 65 && y <= 67 ? 'Middle Floor' : y >= 68 && y <= 70 ? 'Bottom Floor' : y >= 71 && y <= 73 ? 'Top Floor' : y < 62 ? 'Basement' : `Y${y}`;

// --- Script Loading ---
const scriptCache = {};
function loadExternalScript(src) {
    if (!scriptCache[src]) {
        scriptCache[src] = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing?.dataset.loaded === 'true') { resolve(); return; }
            if (existing) { existing.addEventListener('load', resolve); existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`))); return; }
            const script = Object.assign(document.createElement('script'), { src, async: true });
            script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
            script.onerror = () => { script.remove(); delete scriptCache[src]; reject(new Error(`Failed to load ${src}`)); };
            document.head.appendChild(script);
        });
    }
    return scriptCache[src];
}

const ensureHeadview = () => skinview3dReady || (skinview3dReady = loadExternalScript('https://cdn.jsdelivr.net/npm/headview3d@3.0.2/bundles/skinview3d.bundle.js'));
const refreshIcons = () => window.feather?.replace();

// --- Data Loading ---
async function loadHeadData() {
    try {
        const response = await fetch('../data/head_shop_data.csv');
        const parsed = Papa.parse(await response.text(), { header: true, skipEmptyLines: true });
        headData = parsed.data;
        [...new Set(headData.map(h => h.Category || 'Uncategorized'))].forEach(cat => categoriesExpanded[cat] = true);
        updateHeadsStats();
        filterAndRender();
    } catch (err) {
        console.error('Error loading head data:', err);
        document.getElementById('heads-container').innerHTML = '<div class="text-center py-12 text-red-500">Failed to load head shop data.</div>';
    }
}

// --- Filtering & URL State ---
function filterAndRender() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    updateUrlState();
    
    filteredData = headData.filter(head => {
        if (!searchTerm) return true;
        const name = (head.Name || '').toLowerCase();
        const category = (head.Category || '').toLowerCase();
        const tags = (head.Tags || '').toLowerCase();
        
        return selectedSearchField === 'name' ? name.includes(searchTerm) :
               selectedSearchField === 'category' ? category.includes(searchTerm) :
               selectedSearchField === 'tags' ? tags.includes(searchTerm) :
               name.includes(searchTerm) || category.includes(searchTerm) || tags.includes(searchTerm);
    });
    renderHeads();
}

function updateUrlState() {
    const params = new URLSearchParams();
    const searchTerm = document.getElementById('search-input')?.value.trim() || '';
    if (searchTerm) params.set('q', searchTerm);
    if (selectedSearchField !== 'all') params.set('field', selectedSearchField);
    if (!sortByCategory) params.set('view', 'flat');
    window.history.replaceState({}, '', params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname);
}

function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) document.getElementById('search-input').value = query;
    
    const field = params.get('field');
    if (['all', 'name', 'category', 'tags'].includes(field)) {
        selectedSearchField = field;
        document.getElementById('selected-field').textContent = { all: 'All', name: 'Name', category: 'Category', tags: 'Tags' }[field];
    }
    
    if (params.get('view') === 'flat') {
        sortByCategory = false;
        document.getElementById('sort-by-category-toggle')?.classList.remove('active');
    }
}

// --- Rendering ---
let lastViewMode = null;

function updateHeadsStats() {
    const statsEl = document.getElementById('heads-stats');
    if (!statsEl) return;
    const total = headData.length;
    const outOfStock = headData.filter(h => h.Exchanges_Available === 'F').length;
    const available = total - outOfStock;
    statsEl.innerHTML = total === 0 ? 'No heads loaded' : 
        outOfStock > 0 ? `<span class="text-white font-semibold">${available}</span> heads available <span class="text-gray-500">(${outOfStock} out of stock)</span>` :
        `<span class="text-white font-semibold">${available}</span> heads available`;
}

function renderHeads() {
    const container = document.getElementById('heads-container');
    const filterKey = JSON.stringify(filteredData.map(h => h.Name + h.Texture));
    
    if (container.dataset.lastFilterKey !== filterKey || lastViewMode !== sortByCategory) {
        container.innerHTML = '';
        if (filteredData.length === 0) {
            container.innerHTML = '<div class="text-center py-12 text-gray-500">No heads found matching your search.</div>';
            return;
        }
        sortByCategory ? renderWithCategories(container) : renderFlat(container);
        container.dataset.lastFilterKey = filterKey;
        lastViewMode = sortByCategory;
        refreshIcons();
    }
}

function renderFlat(container) {
    const grid = document.createElement('div');
    grid.className = 'flat-grid';
    grid.innerHTML = filteredData.map((head, idx) => renderHeadCard(head, `head-${idx}`)).join('');
    container.appendChild(grid);
}

function renderWithCategories(container) {
    const grouped = {};
    filteredData.forEach(head => {
        const cat = head.Category || 'Uncategorized';
        (grouped[cat] = grouped[cat] || []).push(head);
    });
    
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const diff = getCategoryPriority(a) - getCategoryPriority(b);
        return diff !== 0 ? diff : a.localeCompare(b);
    });
    
    let flatIndex = 0;
    sortedCategories.forEach(category => {
        const isExpanded = categoriesExpanded[category] !== false;
        const cardsHtml = grouped[category].map(head => renderHeadCard(head, `head-${flatIndex++}`)).join('');
        
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-section';
        categoryDiv.innerHTML = `
            <div class="category-header flex items-center gap-2 p-2 bg-gray-800 rounded-lg mb-2" data-category="${category}">
                <i data-feather="chevron-down" class="w-4 h-4 text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'} hidden sm:block"></i>
                <div class="category-tag"><span class="category-dot ${getCategoryColorClass(category)}"></span><span class="text-xs text-white">${category}</span></div>
                <span class="text-gray-500 text-xs">(${grouped[category].length})</span>
                <i data-feather="chevrons-right" class="w-4 h-4 text-gray-500 ml-auto sm:hidden scroll-hint-icon"></i>
            </div>
            <div class="category-content ${isExpanded ? 'expanded' : 'collapsed'}" data-category-content="${category}">
                <div class="head-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">${cardsHtml}</div>
                <div class="category-scroll-container"><div class="category-scroll-wrapper">${cardsHtml}</div><div class="scroll-indicator" data-scroll-indicator="${category}"><i data-feather="chevron-right" class="w-5 h-5"></i></div></div>
            </div>`;
        container.appendChild(categoryDiv);
    });
    
    // Category toggle listeners (desktop)
    container.querySelectorAll('.category-header').forEach(header => {
        header.addEventListener('click', () => {
            if (window.innerWidth >= 640) {
                const category = header.dataset.category;
                categoriesExpanded[category] = !categoriesExpanded[category];
                const content = container.querySelector(`[data-category-content="${category}"]`);
                const chevron = header.querySelector('[data-feather="chevron-down"], svg');
                content.classList.toggle('collapsed', !categoriesExpanded[category]);
                content.classList.toggle('expanded', categoriesExpanded[category]);
                if (chevron) chevron.style.transform = categoriesExpanded[category] ? 'rotate(0deg)' : 'rotate(-90deg)';
            }
        });
    });
    
    // Scroll indicator listeners
    container.querySelectorAll('.category-scroll-wrapper').forEach(wrapper => {
        const updateIndicator = () => {
            const indicator = wrapper.parentElement.querySelector('.scroll-indicator');
            if (indicator) indicator.classList.toggle('hidden', wrapper.scrollLeft + wrapper.clientWidth >= wrapper.scrollWidth - 10);
        };
        wrapper.addEventListener('scroll', updateIndicator);
        setTimeout(updateIndicator, 100);
    });
    
    // Scroll indicator click to scroll
    container.querySelectorAll('.scroll-indicator').forEach(indicator => {
        indicator.addEventListener('click', () => {
            const wrapper = indicator.parentElement.querySelector('.category-scroll-wrapper');
            if (wrapper) wrapper.scrollBy({ left: 150, behavior: 'smooth' });
        });
    });
}

function renderHeadCard(head, uniqueId) {
    const isOutOfStock = head.Exchanges_Available === 'F';
    const name = head.Name || 'Unknown';
    const category = head.Category || 'Uncategorized';
    const coords = head.Coordinates || '';
    
    const coordMatch = coords.match(/(-?\d+),\s*(-?\d+),\s*(-?\d+)/);
    const coordsDisplay = coordMatch ? `${coordMatch[1]}, ${coordMatch[3]} (${getFloorName(parseInt(coordMatch[2], 10))})` : coords;
    
    const textureId = getTextureId(head.Texture);
    const headImageUrl = textureId ? `https://vzge.me/head/512/${textureId}.png` : 'https://vzge.me/head/512/steve.png';
    const headDataJson = JSON.stringify({ name, coords: coordsDisplay, texture: head.Texture, input: head.Input || '', uniqueId }).replace(/"/g, '&quot;');
    
    return `
        <div class="head-card bg-gray-900 border border-gray-800 rounded-lg flex flex-col ${isOutOfStock ? 'out-of-stock' : ''}" data-head-id="${uniqueId}">
            <div class="mb-1"><div class="category-tag"><span class="category-dot ${getCategoryColorClass(category)}"></span><span class="text-gray-300">${category}</span></div></div>
            <div class="head-image-area">
                <div class="head-image-container" style="cursor:pointer" data-texture="${head.Texture || ''}" data-name="${name}">
                    <img src="${headImageUrl}" alt="${name}" loading="lazy" onerror="this.src='https://vzge.me/head/512/steve.png'">
                </div>
                <button class="enlarge-btn" data-texture="${head.Texture || ''}" data-name="${name}" title="View 3D Preview"><i data-feather="rotate-cw"></i><span>Live Preview</span></button>
            </div>
            <div class="flex-1 mt-1">
                <div class="flex items-end justify-between gap-2 h-full">
                    <div class="flex-1 space-y-0.5 min-w-0">
                        <h3 class="font-semibold text-white text-xs leading-tight line-clamp-2 min-h-[2rem] mb-1">${name}</h3>
                        <p class="text-[0.65rem] text-gray-300 truncate">${head.Input || ''}</p>
                        <span class="coord-link text-[0.65rem] text-gray-400">${coordsDisplay}</span>
                    </div>
                    <button class="add-to-cart-btn flex-shrink-0 p-1.5 bg-gray-800 hover:bg-nara-red text-gray-400 hover:text-white rounded transition-colors flex items-center gap-0.5" data-head="${headDataJson}" title="Add to Cart">
                        <i data-feather="plus" class="w-2 h-2"></i><i data-feather="shopping-cart" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
        </div>`;
}

function getTextureId(texture) {
    if (!texture) return null;
    try {
        const json = JSON.parse(atob(texture));
        const url = json.textures?.SKIN?.url;
        if (url) { const match = url.match(/\/texture\/([a-f0-9]+)/i); if (match) return match[1]; }
    } catch (e) { if (/^[a-f0-9]+$/i.test(texture)) return texture; }
    return null;
}

function getSkinUrlFromTexture(texture) {
    if (!texture) return null;
    if (skinUrlCache.has(texture)) return skinUrlCache.get(texture);
    try {
        const url = JSON.parse(atob(texture)).textures?.SKIN?.url;
        if (url) skinUrlCache.set(texture, url);
        return url;
    } catch { return null; }
}

// --- Cart Functions ---
function parseInput(input) {
    const result = { diamonds: 0, iron: 0 };
    if (!input) return result;
    const diamondMatch = input.match(/(\d+)\s*Diamond/i);
    const ironMatch = input.match(/(\d+)\s*Iron/i);
    if (diamondMatch) result.diamonds = parseInt(diamondMatch[1], 10);
    if (ironMatch) result.iron = parseInt(ironMatch[1], 10);
    return result;
}

function calculateCartTotal() {
    return cart.reduce((acc, item) => {
        const costs = parseInput(item.input);
        return { diamonds: acc.diamonds + costs.diamonds * item.quantity, iron: acc.iron + costs.iron * item.quantity };
    }, { diamonds: 0, iron: 0 });
}

function getHeadImageUrl(texture) {
    const textureId = getTextureId(texture);
    return textureId ? `https://vzge.me/head/64/${textureId}.png?no=shadow` : 'https://vzge.me/head/64/steve.png?no=shadow';
}

function updateCartDisplay() {
    const cartCount = document.getElementById('cart-count');
    const cartItems = document.getElementById('cart-items');
    const cartMobileContent = document.getElementById('cart-mobile-content');
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totals = calculateCartTotal();
    
    cartCount.textContent = totalQty;
    
    // Mobile cart
    if (cartMobileContent) {
        if (cart.length === 0) {
            cartMobileContent.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Your cart is empty</p>';
        } else {
            const maxHeads = 8;
            let headsHtml = cart.slice(0, maxHeads).map(item => `
                <div class="cart-mobile-head" title="${item.name} (x${item.quantity})">
                    <img src="${getHeadImageUrl(item.texture)}" alt="${item.name}" onerror="this.src='https://vzge.me/head/64/steve.png?no=shadow'">
                    ${item.quantity > 1 ? `<span class="qty-badge">${item.quantity}</span>` : ''}
                </div>`).join('');
            if (cart.length > maxHeads) headsHtml += `<div class="cart-mobile-more">+${cart.length - maxHeads}</div>`;
            
            let totalHtml = '<span class="cart-mobile-total-label">Total:</span>';
            if (totals.diamonds > 0) totalHtml += `<span class="cart-mobile-total-item"><img src="https://minecraft.wiki/images/Invicon_Diamond.png" alt="D"><span class="text-cyan-400">${totals.diamonds}</span></span>`;
            if (totals.iron > 0) totalHtml += `<span class="cart-mobile-total-item"><img src="https://minecraft.wiki/images/Invicon_Iron_Ingot.png" alt="I"><span class="text-gray-300">${totals.iron}</span></span>`;
            if (!totals.diamonds && !totals.iron) totalHtml += '<span class="text-gray-500" style="font-size:0.65rem">N/A</span>';
            
            cartMobileContent.innerHTML = `
                <div class="cart-mobile-body"><div class="cart-mobile-heads">${headsHtml}</div><div class="cart-mobile-total">${totalHtml}</div></div>
                <button id="empty-cart-mobile" class="cart-mobile-empty-btn"><i data-feather="trash-2" class="w-3 h-3"></i>Empty Cart</button>`;
            document.getElementById('empty-cart-mobile')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); cart = []; updateCartDisplay(); });
            refreshIcons();
        }
    }
    
    // Desktop cart
    const cartFooter = document.getElementById('cart-footer');
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">Your cart is empty</p>';
        if (cartFooter) cartFooter.classList.add('hidden');
    } else {
        const itemsHtml = cart.map((item, i) => `
            <div class="cart-item flex items-center gap-2 p-2 bg-gray-800 rounded-lg" data-cart-index="${i}">
                <div class="qty-controls flex-shrink-0">
                    <button class="qty-btn minus" data-index="${i}" data-action="decrease">−</button>
                    <span class="qty-num">${item.quantity}</span>
                    <button class="qty-btn plus" data-index="${i}" data-action="increase">+</button>
                </div>
                <img src="${getHeadImageUrl(item.texture)}" alt="${item.name}" class="w-7 h-7 rounded flex-shrink-0" onerror="this.src='https://vzge.me/head/64/steve.png?no=shadow'">
                <div class="flex-1 min-w-0"><p class="text-xs text-white font-medium truncate">${item.name}</p><p class="text-[0.65rem] text-gray-400 truncate">${item.coords}</p></div>
            </div>`).join('');
        
        let totalHtml = '';
        if (totals.diamonds > 0) totalHtml += `<div class="cart-total-item"><img src="https://minecraft.wiki/images/Invicon_Diamond.png" alt="Diamond"><span class="text-cyan-400">${totals.diamonds}</span></div>`;
        if (totals.iron > 0) totalHtml += `<div class="cart-total-item"><img src="https://minecraft.wiki/images/Invicon_Iron_Ingot.png" alt="Iron"><span class="text-gray-300">${totals.iron}</span></div>`;
        if (!totalHtml) totalHtml = '<span class="text-gray-500 text-xs">No cost data</span>';
        
        cartItems.innerHTML = itemsHtml;
        
        if (cartFooter) {
            cartFooter.classList.remove('hidden');
            cartFooter.innerHTML = `
                <div class="cart-footer-row"><div class="cart-total"><span class="text-gray-400 text-xs">Total:</span>${totalHtml}</div>
                <button class="empty-cart-btn" id="empty-cart-btn"><i data-feather="trash-2" class="w-3 h-3"></i><span>Clear</span></button></div>
                <p class="text-center text-gray-500 text-[0.6rem]">Online Ordering Soon™</p>`;
        }
        refreshIcons();
    }
}

function addToCart(headData) {
    const wasEmpty = cart.length === 0;
    const existingIndex = cart.findIndex(item => item.texture === headData.texture);
    
    if (existingIndex >= 0) cart[existingIndex].quantity++;
    else cart.push({ ...headData, quantity: 1 });
    
    updateCartDisplay();
    
    if (wasEmpty) {
        const cartDropdown = document.getElementById('cart-dropdown-content');
        const isMobile = window.innerWidth <= 768;
        if (cartDropdown && !cartDropdown.classList.contains('open')) {
            if (isMobile && cartDropdown.parentElement !== document.body) document.body.appendChild(cartDropdown);
            cartDropdown.classList.add('open');
            document.getElementById('cart-overlay').classList.add('open');
            document.getElementById('cart-chevron').style.transform = 'rotate(180deg)';
            if (isMobile) document.body.style.overflow = 'hidden';
            refreshIcons();
        }
    }
}

function updateCartQuantity(index, delta) {
    if (index >= 0 && index < cart.length) {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
        updateCartDisplay();
    }
}

function toggleCartDropdown() {
    const cartDropdown = document.getElementById('cart-dropdown-content');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartChevron = document.getElementById('cart-chevron');
    const isMobile = window.innerWidth <= 768;
    
    if (cartDropdown.classList.contains('open')) {
        cartDropdown.classList.remove('open');
        cartOverlay.classList.remove('open');
        cartChevron.style.transform = 'rotate(0deg)';
        document.body.style.overflow = '';
        if (isMobile) {
            const originalParent = document.querySelector('.cart-dropdown');
            if (originalParent && cartDropdown.parentElement === document.body) originalParent.appendChild(cartDropdown);
        }
    } else {
        if (isMobile && cartDropdown.parentElement !== document.body) document.body.appendChild(cartDropdown);
        cartDropdown.classList.add('open');
        cartOverlay.classList.add('open');
        cartChevron.style.transform = 'rotate(180deg)';
        if (isMobile) document.body.style.overflow = 'hidden';
        refreshIcons();
    }
}

function closeCart() {
    const cartDropdown = document.getElementById('cart-dropdown-content');
    const isMobile = window.innerWidth <= 768;
    cartDropdown.classList.remove('open');
    document.getElementById('cart-overlay').classList.remove('open');
    document.getElementById('cart-chevron').style.transform = 'rotate(0deg)';
    document.body.style.overflow = '';
    if (isMobile) {
        const originalParent = document.querySelector('.cart-dropdown');
        if (originalParent && cartDropdown.parentElement === document.body) originalParent.appendChild(cartDropdown);
    }
}

// --- Modal Functions ---
async function openHeadModal(texture, name) {
    const modal = document.getElementById('head-modal');
    const canvas = document.getElementById('modal-head-canvas');
    document.getElementById('modal-head-name').textContent = name || 'Head';
    modal.classList.add('open');
    
    if (modalViewer) { modalViewer.dispose(); modalViewer = null; }
    
    try { await ensureHeadview(); } catch { console.error('Failed to load skinview3d'); return; }
    if (!window.skinview3d) return;
    
    try {
        modalViewer = new skinview3d.SkinViewer({ canvas, width: 250, height: 250 });
        const skinUrl = getSkinUrlFromTexture(texture);
        if (skinUrl) modalViewer.loadSkin(skinUrl).catch(console.warn);
        
        Object.assign(modalViewer, { zoom: 1, animation: null, autoRotate: true, autoRotateSpeed: 0.75 });
        Object.assign(modalViewer.controls, { enableZoom: true, enableRotate: true, enablePan: false });
        modalViewer.camera.position.set(0, 10, 25);
        modalViewer.camera.lookAt(0, 26, 0);
        
        ['mousedown', 'touchstart'].forEach(e => canvas.addEventListener(e, () => modalViewer && (modalViewer.autoRotate = false)));
    } catch (e) { console.error('Failed to create modal viewer:', e); }
    refreshIcons();
}

function closeHeadModal() {
    document.getElementById('head-modal').classList.remove('open');
    if (modalViewer) { modalViewer.dispose(); modalViewer = null; }
}

// --- Event Listeners ---
let searchDebounceTimer = null;

function setupEventListeners() {
    // Search input
    document.getElementById('search-input').addEventListener('input', () => {
        const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
        filteredData = headData.filter(head => {
            if (!searchTerm) return true;
            const name = (head.Name || '').toLowerCase();
            const category = (head.Category || '').toLowerCase();
            const tags = (head.Tags || '').toLowerCase();
            return selectedSearchField === 'name' ? name.includes(searchTerm) :
                   selectedSearchField === 'category' ? category.includes(searchTerm) :
                   selectedSearchField === 'tags' ? tags.includes(searchTerm) :
                   name.includes(searchTerm) || category.includes(searchTerm) || tags.includes(searchTerm);
        });
        renderHeads();
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(updateUrlState, 500);
    });
    
    // Field selector
    document.querySelectorAll('.field-option').forEach(option => {
        option.addEventListener('click', () => {
            selectedSearchField = option.dataset.value;
            document.getElementById('selected-field').textContent = option.textContent;
            document.getElementById('field-selector-dropdown').removeAttribute('open');
            filterAndRender();
        });
    });
    
    // Field dropdown chevron
    const fieldDropdown = document.getElementById('field-selector-dropdown');
    fieldDropdown.addEventListener('toggle', () => {
        document.getElementById('field-selector-chevron').style.transform = fieldDropdown.open ? 'rotate(180deg)' : 'rotate(0deg)';
    });
    
    // Sort toggle
    document.getElementById('sort-by-category-toggle').addEventListener('click', () => {
        const toggle = document.getElementById('sort-by-category-toggle');
        sortByCategory = !sortByCategory;
        toggle.classList.toggle('active', sortByCategory);
        updateUrlState();
        renderHeads();
    });
    
    // Heads container (delegated events)
    document.getElementById('heads-container').addEventListener('click', e => {
        const addBtn = e.target.closest('.add-to-cart-btn');
        if (addBtn) {
            e.preventDefault(); e.stopPropagation();
            try { addToCart(JSON.parse(addBtn.dataset.head.replace(/&quot;/g, '"'))); } catch (err) { console.error('Failed to parse head data:', err); }
            return;
        }
        
        const enlargeBtn = e.target.closest('.enlarge-btn');
        if (enlargeBtn) { e.preventDefault(); e.stopPropagation(); openHeadModal(enlargeBtn.dataset.texture, enlargeBtn.dataset.name); return; }
        
        const headImage = e.target.closest('.head-image-container');
        if (headImage?.dataset.texture) { e.preventDefault(); e.stopPropagation(); openHeadModal(headImage.dataset.texture, headImage.dataset.name); }
    });
    
    // Cart quantity controls
    document.getElementById('cart-items').addEventListener('click', e => {
        const qtyBtn = e.target.closest('.qty-btn');
        if (qtyBtn) {
            e.preventDefault(); e.stopPropagation();
            updateCartQuantity(parseInt(qtyBtn.dataset.index, 10), qtyBtn.dataset.action === 'increase' ? 1 : -1);
        }
    });
    
    // Cart footer (empty button)
    document.getElementById('cart-footer').addEventListener('click', e => {
        if (e.target.closest('#empty-cart-btn')) { e.preventDefault(); e.stopPropagation(); cart = []; updateCartDisplay(); }
    });
    
    // Cart controls
    document.getElementById('cart-toggle').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleCartDropdown(); });
    document.getElementById('cart-close').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeCart(); });
    document.getElementById('cart-close-mobile').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeCart(); });
    document.getElementById('cart-overlay').addEventListener('click', e => { e.preventDefault(); closeCart(); });
    
    // Close cart on outside click
    document.addEventListener('click', e => {
        const cartDropdown = document.getElementById('cart-dropdown-content');
        const cartToggle = document.getElementById('cart-toggle');
        if (cartDropdown?.classList.contains('open') && !cartDropdown.contains(e.target) && !cartToggle.contains(e.target)) closeCart();
    });
    
    // Modal controls
    document.getElementById('modal-close').addEventListener('click', e => { e.preventDefault(); closeHeadModal(); });
    document.getElementById('head-modal').addEventListener('click', e => { if (e.target.id === 'head-modal') closeHeadModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('head-modal').classList.contains('open')) closeHeadModal(); });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    refreshIcons();
    setupEventListeners();
    readUrlState();
    loadHeadData();
});

window.addEventListener('popstate', () => { readUrlState(); filterAndRender(); });

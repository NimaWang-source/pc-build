const CATEGORY_DEFINITIONS = [
  { id: 'cpu', label: 'Processor (CPU)' },
  { id: 'motherboard', label: 'Motherboard' },
  { id: 'gpu', label: 'Graphics (GPU)' },
  { id: 'memory', label: 'Memory (RAM)' },
  { id: 'storage', label: 'Storage (SSD • multi-select)' },
  { id: 'psu', label: 'Power Supply (PSU)' },
  { id: 'cooler', label: 'Cooling' },
  { id: 'case', label: 'Chassis (Case)' },
];

const multiSelectCategories = new Set(['storage']);
const HIDDEN_TAGS = new Set(['budget', 'baseline', 'blender-entry', 'entry-gs']);

let db = null;
let selectedParts = {};
let filters = {
  search: '',
  workload: 'all',
  assemblyOnly: false,
  lowVolatility: false,
  premium: false,
};

const formatTwd = (amount) => new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  minimumFractionDigits: 0,
}).format(amount);

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function mergeDatasets(base, extension) {
  if (!extension) return base;

  return {
    ...base,
    metadata: {
      ...base.metadata,
      premiumCatalogLoaded: true,
    },
    sources: [...(base.sources || []), ...(extension.sources || [])],
    compatibilityRules: [...(base.compatibilityRules || []), ...(extension.compatibilityRules || [])],
    parts: [...(base.parts || []), ...(extension.parts || [])],
    referenceBuilds: [...(base.referenceBuilds || []), ...(extension.referenceBuilds || [])],
  };
}

function getSelectedIds(categoryId) {
  const value = selectedParts[categoryId];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isHiddenPart(part) {
  return (part.tags || []).some((tag) => HIDDEN_TAGS.has(tag));
}

function getSelectedCount(categoryId, partId) {
  return getSelectedIds(categoryId).filter((id) => id === partId).length;
}

function getSelectedPartsForCategory(categoryId) {
  return getSelectedIds(categoryId)
    .map((id) => db.parts.find((part) => part.id === id))
    .filter(Boolean);
}

function getBuildEstimate(build) {
  const resolvedParts = (build.selectedPartIds || [])
    .map((id) => db.parts.find((part) => part.id === id))
    .filter(Boolean);

  if (resolvedParts.length === 0) {
    return build.estimatedTotalTwd || {min: 0, max: 0};
  }

  const min = resolvedParts.reduce((sum, part) => sum + (part.price?.minTwd || 0), 0);
  const max = resolvedParts.reduce((sum, part) => sum + (part.price?.maxTwd || 0), 0);
  return {min, max};
}

function shouldShowBuild(build) {
  const resolvedParts = (build.selectedPartIds || [])
    .map((id) => db.parts.find((part) => part.id === id))
    .filter(Boolean);

  if (resolvedParts.length === 0) {
    return false;
  }

  return resolvedParts.every((part) => !isHiddenPart(part));
}

function getPrimarySelectedPart(categoryId) {
  return getSelectedPartsForCategory(categoryId)[0] || null;
}

function getPartHighlights(part) {
  switch (part.category) {
    case 'cpu':
      return [part.compatibility?.socket, part.specs?.cores ? `${part.specs.cores} cores` : part.specs?.performanceClass].filter(Boolean).join(' • ');
    case 'motherboard':
      return [part.compatibility?.socket, part.compatibility?.formFactor, part.specs?.platformTier].filter(Boolean).join(' • ');
    case 'gpu':
      return [part.specs?.vramGb ? `${part.specs.vramGb}GB VRAM` : null, part.specs?.gaussianSplattingTier, part.compatibility?.psuMinW ? `${part.compatibility.psuMinW}W PSU` : null].filter(Boolean).join(' • ');
    case 'memory':
      return [part.specs?.capacityGb ? `${part.specs.capacityGb}GB` : null, part.compatibility?.memoryType, part.specs?.speed].filter(Boolean).join(' • ');
    case 'storage':
      return [part.specs?.capacityTb ? `${part.specs.capacityTb}TB` : null, part.specs?.generation, part.compatibility?.interface].filter(Boolean).join(' • ');
    case 'psu':
      return [part.compatibility?.wattage ? `${part.compatibility.wattage}W` : null, part.compatibility?.efficiency].filter(Boolean).join(' • ');
    case 'cooler':
      return [part.specs?.coolingClass, part.compatibility?.requiresCaseRadiatorSupport].filter(Boolean).join(' • ');
    case 'case':
      return [part.compatibility?.supportsMotherboard?.join('/'), part.compatibility?.radiatorSupport?.join('/')].filter(Boolean).join(' • ');
    default:
      return '';
  }
}

function getPartArtLabel(part) {
  switch (part.category) {
    case 'cpu':
      return 'CPU';
    case 'motherboard':
      return 'Board';
    case 'gpu':
      return 'GPU';
    case 'memory':
      return 'RAM';
    case 'storage':
      return 'SSD';
    case 'psu':
      return 'PSU';
    case 'cooler':
      return 'Cooler';
    case 'case':
      return 'Case';
    default:
      return 'Part';
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPartArtDataUri(part) {
  const label = escapeXml(getPartArtLabel(part));
  const model = escapeXml(part.model);
  const brand = escapeXml(part.brand);
  const accent = '#0071e3';
  const secondary = 'rgba(255,255,255,0.32)';
  const fanCount = Math.max(1, Math.min(3, Math.round((part.specs?.vramGb || part.specs?.cores || 6) / 8)));
  const memoryModules = Math.max(1, Math.min(4, part.specs?.modules || Math.round((part.specs?.capacityGb || 32) / 32) || 2));
  let artwork = '';

  switch (part.category) {
    case 'cpu':
      artwork = `<rect x="88" y="38" width="144" height="92" rx="16" fill="#2b2b30" stroke="${accent}" stroke-width="4"/>
        <rect x="116" y="62" width="88" height="44" rx="10" fill="#111"/>
        <g stroke="rgba(255,255,255,0.45)" stroke-width="4">${[0,1,2,3,4].map((i)=>`<path d="M ${84 + i*38} 52 v-10"/><path d="M ${84 + i*38} 116 v10"/>`).join('')}</g>`;
      break;
    case 'motherboard':
      artwork = `<rect x="78" y="28" width="164" height="112" rx="12" fill="#242426" stroke="rgba(255,255,255,0.18)"/>
        <rect x="96" y="46" width="52" height="40" rx="8" fill="${accent}" opacity="0.85"/>
        <rect x="160" y="46" width="60" height="14" rx="7" fill="rgba(255,255,255,0.4)"/>
        <rect x="160" y="68" width="44" height="14" rx="7" fill="rgba(255,255,255,0.24)"/>
        <rect x="98" y="98" width="124" height="22" rx="11" fill="#111"/>`;
      break;
    case 'gpu':
      artwork = `<rect x="52" y="58" width="216" height="64" rx="18" fill="#202024" stroke="rgba(255,255,255,0.18)"/>
        ${Array.from({length: fanCount}, (_, i) => `<circle cx="${102 + i*58}" cy="90" r="20" fill="#0f0f10" stroke="${accent}" stroke-width="3"/>`).join('')}
        <rect x="244" y="74" width="14" height="32" rx="7" fill="${secondary}"/>`;
      break;
    case 'memory':
      artwork = Array.from({length: memoryModules}, (_, i) => `<rect x="${72 + i*42}" y="58" width="28" height="74" rx="8" fill="#202024" stroke="${accent}" stroke-width="2"/>
        <rect x="78" y="72" width="16" height="32" rx="4" fill="rgba(255,255,255,0.38)"/>`).join('');
      break;
    case 'storage':
      artwork = `<rect x="74" y="86" width="172" height="30" rx="15" fill="#202024" stroke="rgba(255,255,255,0.18)"/>
        <circle cx="100" cy="101" r="8" fill="${accent}"/>
        <rect x="120" y="95" width="84" height="12" rx="6" fill="rgba(255,255,255,0.42)"/>`;
      break;
    case 'psu':
      artwork = `<rect x="94" y="48" width="132" height="84" rx="12" fill="#202024" stroke="rgba(255,255,255,0.18)"/>
        <circle cx="132" cy="90" r="24" fill="#0f0f10" stroke="${accent}" stroke-width="3"/>
        <rect x="172" y="72" width="32" height="36" rx="6" fill="rgba(255,255,255,0.22)"/>`;
      break;
    case 'cooler':
      artwork = `<rect x="88" y="48" width="50" height="84" rx="10" fill="#202024" stroke="rgba(255,255,255,0.16)"/>
        <rect x="182" y="48" width="50" height="84" rx="10" fill="#202024" stroke="rgba(255,255,255,0.16)"/>
        <path d="M 138 90 H 182" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="113" cy="90" r="18" fill="#0f0f10" stroke="${secondary}" stroke-width="3"/>
        <circle cx="207" cy="90" r="18" fill="#0f0f10" stroke="${secondary}" stroke-width="3"/>`;
      break;
    case 'case':
      artwork = `<rect x="116" y="34" width="88" height="112" rx="14" fill="#202024" stroke="rgba(255,255,255,0.18)"/>
        <rect x="130" y="52" width="60" height="60" rx="10" fill="#111"/>
        <circle cx="160" cy="82" r="18" fill="none" stroke="${accent}" stroke-width="3"/>
        <rect x="144" y="120" width="32" height="8" rx="4" fill="rgba(255,255,255,0.28)"/>`;
      break;
    default:
      artwork = `<rect x="84" y="44" width="152" height="88" rx="16" fill="#2b2b30" stroke="rgba(255,255,255,0.18)"/>`;
      break;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${part.model}">
      <rect width="320" height="320" rx="16" fill="#1d1d1f"/>
      <rect x="24" y="24" width="272" height="272" rx="18" fill="#2a2a2d" stroke="rgba(255,255,255,0.12)"/>
      ${artwork}
      <text x="160" y="278" fill="rgba(255,255,255,0.92)" font-family="SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle">${brand}</text>
      <text x="160" y="300" fill="rgba(255,255,255,0.62)" font-family="SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" text-anchor="middle">${label}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function init() {
  let baseData = null;
  let premiumData = null;

  try {
    baseData = await fetchJson('data/workstation-dataset.tw-2026q2.json');
  } catch (err) {
    console.warn('Base dataset fetch failed, using embedded fallback.', err);
    if (typeof FALLBACK_DATA !== 'undefined') {
      baseData = FALLBACK_DATA;
    }
  }

  try {
    premiumData = await fetchJson('data/workstation-premium.tw-2026q2.json');
  } catch (err) {
    console.warn('Premium dataset fetch failed, using premium fallback when available.', err);
    if (typeof PREMIUM_FALLBACK_DATA !== 'undefined') {
      premiumData = PREMIUM_FALLBACK_DATA;
    }
  }

  if (!baseData) {
    alert('Failed to load dataset. Please run a local web server (e.g. python -m http.server) or keep fallback files present.');
    return;
  }

  db = mergeDatasets(baseData, premiumData);
  renderPresets();
  bindFilters();
  renderCategories();
  updateSummary();
}

function bindFilters() {
  const searchInput = document.getElementById('search-input');
  const workloadFilter = document.getElementById('workload-filter');
  const assemblyOnlyToggle = document.getElementById('assembly-only-toggle');
  const lowVolatilityToggle = document.getElementById('low-volatility-toggle');
  const premiumToggle = document.getElementById('premium-toggle');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  navToggle?.addEventListener('click', () => {
    const isOpen = navMenu?.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });

  navMenu?.querySelectorAll('.nav-menu-link').forEach((link) => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('is-open');
      navToggle?.setAttribute('aria-expanded', 'false');
    });
  });

  searchInput?.addEventListener('input', (event) => {
    filters.search = event.target.value.trim().toLowerCase();
    renderCategories();
  });

  workloadFilter?.addEventListener('change', (event) => {
    filters.workload = event.target.value;
    renderCategories();
  });

  assemblyOnlyToggle?.addEventListener('change', (event) => {
    filters.assemblyOnly = event.target.checked;
    renderCategories();
  });

  lowVolatilityToggle?.addEventListener('change', (event) => {
    filters.lowVolatility = event.target.checked;
    renderCategories();
  });

  premiumToggle?.addEventListener('change', (event) => {
    filters.premium = event.target.checked;
    renderCategories();
  });
}

function matchesWorkload(part) {
  const tier = part.specs?.gaussianSplattingTier;
  const className = part.specs?.performanceClass;
  const tags = part.tags || [];

  switch (filters.workload) {
    case 'blender':
      return !['not-recommended'].includes(tier || '') || tags.includes('blender-entry') || tags.includes('balanced') || tags.includes('recommended') || tags.includes('workstation');
    case 'gs':
      return (!!tier && !['not-recommended'].includes(tier)) || tags.includes('gs') || tags.includes('entry-gs') || tags.includes('blackwell') || tags.includes('threadripper');
    case 'budget':
      return tags.includes('budget') || className === 'entry-workstation' || part.price.maxTwd <= 15000;
    default:
      return true;
  }
}

function matchesSearch(part) {
  if (!filters.search) return true;

  const haystack = [
    part.brand,
    part.model,
    ...(part.tags || []),
    ...(part.specs?.notes || []),
  ].join(' ').toLowerCase();

  return haystack.includes(filters.search);
}

function matchesVolatility(part) {
  if (!filters.lowVolatility) return true;
  return ['low', 'medium'].includes(part.price.volatility);
}

function matchesAssemblyOnly(part) {
  if (!filters.assemblyOnly) return true;
  return part.price.assemblyOnly === true;
}

function matchesPremium(part) {
  if (!filters.premium) return true;
  const tags = part.tags || [];
  return tags.some((tag) => ['flagship', 'pro', 'premium', 'enterprise', 'threadripper', 'blackwell', 'workstation'].includes(tag)) || part.price.maxTwd >= 100000;
}

function getFilteredParts(categoryId) {
  return db.parts
    .filter((part) => {
      if (part.category !== categoryId) return false;
      if (isHiddenPart(part)) return false;
      if (!matchesSearch(part)) return false;
      if (!matchesWorkload(part)) return false;
      if (!matchesAssemblyOnly(part)) return false;
      if (!matchesVolatility(part)) return false;
      if (!matchesPremium(part)) return false;
      return true;
    })
    .sort((left, right) => {
      const leftMin = left.price?.minTwd ?? Number.MAX_SAFE_INTEGER;
      const rightMin = right.price?.minTwd ?? Number.MAX_SAFE_INTEGER;
      if (leftMin !== rightMin) {
        return leftMin - rightMin;
      }

      const leftMax = left.price?.maxTwd ?? leftMin;
      const rightMax = right.price?.maxTwd ?? rightMin;
      if (leftMax !== rightMax) {
        return leftMax - rightMax;
      }

      return left.model.localeCompare(right.model, 'en');
    });
}

function renderPresets() {
  const container = document.getElementById('presets-container');
  container.innerHTML = '';

  db.referenceBuilds.filter(shouldShowBuild).forEach((build) => {
    const estimate = getBuildEstimate(build);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3 class="card-title">${build.label}</h3>
      <p class="caption mb-2">${build.workloads.join(' • ')}</p>
      <div style="margin-top: 8px; margin-bottom: 10px;">${(build.tags || []).slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
      <p class="caption">${(build.notes || []).join(' ')}</p>
      <div style="margin-top: auto; padding-top: 24px;">
        <p class="body-emphasis">${formatTwd(estimate.min)} - ${formatTwd(estimate.max)}</p>
        <button class="btn-pill mt-4" style="width: 100%; text-align: center;" onclick="loadPreset('${build.id}')">Select Build ></button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderCategories() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';

  CATEGORY_DEFINITIONS.forEach((category) => {
    const parts = getFilteredParts(category.id);
    if (parts.length === 0) return;

    const selectedCount = getSelectedIds(category.id).length;
    const section = document.createElement('div');
    section.className = 'category-section';

    let html = `<h3 class="category-header">${category.label}${multiSelectCategories.has(category.id) ? ` <span class="caption">(${selectedCount} selected)</span>` : ''}</h3><div class="grid-2">`;

    parts.forEach((part) => {
      const quantity = getSelectedCount(category.id, part.id);
      const isSelected = quantity > 0;
      const priceText = part.price.minTwd === part.price.maxTwd
        ? formatTwd(part.price.minTwd)
        : `${formatTwd(part.price.minTwd)} - ${formatTwd(part.price.maxTwd)}`;

      const actionControls = multiSelectCategories.has(category.id)
        ? `
          <div class="quantity-row" onclick="event.stopPropagation()">
            <span class="caption">Qty</span>
            <div class="quantity-controls">
              <button class="qty-btn" onclick="changeStorageQuantity('${part.id}', -1)" ${quantity === 0 ? 'disabled' : ''}>−</button>
              <span class="qty-value">${quantity}</span>
              <button class="qty-btn" onclick="changeStorageQuantity('${part.id}', 1)">+</button>
            </div>
          </div>
        `
        : `
          <div class="part-card-actions">
            <span class="caption part-card-status">${isSelected ? 'Selected' : 'Ready to configure'}</span>
          </div>
        `;

      html += `
        <div class="card part-card ${isSelected ? 'selected' : ''}">
          <div class="part-card-media" aria-hidden="true">
            <img class="part-card-image" alt="${part.model}" src="${getPartArtDataUri(part)}">
          </div>
          <div class="flex justify-between align-center mb-2">
            <span class="caption">${part.brand}</span>
            <div class="selection-meta">
              ${quantity > 0 ? `<span class="qty-badge">x${quantity}</span>` : ''}
              <span class="price-chip ${part.price.volatility}">${part.price.volatility}</span>
            </div>
          </div>
          <h4 class="card-title part-title">${part.model}</h4>
          <p class="caption">${getPartHighlights(part)}</p>
          <div style="margin-top: 8px; margin-bottom: 6px;">
            ${(part.tags || []).slice(0, 4).map((tag) => `<span class="tag">${tag}</span>`).join('')}
          </div>
          <p class="body-emphasis" style="margin-top: 12px;">${priceText}</p>
          ${part.price.assemblyOnly ? '<p class="caption assembly-note" style="margin-top: 8px;">Assembly-only pricing</p>' : ''}
          ${actionControls}
          <div class="part-card-links">
            <a href="#build" class="btn-pill part-card-link">Learn more ></a>
            <button class="btn-pill part-card-link" type="button" onclick="selectPart('${category.id}', '${part.id}')">Shop ></button>
          </div>
        </div>
      `;
    });

    html += '</div>';
    section.innerHTML = html;
    container.appendChild(section);
  });
}

window.selectPart = function selectPart(categoryId, partId) {
  if (multiSelectCategories.has(categoryId)) {
    changeStorageQuantity(partId, 1);
    return;
  } else {
    selectedParts[categoryId] = partId;
  }

  renderCategories();
  updateSummary();
};

window.changeStorageQuantity = function changeStorageQuantity(partId, delta) {
  const categoryId = 'storage';
  const current = getSelectedIds(categoryId);

  if (delta > 0) {
    selectedParts[categoryId] = [...current, partId];
  } else {
    let removed = false;
    const next = [];
    for (const id of current) {
      if (!removed && id === partId) {
        removed = true;
        continue;
      }
      next.push(id);
    }
    if (next.length === 0) {
      delete selectedParts[categoryId];
    } else {
      selectedParts[categoryId] = next;
    }
  }

  renderCategories();
  updateSummary();
};

window.loadPreset = function loadPreset(presetId) {
  const build = db.referenceBuilds.find((preset) => preset.id === presetId);
  if (!build) return;

  selectedParts = {};
  build.selectedPartIds.forEach((partId) => {
    const part = db.parts.find((entry) => entry.id === partId);
    if (!part) return;

    if (multiSelectCategories.has(part.category)) {
      if (!Array.isArray(selectedParts[part.category])) {
        selectedParts[part.category] = [];
      }
      selectedParts[part.category].push(partId);
    } else {
      selectedParts[part.category] = partId;
    }
  });

  document.getElementById('build').scrollIntoView({ behavior: 'smooth' });
  renderCategories();
  updateSummary();
};

function updateSummary() {
  const container = document.getElementById('summary-items');
  const priceEl = document.getElementById('build-total');
  const floatingPriceEl = document.getElementById('mobile-build-total');
  const floatingMetaEl = document.getElementById('mobile-build-meta');
  container.innerHTML = '';

  let minTotal = 0;
  let maxTotal = 0;
  let selectedItemCount = 0;
  let selectedCategoryCount = 0;

  CATEGORY_DEFINITIONS.forEach((category) => {
    const parts = getSelectedPartsForCategory(category.id);
    if (parts.length === 0) return;

    selectedCategoryCount += 1;

    const groupedParts = multiSelectCategories.has(category.id)
      ? Array.from(parts.reduce((map, part) => {
          const existing = map.get(part.id);
          if (existing) {
            existing.quantity += 1;
          } else {
            map.set(part.id, {part, quantity: 1});
          }
          return map;
        }, new Map()).values())
      : parts.map((part) => ({part, quantity: 1}));

    groupedParts.forEach(({part, quantity}, index) => {
      minTotal += part.price.minTwd;
      maxTotal += part.price.maxTwd;
      minTotal += part.price.minTwd * (quantity - 1);
      maxTotal += part.price.maxTwd * (quantity - 1);
      selectedItemCount += quantity;

      container.innerHTML += `
        <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div class="caption summary-item-label" style="text-transform: capitalize;">${category.id}${groupedParts.length > 1 ? ` #${index + 1}` : ''}</div>
          <div class="body-emphasis" style="font-size: 15px;">${part.model}${quantity > 1 ? ` × ${quantity}` : ''}</div>
          <div class="caption">${getPartHighlights(part)}</div>
          <div class="caption">${quantity > 1 ? `${formatTwd(part.price.minTwd * quantity)}${part.price.maxTwd !== part.price.minTwd ? ` - ${formatTwd(part.price.maxTwd * quantity)}` : ''}` : `${formatTwd(part.price.minTwd)}${part.price.maxTwd !== part.price.minTwd ? ` - ${formatTwd(part.price.maxTwd)}` : ''}`}</div>
        </div>
      `;
    });
  });

  if (selectedItemCount === 0) {
    container.innerHTML = '<p class="caption">No parts selected yet.</p>';
  }

  const storageParts = getSelectedPartsForCategory('storage');
  if (storageParts.length > 1) {
    const totalStorageTb = storageParts.reduce((sum, part) => sum + (part.specs?.capacityTb || 0), 0);
    container.innerHTML += `<div class="summary-meta"><div class="caption">Storage pool</div><div class="body-emphasis">${totalStorageTb}TB across ${storageParts.length} SSDs</div></div>`;
  }

  const buildReadiness = document.createElement('div');
  buildReadiness.className = 'summary-meta';
  buildReadiness.innerHTML = `<div class="caption">Build coverage</div><div class="body-emphasis">${selectedCategoryCount} / ${CATEGORY_DEFINITIONS.length} categories • ${selectedItemCount} items</div>`;
  container.appendChild(buildReadiness);

  const totalText = minTotal === maxTotal
    ? formatTwd(minTotal)
    : `${formatTwd(minTotal)} - ${formatTwd(maxTotal)}`;

  priceEl.textContent = totalText;
  if (floatingPriceEl) {
    floatingPriceEl.textContent = totalText;
  }
  if (floatingMetaEl) {
    floatingMetaEl.textContent = `${selectedCategoryCount} / ${CATEGORY_DEFINITIONS.length} categories • ${selectedItemCount} items`;
  }

  checkCompatibility();
}

function checkCompatibility() {
  const container = document.getElementById('compatibility-warnings');
  container.innerHTML = '';

  const cpu = getPrimarySelectedPart('cpu');
  const motherboard = getPrimarySelectedPart('motherboard');
  const gpu = getPrimarySelectedPart('gpu');
  const psu = getPrimarySelectedPart('psu');
  const memory = getPrimarySelectedPart('memory');
  const cooler = getPrimarySelectedPart('cooler');
  const casePart = getPrimarySelectedPart('case');
  const storageParts = getSelectedPartsForCategory('storage');

  const issues = [];

  if (cpu && motherboard && cpu.compatibility?.socket !== motherboard.compatibility?.socket) {
    issues.push({ type: 'error', msg: `CPU socket ${cpu.compatibility.socket} does not match motherboard socket ${motherboard.compatibility.socket}.` });
  }

  if (memory && motherboard && memory.compatibility?.memoryType !== motherboard.compatibility?.memoryType) {
    issues.push({ type: 'error', msg: `Memory type ${memory.compatibility.memoryType} is incompatible with motherboard memory type ${motherboard.compatibility.memoryType}.` });
  }

  if (memory && motherboard?.specs?.validatedMaxMemoryGb && memory.specs?.capacityGb > motherboard.specs.validatedMaxMemoryGb) {
    issues.push({ type: 'error', msg: `Selected memory ${memory.specs.capacityGb}GB exceeds motherboard validated limit ${motherboard.specs.validatedMaxMemoryGb}GB.` });
  }

  if (gpu && psu && gpu.compatibility?.psuMinW && psu.compatibility?.wattage) {
    const recommendedHeadroom = gpu.compatibility.psuMinW + 150;
    if (psu.compatibility.wattage < gpu.compatibility.psuMinW) {
      issues.push({ type: 'error', msg: `GPU requires at least ${gpu.compatibility.psuMinW}W. Selected PSU is ${psu.compatibility.wattage}W.` });
    } else if (psu.compatibility.wattage < recommendedHeadroom) {
      issues.push({ type: 'warning', msg: `PSU meets minimum GPU requirement but falls short of the ${recommendedHeadroom}W workstation headroom target.` });
    }
  }

  if (gpu?.specs?.vramGb && gpu.specs.vramGb < 24) {
    issues.push({ type: 'warning', msg: `Selected GPU has ${gpu.specs.vramGb}GB VRAM. Gaussian Splatting is much more comfortable at 24GB+, and premium scenes often want 48GB or 96GB.` });
  }

  const totalStorageTb = storageParts.reduce((sum, part) => sum + (part.specs?.capacityTb || 0), 0);
  if (storageParts.length > 0 && totalStorageTb < 2) {
    issues.push({ type: 'warning', msg: `Total storage is ${totalStorageTb}TB. Active Blender cache and GS datasets are better on at least 2TB.` });
  }
  if (storageParts.length > 1 && totalStorageTb >= 8) {
    issues.push({ type: 'warning', msg: `Multi-SSD layout looks strong for high-end asset and dataset staging. Re-check lane allocation on WRX90 or your chosen platform.` });
  }

  if (casePart && motherboard?.compatibility?.formFactor && Array.isArray(casePart.compatibility?.supportsMotherboard) && !casePart.compatibility.supportsMotherboard.includes(motherboard.compatibility.formFactor)) {
    issues.push({ type: 'error', msg: `Selected case does not list support for motherboard form factor ${motherboard.compatibility.formFactor}.` });
  }

  if (cooler && Array.isArray(cooler.compatibility?.supportedSockets) && cpu?.compatibility?.socket && !cooler.compatibility.supportedSockets.includes(cpu.compatibility.socket)) {
    issues.push({ type: 'error', msg: `Selected cooler does not list socket support for ${cpu.compatibility.socket}.` });
  }

  if (issues.length === 0 && Object.keys(selectedParts).length >= 5) {
    const ok = document.createElement('div');
    ok.className = 'success-box';
    ok.textContent = 'Core compatibility checks passed for current selection.';
    container.appendChild(ok);
  }

  issues.forEach((issue) => {
    const div = document.createElement('div');
    div.className = issue.type === 'error' ? 'error-box' : 'warning-box';
    div.textContent = issue.msg;
    container.appendChild(div);
  });
}

document.addEventListener('DOMContentLoaded', init);

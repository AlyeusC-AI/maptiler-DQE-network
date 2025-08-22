import nearestPointOnLine from "@turf/nearest-point-on-line";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, lineString, featureCollection } from "@turf/helpers";
import bbox from "@turf/bbox";
import { Popup, Marker, LngLatBounds } from "@maptiler/sdk";

class SearchCardControl {
  constructor(map, config, getRelevantFeatures, resetMapBounds) {
    this.map = map;
    this.config = config;
    this.getRelevantFeatures = getRelevantFeatures;
    this.resetMapBounds = resetMapBounds;

    this.mode = 'single';
    this.addressInputs = [];
    this.maxInputs = 10;
    this.markers = [];
    this.results = [];
    this.currentSuggestions = [];
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl search-card-wrapper';

    const card = document.createElement('div');
    card.className = 'search-card';

    // Sections
    this.topEl = document.createElement('div');
    this.topEl.className = 'search-card__top';
    this.topEl.innerHTML = 'Search our <b>fiber network</b>';
    
    // Add collapse functionality to top section
    this.topEl.addEventListener('click', () => {
      const isCollapsed = this.topEl.classList.contains('collapsed');
      if (isCollapsed) {
        this.expandCard();
      } else {
        this.collapseCard();
      }
    });

    this.middleEl = document.createElement('div');
    this.middleEl.className = 'search-card__middle';

    this.bottomEl = document.createElement('div');
    this.bottomEl.className = 'search-card__bottom';

    card.appendChild(this.topEl);
    card.appendChild(this.middleEl);
    card.appendChild(this.bottomEl);

    this._container.appendChild(card);

    // Initial render
    this.renderSingleMode();

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }

  // Helper method to clear all dynamic elements
  clearDynamicElements() {
    // Remove second top navigation if exists with transition
    const existingSecondTop = this._container.querySelector('.search-card__second-top');
    if (existingSecondTop) {
      existingSecondTop.classList.remove('active');
      setTimeout(() => {
        if (existingSecondTop.parentNode) {
          existingSecondTop.remove();
        }
      }, 300); // Match transition duration
    }

    // Remove interval actions if exists
    const existingInterval = this._container.querySelector('.search-card__interval');
    if (existingInterval) {
      existingInterval.remove();
    }

    // Clear middle section
    this.middleEl.innerHTML = '';
    
    // Clear bottom section
    this.bottomEl.innerHTML = '';
  }

  // UI Renders
  renderSingleMode() {
    this.mode = 'single';
    this.clearMarkers();
    this.results = [];
    this.setTopTitle('Search our <b>fiber network</b>');

    // Clear all dynamic elements
    this.clearDynamicElements();

    const row = document.createElement('div');
    row.className = 'search-card__row';

    const inputWrap = document.createElement('div');
    inputWrap.className = 'search-card__input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter Zip Code Or Address.';
    input.className = 'search-card__input';
    input.addEventListener('input', (e) => this.handleSuggest(e, input, suggestList));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSingleSearch();
    });

    const circleBtn = document.createElement('button');
    circleBtn.className = 'search-card__circle-btn';
    circleBtn.innerText = '';
    circleBtn.addEventListener('click', () => this.handleSingleSearch());

    const suggestList = document.createElement('div');
    suggestList.className = 'search-card__suggest';

    inputWrap.appendChild(input);
    inputWrap.appendChild(circleBtn);
    inputWrap.appendChild(suggestList);

    row.appendChild(inputWrap);

    this.middleEl.appendChild(row);

    // Bottom nav
    const switchMulti = document.createElement('button');
    switchMulti.className = 'search-card__link-btn';
    switchMulti.textContent = 'Or Search Multiple Addresses >';
    switchMulti.addEventListener('click', () => this.renderMultiMode());
    this.bottomEl.appendChild(switchMulti);
  }

  renderMultiMode() {
    this.mode = 'multi';
    this.clearMarkers();
    this.results = [];
    this.setTopTitle('Search our <b>fiber network</b>');

    // Clear all dynamic elements
    this.clearDynamicElements();

    // Create second top row (embedded directly into card)
    const secondTopRow = document.createElement('div');
    secondTopRow.className = 'search-card__second-top';

    const backBtn = document.createElement('button');
    backBtn.className = 'search-card__link-btn search-card__link-btn--top';
    backBtn.textContent = '< Search a Single Address';
    backBtn.addEventListener('click', () => this.renderSingleMode());
    secondTopRow.appendChild(backBtn);

    // Add second top row to the card (not middle)
    this._container.querySelector('.search-card').insertBefore(secondTopRow, this.middleEl);
    
    // Trigger transition after a brief delay to ensure DOM is ready
    setTimeout(() => {
      secondTopRow.classList.add('active');
    }, 10);

    this.inputsWrap = document.createElement('div');
    this.inputsWrap.className = 'search-card__inputs';
    this.middleEl.appendChild(this.inputsWrap);

    // Start with one input
    this.addressInputs = [];
    this.addAddressInput();

    // Plus button in its own centered row
    const plusRow = document.createElement('div');
    plusRow.className = 'search-card__plus-row';
    this.plusBtn = document.createElement('button');
    this.plusBtn.className = 'search-card__plus-btn';
    this.plusBtn.innerHTML = '+';
    this.plusBtn.addEventListener('click', () => this.addAddressInput());
    plusRow.appendChild(this.plusBtn);
    this.middleEl.appendChild(plusRow);

    // Search button in its own centered row (next row after plus button)
    const searchRow = document.createElement('div');
    searchRow.className = 'search-card__search-row';
    this.searchManyBtn = document.createElement('button');
    this.searchManyBtn.className = 'search-card__primary-btn';
    this.searchManyBtn.textContent = 'Search >';
    this.searchManyBtn.disabled = true;
    this.searchManyBtn.addEventListener('click', () => this.handleMultiSearch());
    searchRow.appendChild(this.searchManyBtn);
    this.middleEl.appendChild(searchRow);

    // Bottom: CSV upload
    const bottomBar = document.createElement('div');
    bottomBar.className = 'search-card__bottom-row';
    const leftText = document.createElement('div');
    leftText.textContent = 'Or Upload a CSV';
    leftText.style.color = '#232d4b';
    const uploadWrap = document.createElement('label');
    uploadWrap.className = 'search-card__file-btn';
    uploadWrap.textContent = 'Choose File...';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.txt';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => this.handleCsvUpload(e));
    uploadWrap.appendChild(fileInput);
    bottomBar.appendChild(leftText);
    bottomBar.appendChild(uploadWrap);
    this.bottomEl.appendChild(bottomBar);
  }

  setTopTitle(text) {
    this.topEl.innerHTML = text;
  }

  addAddressInput(prefill = '') {
    if (this.addressInputs.length >= this.maxInputs) return;

    const row = document.createElement('div');
    row.className = 'search-card__row search-card__row--multi';

    const inputWrap = document.createElement('div');
    inputWrap.className = 'search-card__input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter Zip Code Or Address.';
    input.className = 'search-card__input';
    input.value = prefill;

    const suggestList = document.createElement('div');
    suggestList.className = 'search-card__suggest';
    input.addEventListener('input', (e) => {
      this.handleSuggest(e, input, suggestList);
      this.validateMultiSearchInputs();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleMultiSearch();
    });

    inputWrap.appendChild(input);
    inputWrap.appendChild(suggestList);

    row.appendChild(inputWrap);
    this.inputsWrap.appendChild(row);

    this.addressInputs.push({ input, suggestList });

    if (this.addressInputs.length >= this.maxInputs) {
      this.plusBtn && (this.plusBtn.style.display = 'none');
    }

    // Validate inputs after adding
    this.validateMultiSearchInputs();
  }

  async handleSuggest(event, inputEl, suggestList) {
    const query = inputEl.value.trim();
    if (!query) {
      suggestList.innerHTML = '';
      suggestList.style.display = 'none';
      return;
    }
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${this.config.key}&country=US&autocomplete=true&limit=5`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Geocoding suggest failed');
      const data = await resp.json();
      const features = data.features || [];

      suggestList.innerHTML = '';
      features.forEach((f) => {
        const item = document.createElement('div');
        item.className = 'search-card__suggest-item';
        item.textContent = f.place_name || f.text || query;
        item.addEventListener('click', () => {
          inputEl.value = f.place_name || f.text;
          inputEl.dataset.lng = (f.center && f.center[0]) || '';
          inputEl.dataset.lat = (f.center && f.center[1]) || '';
          suggestList.innerHTML = '';
          suggestList.style.display = 'none';
        });
        suggestList.appendChild(item);
      });
      suggestList.style.display = features.length ? 'block' : 'none';
    } catch (_) {
      suggestList.innerHTML = '';
      suggestList.style.display = 'none';
    }
  }

  async handleSingleSearch() {
    const input = this.middleEl.querySelector('.search-card__input');
    const addressText = input.value.trim();
    if (!addressText) return;

    const geocoded = await this.geocode(addressText, input.dataset);
    if (!geocoded) return;

    const analysis = await this.analyzeLocations([geocoded]);
    this.renderSingleResults(analysis);
    this.recordSearch([geocoded]).catch(() => {});
  }

  async handleMultiSearch() {
    const entries = this.addressInputs
      .map(({ input }) => input.value.trim())
      .filter(Boolean);
    if (entries.length === 0) return;

    const geocodedList = [];
    for (let i = 0; i < entries.length; i++) {
      const inputMeta = this.addressInputs[i]?.input?.dataset || {};
      const res = await this.geocode(entries[i], inputMeta);
      if (res) geocodedList.push(res);
    }

    if (!geocodedList.length) return;

    const analysis = await this.analyzeLocations(geocodedList);
    this.renderMultiResults(analysis);
    this.recordSearch(geocodedList).catch(() => {});
  }

  async handleCsvUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = (lines.shift() || '').split(',').map(h => h.trim().replace(/"/g, ''));
      const addresses = lines.map((line) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx] || '');
        return row['Structure Address'] || row['address'] || row['street'] || row['name'] || values.join(' ');
      }).filter(Boolean);

      // Fill inputs up to max, then search
      for (let i = 0; i < Math.min(addresses.length, this.maxInputs); i++) {
        if (i >= this.addressInputs.length) this.addAddressInput();
        this.addressInputs[i].input.value = addresses[i];
      }
    } catch (_) {
      // ignore
    } finally {
      e.target.value = '';
    }
  }

  async geocode(addressText, meta = {}) {
    // Use pre-selected lng/lat if suggestion clicked
    if (meta && meta.lng && meta.lat) {
      return {
        address: addressText,
        coordinates: [parseFloat(meta.lng), parseFloat(meta.lat)],
        place_name: addressText
      };
    }
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(addressText)}.json?key=${this.config.key}&country=US&limit=1`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.features || !data.features.length) return null;
    const f = data.features[0];
    return {
      address: addressText,
      coordinates: f.center,
      place_name: f.place_name
    };
  }

  async analyzeLocations(locations) {
    this.clearMarkers();
    const features = this.getRelevantFeatures(this._map);
    const analysis = [];

    let bounds = new LngLatBounds();
    let onNetCount = 0;
    let distances = [];

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const result = await this.computeProximity(loc.coordinates, features);
      analysis.push({ ...loc, ...result });
      if (result.onNet) onNetCount++;
      if (typeof result.miles === 'number') distances.push(result.miles);

      const marker = this.createAddressMarker(loc, i + 1);
      this.markers.push(marker);
      bounds.extend(marker.getLngLat());
      if (result.networkPoint) bounds.extend(result.networkPoint);
    }

    // Fit map
    if (locations.length === 1 && analysis[0].networkPoint) {
      this._map.fitBounds(bounds, { padding: 50 });
    } else if (this.markers.length) {
      this._map.fitBounds(bounds, { padding: 50 });
    }

    const avg = distances.length ? (distances.reduce((a, b) => a + b, 0) / distances.length) : 0;
    const longest = distances.length ? Math.max(...distances) : 0;

    return {
      items: analysis,
      summary: {
        onNetCount,
        avgDistance: avg,
        longestDistance: longest
      }
    };
  }

  async computeProximity(coordinates, features) {
    const pt = point(coordinates);
    // On-net detection: any polygon contains point
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (f.geometry && /Polygon/i.test(f.geometry.type)) {
        try {
          if (booleanPointInPolygon(pt, f)) {
            return { onNet: true, miles: 0, networkPoint: coordinates };
          }
        } catch (_) {}
      }
    }

    // Distance to nearest feature
    const points = [];
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      let ls = feature;
      if (!feature.geometry || !/LineString/i.test(feature.geometry.type)) {
        const c = feature.geometry?.coordinates;
        if (!c) continue;
        ls = lineString([c, c]);
      }
      try {
        const nearest = nearestPointOnLine(ls, coordinates, { units: 'miles' });
        points.push(nearest);
      } catch (_) {}
    }

    if (!points.length) {
      return { onNet: false, miles: null, networkPoint: null };
    }

    points.sort((a, b) => a.properties.dist - b.properties.dist);
    return {
      onNet: false,
      miles: points[0].properties.dist,
      networkPoint: points[0].geometry.coordinates
    };
  }

  renderSingleResults(analysis) {
    const item = analysis.items[0];
    const isOnNet = item.onNet === true;
    const miles = typeof item.miles === 'number' ? item.miles : null;

    // Clear all dynamic elements first
    this.clearDynamicElements();

    // Create navigation section between top and middle
    const navSection = document.createElement('div');
    navSection.className = 'search-card__second-top';
    const backBtn = document.createElement('button');
    backBtn.className = 'search-card__link-btn search-card__link-btn--top';
    backBtn.textContent = '< Search Again';
    backBtn.addEventListener('click', () => this.renderSingleMode());
    navSection.appendChild(backBtn);
    this._container.querySelector('.search-card').insertBefore(navSection, this.middleEl);
    
    // Trigger transition after a brief delay to ensure DOM is ready
    setTimeout(() => {
      navSection.classList.add('active');
    }, 10);

    if (isOnNet) {
      // Case 1: On-net
      this.setTopTitle("You're in one of our On Net Buildings.");
      
      // Middle section with message and buttons
      const messageEl = document.createElement('div');
      messageEl.className = 'search-card__message';
      messageEl.innerHTML = '<b>Complete a Free Assessment</b> or reach out to start developing your custom solution.';
      messageEl.style.textAlign = 'center';
      messageEl.style.marginBottom = '20px';
      this.middleEl.appendChild(messageEl);

      const actions = this.buildActionButtons();
      this.middleEl.appendChild(actions);

    } else if (miles != null && miles <= 5.5) {
      // Case 2: Within 5.5 miles
      this.setTopTitle("You're close to our Network!");
      
      // Middle section with message and buttons
      const messageEl = document.createElement('div');
      messageEl.className = 'search-card__message';
      messageEl.innerHTML = '<b>Complete a Free Assessment</b> or reach out to start developing your custom solution.';
      messageEl.style.textAlign = 'left';
      messageEl.style.marginBottom = '20px';
      this.middleEl.appendChild(messageEl);

      const actions = this.buildActionButtons();
      this.middleEl.appendChild(actions);

      // Bottom section with distance
      const distanceEl = document.createElement('div');
      distanceEl.className = 'search-card__distance';
      distanceEl.innerHTML = `<strong>Distance to Network:</strong> ${miles.toFixed(2)} miles`;
      this.bottomEl.appendChild(distanceEl);

    } else {
      // Case 3: Greater than 5.5 miles
      this.setTopTitle("You aren't in our Network.");
      
      // Middle section with message and contact button
      const messageEl = document.createElement('div');
      messageEl.className = 'search-card__message';
      messageEl.innerHTML = '<b>We may be coming soon!</b> Have another question?';
      messageEl.style.textAlign = 'center';
      messageEl.style.marginBottom = '20px';
      this.middleEl.appendChild(messageEl);

      const contactBtn = document.createElement('button');
      contactBtn.className = 'search-card__secondary-btn';
      contactBtn.textContent = 'Contact Us >';
      contactBtn.addEventListener('click', () => this.navigateTo('contact'));
      contactBtn.style.margin = '0 auto';
      contactBtn.style.display = 'block';
      this.middleEl.appendChild(contactBtn);

      // Bottom section with distance if available
      if (miles != null) {
        const distanceEl = document.createElement('div');
        distanceEl.className = 'search-card__distance';
        distanceEl.innerHTML = `<strong>Distance to Network:</strong> ${miles.toFixed(2)} miles`;
        this.bottomEl.appendChild(distanceEl);
      }
    }
  }

  renderMultiResults(analysis) {
    // Clear all dynamic elements first
    this.clearDynamicElements();

    // Create navigation section between top and middle
    const navSection = document.createElement('div');
    navSection.className = 'search-card__second-top';
    const backBtn = document.createElement('button');
    backBtn.className = 'search-card__link-btn search-card__link-btn--top';
    backBtn.textContent = '< Search Again';
    backBtn.addEventListener('click', () => this.renderMultiMode());
    navSection.appendChild(backBtn);
    this._container.querySelector('.search-card').insertBefore(navSection, this.middleEl);
    
    // Trigger transition after a brief delay to ensure DOM is ready
    setTimeout(() => {
      navSection.classList.add('active');
    }, 10);

    // Case 4: Multi-address results
    this.setTopTitle("You're close to our Network!");
    
    // Middle section with message and buttons
    const messageEl = document.createElement('div');
    messageEl.className = 'search-card__message';
    messageEl.innerHTML = '<b>Complete a Free Assessment</b> or reach out to start developing your custom solution.';
    messageEl.style.textAlign = 'left';
    messageEl.style.marginBottom = '20px';
    this.middleEl.appendChild(messageEl);

    const actions = this.buildActionButtons();
    this.middleEl.appendChild(actions);

    // Bottom section with summary data
    const summaryEl = document.createElement('div');
    summaryEl.className = 'search-card__summary';
    summaryEl.innerHTML = `
      <div><strong>Locations On-Net:</strong> ${analysis.summary.onNetCount}</div>
      <div><strong>Average Distance to Network:</strong> ${analysis.summary.avgDistance.toFixed(2)} miles</div>
      <div><strong>Longest Distance:</strong> ${analysis.summary.longestDistance.toFixed(2)} miles</div>
    `;
    this.bottomEl.appendChild(summaryEl);
  }

  buildActionButtons() {
    const wrap = document.createElement('div');
    wrap.className = 'search-card__actions';

    const btn1 = document.createElement('button');
    btn1.className = 'search-card__primary-btn';
    btn1.textContent = 'Free Assessment >';
    btn1.addEventListener('click', () => this.navigateTo('assessment'));

    const btn2 = document.createElement('button');
    btn2.className = 'search-card__secondary-btn';
    btn2.textContent = 'Contact Us >';
    btn2.addEventListener('click', () => this.navigateTo('contact'));

    wrap.appendChild(btn1);
    wrap.appendChild(btn2);
    return wrap;
  }

  navigateTo(type) {
    const url = type === 'assessment' ? (this.config?.links?.assessment || '#') : (this.config?.links?.contact || '#');
    if (url && url !== '#') window.open(url, '_blank');
  }

  createAddressMarker(loc, index) {
    const el = document.createElement('div');
    el.className = 'amc-map-marker';
    el.style.width = '18px';
    el.style.height = '18px';
    el.style.backgroundColor = '#e37325';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    const popup = new Popup({ offset: 25 }).setHTML(`
      <div style="padding: 10px; min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Address ${index}</h4>
        <p style="margin: 0; font-weight: bold;">${loc.address}</p>
      </div>
    `);
    return new Marker(el).setLngLat(loc.coordinates).setPopup(popup).addTo(this._map);
  }

  clearMarkers() {
    this.markers.forEach(m => m.remove());
    this.markers = [];
  }

  async recordSearch(locations) {
    try {
      const endpoint = this.config?.recordSearchUrl;
      if (!endpoint) return;
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          locations: locations.map(l => ({ address: l.address, coordinates: l.coordinates }))
        })
      });
    } catch (_) {}
  }

  validateMultiSearchInputs() {
    if (!this.searchManyBtn) return;
    
    const hasValidInputs = this.addressInputs.length > 0 && 
      this.addressInputs.every(({ input }) => input.value.trim().length > 0);
    
    this.searchManyBtn.disabled = !hasValidInputs;
    
    // Update button appearance based on state
    if (hasValidInputs) {
      this.searchManyBtn.style.opacity = '1';
      this.searchManyBtn.style.cursor = 'pointer';
    } else {
      this.searchManyBtn.style.opacity = '0.5';
      this.searchManyBtn.style.cursor = 'not-allowed';
    }
  }

  // Helper methods for collapse/expand functionality
  collapseCard() {
    this.topEl.classList.add('collapsed');
    this.middleEl.classList.add('collapsed');
    this.bottomEl.classList.add('collapsed');
    
    // Also collapse any dynamically added sections
    const dynamicSections = this._container.querySelectorAll('.search-card__second-top, .search-card__interval');
    dynamicSections.forEach(section => {
      section.classList.add('collapsed');
    });
  }

  expandCard() {
    this.topEl.classList.remove('collapsed');
    this.middleEl.classList.remove('collapsed');
    this.bottomEl.classList.remove('collapsed');
    
    // Also expand any dynamically added sections
    const dynamicSections = this._container.querySelectorAll('.search-card__second-top, .search-card__interval');
    dynamicSections.forEach(section => {
      section.classList.remove('collapsed');
    });
  }
}

export { SearchCardControl };



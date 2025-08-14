import * as toGeoJSON from 'togeojson';
import JSZip from 'jszip';
import bbox from '@turf/bbox';
import { featureCollection } from '@turf/helpers';

class KMZUploadControl {
  constructor() {
    this._map = undefined;
    this._container = undefined;
    this.uploadedLayers = new Map();
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl layers-filter active';

    const header = document.createElement('div');
    header.className = 'amc-map-header layers-filter-header';
    header.innerText = 'KMZ / KML Upload';
    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
    });

    const content = document.createElement('div');
    content.className = 'layers-filter-content';

    // Optional: choose a target layer to override
    const layerSelectLabel = document.createElement('label');
    layerSelectLabel.innerText = 'Target layer to override (optional):';
    layerSelectLabel.style.display = 'block';
    layerSelectLabel.style.margin = '8px 0 4px';

    const layerSelect = document.createElement('select');
    layerSelect.id = 'kmz-target-layer';
    layerSelect.style.width = '100%';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.innerText = '(none)';
    layerSelect.appendChild(emptyOption);

    const style = map.getStyle();
    const layers = style.layers.filter(l => l.type !== 'background');
    layers.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.innerText = l.id;
      layerSelect.appendChild(opt);
    });

    const overrideWrap = document.createElement('div');
    overrideWrap.style.margin = '8px 0';
    const overrideCheckbox = document.createElement('input');
    overrideCheckbox.type = 'checkbox';
    overrideCheckbox.id = 'kmz-override-toggle';
    const overrideLabel = document.createElement('label');
    overrideLabel.htmlFor = 'kmz-override-toggle';
    overrideLabel.innerText = ' Hide selected layer and draw uploaded data instead';
    overrideWrap.appendChild(overrideCheckbox);
    overrideWrap.appendChild(overrideLabel);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.kmz,.kml';
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    const list = document.createElement('ul');
    list.className = 'openlayers-layer-list';
    list.id = 'kmz-upload-list';

    content.appendChild(layerSelectLabel);
    content.appendChild(layerSelect);
    content.appendChild(overrideWrap);
    content.appendChild(fileInput);
    content.appendChild(list);

    // Hide list by default on mobile
    if (window.innerWidth < 768) {
      this._container.classList.remove('active');
    }

    this._container.appendChild(header);
    this._container.appendChild(content);
    return this._container;
  }

  async handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const geojson = file.name.toLowerCase().endsWith('.kmz')
        ? await this.parseKMZ(file)
        : await this.parseKML(file);

      const sourceId = `kmz-source-${Date.now()}`;
      const layerId = `kmz-layer-${Date.now()}`;

      this._map.addSource(sourceId, {
        type: 'geojson',
        data: geojson
      });

      // Add as fill/line/symbol based on geometry types present
      const hasPolygons = geojson.features?.some(f => /Polygon/i.test(f.geometry?.type));
      const hasLines = geojson.features?.some(f => /LineString/i.test(f.geometry?.type));
      const hasPoints = geojson.features?.some(f => /Point/i.test(f.geometry?.type));

      const targetId = this._container.querySelector('#kmz-target-layer')?.value || '';
      const override = this._container.querySelector('#kmz-override-toggle')?.checked;
      const beforeId = targetId || undefined;

      // Prepare per-feature icons for points, if present
      let iconMap = new Map();
      if (hasPoints) {
        iconMap = this.collectIconUrls(geojson);
        await this.ensureImages(iconMap);
      }

      if (hasPolygons) {
        this.addLayerSafe({
          id: `${layerId}-fill`,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': ['coalesce', ['get', 'fill'], ['get', 'stroke'], '#ff0000'],
            'fill-opacity': ['coalesce', ['to-number', ['get', 'fill-opacity']], 0.3],
            'fill-outline-color': ['coalesce', ['get', 'stroke'], '#000000']
          },
          filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']]
        }, beforeId);
      }

      if (hasLines) {
        this.addLayerSafe({
          id: `${layerId}-line`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': ['coalesce', ['get', 'stroke'], ['get', 'fill'], '#ff0000'],
            'line-width': ['coalesce', ['to-number', ['get', 'stroke-width']], 2],
            'line-opacity': ['coalesce', ['to-number', ['get', 'stroke-opacity']], 1]
          },
          filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']]
        }, beforeId);
      }

      if (hasPoints) {
        // Symbol layer for icon-based points
        this.addLayerSafe({
          id: `${layerId}-symbol`,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': ['get', 'icon-id'],
            'icon-size': ['coalesce', ['to-number', ['get', 'icon-scale']], 1],
            'icon-allow-overlap': true,
            'text-field': ['coalesce', ['get', 'name'], ''],
            'text-offset': [0, 1.2],
            'text-size': 12,
            'text-anchor': 'top'
          },
          filter: ['all', ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']], ['has', 'icon-id']]
        }, beforeId);

        // Circle layer fallback for points without icons
        this.addLayerSafe({
          id: `${layerId}-circle`,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-color': ['coalesce', ['get', 'marker-color'], ['get', 'fill'], ['get', 'stroke'], '#ff0000'],
            'circle-radius': 5,
            'circle-stroke-color': ['coalesce', ['get', 'stroke'], '#ffffff'],
            'circle-stroke-width': ['coalesce', ['to-number', ['get', 'stroke-width']], 1],
            'circle-opacity': ['coalesce', ['to-number', ['get', 'fill-opacity']], 1]
          },
          filter: ['all', ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']], ['!', ['has', 'icon-id']]]
        }, beforeId);
      }

      if (override && targetId) {
        const currentVisibility = this._map.getLayoutProperty(targetId, 'visibility');
        if (currentVisibility !== 'none') {
          this._map.setLayoutProperty(targetId, 'visibility', 'none');
        }
        this.uploadedLayers.set(layerId, { sourceId, name: file.name, overriddenLayerId: targetId });
      } else {
        this.uploadedLayers.set(layerId, { sourceId, name: file.name });
      }
      this.appendListItem(layerId, file.name);

      // Fit to bounds
      this.fitToGeoJSON(geojson);
    } catch (err) {
      console.error('KMZ/KML parse failed', err);
      alert(`Failed to parse/add KMZ/KML: ${err?.message || err}`);
    } finally {
      // reset input so same file can be re-uploaded
      event.target.value = '';
    }
  }

  addLayerSafe(layerDef, beforeId) {
    try {
      if (beforeId) {
        this._map.addLayer(layerDef, beforeId);
      } else {
        this._map.addLayer(layerDef);
      }
    } catch (e) {
      // Fallback without beforeId if invalid target specified
      try {
        this._map.addLayer(layerDef);
      } catch (e2) {
        throw e2;
      }
    }
  }

  async parseKMZ(file) {
    const zip = await JSZip.loadAsync(file);
    const allNames = Object.keys(zip.files);
    const kmlNames = allNames.filter((n) => !zip.files[n].dir && n.toLowerCase().endsWith('.kml'));
    if (!kmlNames.length) throw new Error('No KML found inside KMZ');

    // Prefer doc.kml if present, else the first .kml
    const preferred = kmlNames.find((n) => n.toLowerCase().endsWith('/doc.kml') || n.toLowerCase() === 'doc.kml') || kmlNames[0];
    const kmlText = await zip.files[preferred].async('text');
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    if (kmlDoc.getElementsByTagName('parsererror').length) {
      throw new Error('Invalid KML (XML parse error)');
    }
    const gj = toGeoJSON.kml(kmlDoc);
    this.applyKmlStyleToFeatures(gj, zip);
    if (!gj || gj.type !== 'FeatureCollection') {
      throw new Error('Parsed KML did not produce a FeatureCollection');
    }
    return gj;
  }

  async parseKML(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(text, 'text/xml');
    if (kmlDoc.getElementsByTagName('parsererror').length) {
      throw new Error('Invalid KML (XML parse error)');
    }
    const gj = toGeoJSON.kml(kmlDoc);
    // No zip here, but inline styles should still be on properties
    if (!gj || gj.type !== 'FeatureCollection') {
      throw new Error('Parsed KML did not produce a FeatureCollection');
    }
    return gj;
  }

  // Parses KML styles and styleMaps, assigning resolved color/width/icon properties
  applyKmlStyleToFeatures(geojson, zip) {
    if (!geojson || !geojson.features) return;
    // togeojson already resolves many styles to properties: stroke, stroke-width, stroke-opacity, fill, fill-opacity
    // For KML icons, map hrefs to an icon-id so we can register images and reference them in a symbol layer.
    geojson.features.forEach((f) => {
      const props = f.properties || {};
      // Icon style
      const href = props['icon'] || props['iconHref'] || props['icon-url'] || props['iconUrl'];
      if (href) {
        // normalize as icon-id; actual image loading is done later
        props['icon-id'] = href;
      }
      // KML color parsing (aabbggrr) to #rrggbb + opacity
      const kmlColor = props['kml-color'] || props['kmlColor'] || null;
      if (kmlColor && typeof kmlColor === 'string' && kmlColor.length === 8) {
        const a = parseInt(kmlColor.substring(0, 2), 16) / 255;
        const b = kmlColor.substring(2, 4);
        const g = kmlColor.substring(4, 6);
        const r = kmlColor.substring(6, 8);
        const hex = `#${r}${g}${b}`;
        if (!props.fill) props.fill = hex;
        if (props['fill-opacity'] == null) props['fill-opacity'] = a;
        if (!props.stroke) props.stroke = hex;
        if (props['stroke-opacity'] == null) props['stroke-opacity'] = a;
      }
      f.properties = props;
    });
  }

  collectIconUrls(geojson) {
    const set = new Map();
    if (!geojson || !geojson.features) return set;
    geojson.features.forEach((f) => {
      const props = f.properties || {};
      const href = props['icon-id'];
      if (href && !set.has(href)) set.set(href, href);
    });
    return set;
  }

  async ensureImages(iconMap) {
    const loadOne = (url) => new Promise((resolve) => {
      // Avoid errors from duplicate addImage
      try {
        if (this._map.hasImage && this._map.hasImage(url)) return resolve();
      } catch (_) {}
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (!this._map.hasImage || !this._map.hasImage(url)) {
            this._map.addImage(url, img, { pixelRatio: 2 });
          }
        } catch (_) {}
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
    const promises = [];
    iconMap.forEach((_, url) => promises.push(loadOne(url)));
    await Promise.all(promises);
  }

  appendListItem(layerId, name) {
    const list = this._container.querySelector('#kmz-upload-list');
    const li = document.createElement('li');
    li.id = `kmz-${layerId}`;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.addEventListener('change', (e) => this.toggleLayer(layerId, e.target.checked));

    const label = document.createElement('label');
    label.innerText = name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerText = 'Remove';
    removeBtn.style.marginTop = '8px';
    removeBtn.addEventListener('click', () => this.removeLayer(layerId));

    li.appendChild(input);
    li.appendChild(label);
    li.appendChild(removeBtn);
    list.appendChild(li);
  }

  toggleLayer(layerId, show) {
    const ids = [
      `${layerId}-fill`,
      `${layerId}-line`,
      `${layerId}-circle`,
      `${layerId}-symbol`
    ];
    ids.forEach((id) => {
      if (this._map.getLayer(id)) {
        this._map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
      }
    });
  }

  removeLayer(layerId) {
    // Remove layers
    ['fill', 'line', 'circle', 'symbol'].forEach((suffix) => {
      const id = `${layerId}-${suffix}`;
      if (this._map.getLayer(id)) {
        this._map.removeLayer(id);
      }
    });
    // Remove source
    const info = this.uploadedLayers.get(layerId);
    if (info && this._map.getSource(info.sourceId)) {
      this._map.removeSource(info.sourceId);
    }
    // Restore overridden layer visibility if it was hidden
    if (info && info.overriddenLayerId && this._map.getLayer(info.overriddenLayerId)) {
      this._map.setLayoutProperty(info.overriddenLayerId, 'visibility', 'visible');
    }
    this.uploadedLayers.delete(layerId);

    const li = this._container.querySelector(`#kmz-${layerId}`);
    if (li) li.remove();
  }

  fitToGeoJSON(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) return;
    const collection = featureCollection(geojson.features);
    const bounds = bbox(collection); // [minX, minY, maxX, maxY]
    this._map.fitBounds(bounds, { padding: 40 });
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export { KMZUploadControl };



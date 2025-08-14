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

      if (hasPolygons) {
        this.addLayerSafe({
          id: `${layerId}-fill`,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#ff0000',
            'fill-opacity': 0.3
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
            'line-color': '#ff0000',
            'line-width': 2
          },
          filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']]
        }, beforeId);
      }

      if (hasPoints) {
        this.addLayerSafe({
          id: `${layerId}-circle`,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-color': '#ff0000',
            'circle-radius': 5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1
          },
          filter: ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']]
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
    if (!gj || gj.type !== 'FeatureCollection') {
      throw new Error('Parsed KML did not produce a FeatureCollection');
    }
    return gj;
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
      `${layerId}-circle`
    ];
    ids.forEach((id) => {
      if (this._map.getLayer(id)) {
        this._map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
      }
    });
  }

  removeLayer(layerId) {
    // Remove layers
    ['fill', 'line', 'circle'].forEach((suffix) => {
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



class MapLayersControl {
  constructor(map, config) {
    this.map = map;
    this.config = config;
    this.layers = {};
    this.layerSources = {
      'business-parks': {
        name: 'Business Parks',
        url: './updated-business-parks.geojson',
        color: '#232d4b'
      },
      'data-centers': {
        name: 'Data Centers',
        url: './data-centers-2.geojson',
        color: '#45B7D1'
      },
      'onnet-buildings': {
        name: 'On-Net Buildings',
        url: './dqe-onnet-buildings.geojson',
        color: '#ffffff'
      }
    };
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl map-layers-wrapper';

    const card = document.createElement('div');
    card.className = 'map-layers-card';

    // Sections
    this.topEl = document.createElement('div');
    this.topEl.className = 'map-layers-card__top';
    this.topEl.innerHTML = 'Map Layers';
    
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
    this.middleEl.className = 'map-layers-card__middle';

    card.appendChild(this.topEl);
    card.appendChild(this.middleEl);

    this._container.appendChild(card);

    // Initial render
    this.renderLayers();

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }

  renderLayers() {
    this.middleEl.innerHTML = '';

    Object.entries(this.layerSources).forEach(([key, layerInfo]) => {
      const toggleGroup = this.createToggleGroup(key, layerInfo);
      this.middleEl.appendChild(toggleGroup);
    });
  }

  createToggleGroup(key, layerInfo) {
    const group = document.createElement('div');
    group.className = 'map-layers-card__toggle-group';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'map-layers-card__toggle-btn';
    toggleBtn.type = 'button';
    toggleBtn.addEventListener('click', () => this.toggleLayer(key, layerInfo, toggleBtn));

    const label = document.createElement('span');
    label.className = 'map-layers-card__label';
    label.textContent = layerInfo.name;

    const colorCircle = document.createElement('div');
    colorCircle.className = 'map-layers-card__color-circle';
    colorCircle.style.backgroundColor = layerInfo.color;

    group.appendChild(toggleBtn);
    group.appendChild(label);
    group.appendChild(colorCircle);

    return group;
  }

  async toggleLayer(key, layerInfo, toggleBtn) {
    const isActive = toggleBtn.classList.contains('active');
    
    if (isActive) {
      // Remove layer
      this.removeLayer(key);
      toggleBtn.classList.remove('active');
    } else {
      // Add layer
      await this.addLayer(key, layerInfo);
      toggleBtn.classList.add('active');
    }
  }

  async addLayer(key, layerInfo) {
    try {
      // Fetch GeoJSON data
      const response = await fetch(layerInfo.url);
      if (!response.ok) throw new Error('Failed to fetch layer data');
      const geojson = await response.json();

      // Add source to map
      this._map.addSource(key, {
        type: 'geojson',
        data: geojson
      });

      // Add layer to map
      this._map.addLayer({
        id: key,
        type: 'fill',
        source: key,
        paint: {
          'fill-color': layerInfo.color,
          'fill-opacity': 0.6,
          'fill-outline-color': layerInfo.color
        }
      });

      // Store layer info
      this.layers[key] = {
        source: key,
        layer: key,
        info: layerInfo
      };

    } catch (error) {
      console.error('Error adding layer:', error);
    }
  }

  removeLayer(key) {
    if (this.layers[key]) {
      // Remove layer from map
      if (this._map.getLayer(key)) {
        this._map.removeLayer(key);
      }
      
      // Remove source from map
      if (this._map.getSource(key)) {
        this._map.removeSource(key);
      }

      // Remove from stored layers
      delete this.layers[key];
    }
  }

  // Helper methods for collapse/expand functionality
  collapseCard() {
    this.topEl.classList.add('collapsed');
    this.middleEl.classList.add('collapsed');
  }

  expandCard() {
    this.topEl.classList.remove('collapsed');
    this.middleEl.classList.remove('collapsed');
  }
}

export { MapLayersControl };

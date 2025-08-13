class FeaturedPanelControl {
  constructor(featuredLayers, title, headerColor) {
    this.featuredLayers = featuredLayers;
    this.title = title;
    this.headerColor = headerColor;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl layers-filter active';

    let header = document.createElement('div');
    header.className = 'amc-map-header layers-filter-header';
    header.innerText = this.title ? this.title : 'Featured';

    if (this.headerColor) {
      header.style.backgroundColor = '#' + this.headerColor;
    }

    let content = document.createElement('div');
    content.className = 'layers-filter-content';

    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
    });

    content.innerText = this.featuredLayers.map(layer => layer['source-layer']).join(' | ');

    // Hide list by default on mobile
    if(window.innerWidth < 768) {
      this._container.classList.remove('active');
    }

    this._container.appendChild(header);
    this._container.appendChild(content);

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export { FeaturedPanelControl };
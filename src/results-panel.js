class ResultsPanelControl {
  constructor(title) {
    this.title = title;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl layers-filter active';
    this._container.style.display = 'none';

    let header = document.createElement('div');
    header.className = 'amc-map-header layers-filter-header';
    header.innerText = this.title ? this.title : 'Results'

    let mainList = document.createElement('ul');
    mainList.className = 'openlayers-layer-list';

    let content = document.createElement('div');
    content.className = 'layers-filter-content';
    content.appendChild(mainList);

    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
    });

    window.addEventListener('map:updatedResults', (event) => {
      this._container.style.display = 'block';
      let results = event.detail.results;

      // Remove all existing results
      mainList.querySelectorAll('li').forEach((li) => li.remove());

      // Append new results
      for (let i = 0; i < results.length; i++) {
        let li = document.createElement('li');
        li.id = 'result-' + i + '-' + event.detail.layerId.replaceAll(' ', '-');
        li.innerHTML = results[i];
        mainList.appendChild(li);
      }
    });

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

export { ResultsPanelControl };
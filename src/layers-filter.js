class LayersFilterControl {
  constructor(layers, title) {
    this.layers = layers;
    this.title = title;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl layers-filter active';

    let header = document.createElement('div');
    header.className = 'amc-map-header layers-filter-header';
    header.innerText = this.title ? this.title : 'Layers'

    let mainList = document.createElement('ul');
    mainList.className = 'openlayers-layer-list';

    // TODO:
    // Aggregate parent layers to create parent checkboxes
    let lists = this.layers.reduce((carry, layer) => {

      if (! layer.metadata?.layerGroup) return carry;

      if (carry[layer.metadata.layerGroup]) {
        carry[layer.metadata.layerGroup].layers.push(layer.id);

        return carry;
      }

      let list = document.createElement('ul');
      list.className = 'openlayers-layer-list openlayers-layer-sublist';
      
      let listContainer = document.createElement('div');
      listContainer.appendChild(list);

      // Create an item for it
      let li = document.createElement('li');
      li.id = `layer-${layer.metadata.layerGroup}`;
      li.className = 'openlayers-layer-group active';

      let span = document.createElement('span');
      span.className = 'openlayers-layer-group-title';

      let input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'group-checkbox-' + layer.metadata.layerGroup;
      
      input.addEventListener('change', (event) => {

        for (let i = 0; i < list.layers.length; i++) {
          map.setLayoutProperty(list.layers[i], 'visibility', event.target.checked ? 'visible' : 'none');

          // Find the layer input
          document.querySelector('input[id="checkbox-'+list.layers[i]+'"]').checked = event.target.checked;
        }
      });
      input.style.cursor = 'pointer';
      

      span.appendChild(input)
      li.appendChild(span);
      let text = document.createElement('label');
      text.htmlFor = input.id;
      text.innerText = layer.metadata.layerGroup;
      text.style.cursor = 'pointer';

      span.appendChild(text);
      
      span.addEventListener('click', () => {
        li.classList.toggle('active');
      });

      li.appendChild(listContainer);
      
      mainList.appendChild(li);

      list.layers = [layer.id];

      carry[layer.metadata.layerGroup] = list;

      return carry;
    }, {});

    for (let i = 0; i < this.layers.length; i++) {
      let layer = this.layers[i];

      let list = layer.metadata?.layerGroup
        ? lists[layer.metadata.layerGroup]
        : mainList;

      let li = document.createElement('li');
      li.id = `layer-${layer.id}`;
      let name = layer['source-layer'];
  
      let input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'checkbox-' + layer.id;
      let visibility = map.getLayoutProperty(layer.id, 'visibility');
      input.checked = visibility === 'visible' || !visibility;
  
      input.addEventListener('change', (event) => {
        let value = event.target.checked ? 'visible' : 'none';
        map.setLayoutProperty(layer.id, 'visibility', value);

        if (layer.metadata?.layerGroup) {
          document.querySelector('input[id="group-checkbox-'+ layer.metadata.layerGroup +'"]').checked = false;
        }
      });

      input.style.cursor = 'pointer';

      li.appendChild(input);
      let text = document.createElement('label');
      text.htmlFor = input.id;
      text.innerText = name ? name : `Layer ${index}`;

      text.style.cursor = 'pointer';

      li.appendChild(text);

      list.appendChild(li);
    }

    let content = document.createElement('div');
    content.className = 'layers-filter-content';
    content.appendChild(mainList);

    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
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

export { LayersFilterControl };
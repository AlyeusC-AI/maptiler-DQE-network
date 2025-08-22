import { ProximitySearch } from './proximity-search.js';
import { LayersFilterControl } from './layers-filter.js';
import bbox from '@turf/bbox';
import { featureCollection } from '@turf/helpers';
import './scss/styles.scss';
import { ResultsPanelControl } from './results-panel.js';
import { FeaturedPanelControl } from './featured-panel.js';
import { InstructionsPanelControl } from './instructions-panel.js';
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { Map as MapTilerMap, setRTLTextPlugin, Popup } from '@maptiler/sdk';
import { KMZUploadControl } from './kmz-upload.js';
import { AddressUploadControl } from './address-upload.js';
import { MultiAddressSearchControl } from './multi-address-search.js';
import { PluginSettingsControl } from './plugin-settings.js';
import { SearchCardControl } from './search-card.js';
import { MapLayersControl } from './map-layers-control.js';

class Map {
  constructor(config) {
    this.ignoredSources = ['openmaptiles', 'satellite'];

    this.config = config;

    this.layers = [];

    this.initialBounds;

    this.main();
  }

  async main() {
    // Retrieve variables
    this.config = await this.loadConfig();

    setRTLTextPlugin('https://cdn.maptiler.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js');

    let options = {
      container: this.config.target,
      style: this.config.styleUrl,
      center: [-96.11422, 37.5],
      geolocateControl: false
    }

    if (this.config.showNavigationControls === false) {
      options.navigationControl = false;
    }

    if (this.config.minZoom) {
      options.minZoom = this.config.minZoom;
    }

    let map = new MapTilerMap(options);

    if (this.config.controlZoom) {
      map.on('wheel', (event) => {
        if (! event.originalEvent.ctrlKey) {
          event.preventDefault();
        }
      });
    }

    if (this.config.maxBounds) {
      map.setMaxBounds(this.config.maxBounds);
    }

    map.on('load', () => {
      let layers = map.getStyle().layers.filter((layer) => {
        return layer.type !== 'background' && !layer.source.includes('maptiler_') && !this.ignoredSources.includes(layer.source);
      });

      this.layers = layers;

      let layersFilterList = [];
      let featuredLayers = [];
      for (const layer of layers) {
        if(!layer.metadata?.amcHideFromList && !layers.some((item) => item.metadata?.amcHoverLayer == layer.id)) {
          layersFilterList.push(layer);
        }

        if (layer.metadata?.featured) {
          featuredLayers.push(layer);
        }

        if (layer.metadata) {
          map.on('click', layer.id, (event) => {
            
            if (layer.metadata.amcPopupDescription) {
              new Popup()
                .setLngLat(event.lngLat)
                .setHTML(layer.metadata.amcPopupDescription)
                .addTo(map);
            }

            if (layer.metadata.results) {
              window.dispatchEvent(
                new CustomEvent('map:updatedResults', {
                  detail: {
                    layerId: layer.id,
                    results: layer.metadata.results
                  }
                })
              )
            }
          });        
        }

        if(layer.metadata?.amcHoverLayer) {
          map.setLayoutProperty(layer.metadata.amcHoverLayer, 'visibility', 'none');

          map.on('mouseenter', layer.id, () => {
            map.setLayoutProperty(layer.metadata.amcHoverLayer, 'visibility', 'visible');
          });
          map.on('mouseleave', layer.id, () => {
            map.setLayoutProperty(layer.metadata.amcHoverLayer, 'visibility', 'none');
          });
        }
      }

      if (this.config.controlZoom) {
        map.addControl(new InstructionsPanelControl);
      }

      if (this.config.showLayers === undefined || this.config.showLayers) {
        map.addControl(new LayersFilterControl(layersFilterList, this.config.layersTitle));
      }

      
      let features = this.getRelevantFeatures(map, layers);
      if (this.config.showProximitySearch === undefined || this.config.showProximitySearch) {
        map.addControl(new ProximitySearch(this.config.key, this.config.markerImage, features, this), 'top-left');
      }
      
      // if (featuredLayers.length) {
      //   map.addControl(new FeaturedPanelControl(featuredLayers, this.config.featuredTitle, this.config.featuredHeaderColor), 'top-left');
      // }
      
      if (this.config.showResults) {
        map.addControl(new ResultsPanelControl(this.config.resultsTitle), 'top-left');
      }

      // Plugin Settings Control (always visible)
      const pluginSettings = new PluginSettingsControl(this.config);
      map.addControl(pluginSettings, 'top-right');
      
      // Search Card (new primary UI)
      const searchCardControl = new SearchCardControl(map, this.config, (m) => this.getRelevantFeatures(m), (m) => this.resetMapBounds(m));
      map.addControl(searchCardControl, 'top-left');

      // Map Layers Control
      const mapLayersControl = new MapLayersControl(map, this.config);
      map.addControl(mapLayersControl, 'top-left');

      // Feature 1: KMZ upload control (conditional)
      const kmzControl = new KMZUploadControl();
      map.addControl(kmzControl, 'top-right');
      
      // Feature 2: Address upload control (conditional)
      const addressControl = new AddressUploadControl(map, this.config);
      map.addControl(addressControl, 'top-left');
      
      // Feature 3: Multi-address search control (conditional)
      const multiAddressControl = new MultiAddressSearchControl(map, this.config);
      map.addControl(multiAddressControl, 'top-left');
      
      // Set up feature toggling based on settings
      pluginSettings.addObserver((feature, enabled) => {
        switch (feature) {
          case 'search-card':
            searchCardControl._container.style.display = enabled ? 'block' : 'none';
            break;
          case 'map-layers':
            mapLayersControl._container.style.display = enabled ? 'block' : 'none';
            break;
          case 'kmz-upload':
            kmzControl._container.style.display = enabled ? 'block' : 'none';
            break;
          case 'address-upload':
            addressControl._container.style.display = enabled ? 'block' : 'none';
            break;
          case 'multi-address-search':
            multiAddressControl._container.style.display = enabled ? 'block' : 'none';
            break;
        }
      });
      
      // Apply initial settings
      if (!pluginSettings.isFeatureEnabled('search-card')) {
        searchCardControl._container.style.display = 'none';
      }
      if (!pluginSettings.isFeatureEnabled('map-layers')) {
        mapLayersControl._container.style.display = 'none';
      }
      if (!pluginSettings.isFeatureEnabled('kmz-upload')) {
        kmzControl._container.style.display = 'none';
      }
      if (!pluginSettings.isFeatureEnabled('address-upload')) {
        addressControl._container.style.display = 'none';
      }
      if (!pluginSettings.isFeatureEnabled('multi-address-search')) {
        multiAddressControl._container.style.display = 'none';
      }

      this.setMapBounds(map, features);
    });
  }

  getRelevantFeatures(map) {
    return this.layers.reduce((carry, layer) => {
      let features = map.querySourceFeatures(layer.source, { sourceLayer: layer['source-layer'] });
      carry = carry.concat(features);

      return carry;
    }, [])
  }

  setMapBounds(map, features) {
    // Build feature collection
    let collection = featureCollection(features);

    // Get bounds from turf
    let bounds = bbox(collection);

    // Fit map to bounds
    map.fitBounds(bounds, { padding: 50 });

    this.initialBounds = bounds;
  }

  resetMapBounds(map) {
    map.fitBounds(this.initialBounds, { padding: 50 });
  }

  loadConfig() {
    return this.config;
  }
}

export { Map };

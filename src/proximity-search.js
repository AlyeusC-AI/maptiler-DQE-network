import nearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString } from "@turf/helpers";
import { Loader } from "@googlemaps/js-api-loader";
import { LngLatBounds, Marker } from "@maptiler/sdk";

class ProximitySearch {
  constructor(key, markerImage, features, main) {
    this.key = key;
    this.main = main;
    this.markerImage = markerImage ? markerImage : 'dist/img/marker-location.svg';
    this.initialFeatures = features;
    this.addressMarker;
    this.networkMarker;

    this.currentCoordinates;
    this.networkPoint;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl proximity-search active';

    let header = document.createElement('div');
    header.className = 'amc-map-header proximity-filter-header';
    header.innerText = 'Check Address';
    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
    });

    let distance = document.createElement('div');
    distance.id = 'proximity_distance';

    let content = document.createElement('div');
    content.className = 'proximity-filter-content';

    let footer = document.createElement('div');
    footer.className = 'proximity-filter-footer';
    footer.innerHTML = '<div class="label">Key: </div><div class="your-search">Your Search</div><div class="closest-point">Closest Point On Network</div>';

    this._container.appendChild(header);
    this._container.appendChild(content);

    if (this.main.config.googleKey) {

      const loader = new Loader({
        apiKey: this.main.config.googleKey,
        libraries: ['core', 'places', 'maps']
      })

      let googleInputContainer = document.createElement('div');
      googleInputContainer.className = 'google-input-container';

      content.appendChild(googleInputContainer);

      let input = document.createElement('input');
      input.type = 'search';
      input.addEventListener('input', (event) => {
        if (event.target.value) {
          return;
        }

        this.resetMap();
      });

      googleInputContainer.appendChild(input);
      loader
        .importLibrary("places")
        .then((places) => {
          let autocomplete = new places.Autocomplete(input, {
            componentRestrictions: { country: 'us' },
            fields: ["geometry"]
          });

          autocomplete.addListener('place_changed', () => {
            let place = autocomplete.getPlace();

            this.currentCoordinates = [place.geometry.location.lng(), place.geometry.location.lat()];

            this.searching = true;

            this.getNearestFeatureAndAdjustMap([place.geometry.location.lng(), place.geometry.location.lat()], this.initialFeatures, true);
          });
        });
    } else {
      let geocoderNew = new maptilerGeocoder.GeocodingControl({
        apiKey: this.key,
        target: content,
        autocomplete: true,
        country: ['US', 'CA', 'MX'],
        fuzzyMatch: false,
      });

      geocoderNew.addEventListener("pick", (event) => {
        if (!event.detail) {
          this.resetMap();
          return;
        };

        if (this.searching) {
          return;
        }

        this.currentCoordinates = event.detail.center;

        this.searching = true;

        this.getNearestFeatureAndAdjustMap(event.detail.center, this.initialFeatures, true);
      });
    }

    this._map.on('zoomend', (event) => {
      if (!this.currentCoordinates || event.stopHere) return;

      let features = this.main.getRelevantFeatures(this._map);
      if (! this.searching) {
        this.getNearestFeature(this.currentCoordinates, features)
          .then(() => {
            this.placeNetworkMarker();
          })
        return;
      }

      this.getNearestFeatureAndAdjustMap(this.currentCoordinates, features, false, true)
        .then(() => {
          this.placeNetworkMarker()
          this.searching = false;
        });
    })

    content.appendChild(distance);
    content.appendChild(footer);

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }

  getNearestFeature(coordinates, features = null) {
    return new Promise((resolve) => {
      let points = [];
      for (let i = 0; i < features.length; i++) {
        let feature = features[i];
        let featureLineString = feature;
        if (!feature.geometry.type.includes('LineString')) {
          featureLineString = lineString([feature.geometry.coordinates, feature.geometry.coordinates]);
        }
        points.push(nearestPointOnLine(featureLineString, coordinates, { units: 'miles' }));
      }

      if (!points.length) {
        resolve();
        return;
      };

      points.sort((a, b) => {
        return a.properties.dist - b.properties.dist;
      });

      if (this.addressMarker) {
        this.addressMarker.remove();
      }

      if (this.networkMarker) {
        this.networkMarker.remove();
      }

      let addressMarkerEl = document.createElement('div');
      addressMarkerEl.className = 'amc-map-marker';
      addressMarkerEl.style.backgroundImage = `url('${this.markerImage}')`;

      this.addressMarker = new Marker(addressMarkerEl)
        .setLngLat(coordinates)
        .addTo(this._map);

      this.networkPoint = points[0];
      resolve(points[0].geometry.coordinates);
    });
  }

  resetMap() {
    document.getElementById('proximity_distance').innerHTML = '';
    this.currentCoordinates = null;
    this.main.resetMapBounds(this._map);
    this.addressMarker.remove();
    this.networkPoint = null;
    if (this.networkMarker) {
      this.networkMarker.remove();
      this.networkMarker = null;
    }
  }

  getNearestFeatureAndAdjustMap(coordinates, features, initialCall = false, stopHere = false) {
    return this.getNearestFeature(coordinates, features)
      .then((networkCoordinates) => {
        if (!networkCoordinates) return;

        let bounds = new LngLatBounds();

        bounds.extend(this.currentCoordinates);
        bounds.extend(networkCoordinates);

        this._map.fitBounds(bounds, {
          padding: 200,
          center: bounds.getCenter(),
        }, {
          initialCall,
          stopHere
        });
      });
  }

  placeNetworkMarker() {
    if (this.networkMarker) {
      this.networkMarker.remove();
    }

    let networkMarkerEl = document.createElement('div');
    networkMarkerEl.className = 'amc-map-marker';
    networkMarkerEl.style.backgroundImage = `url('dist/img/marker-network.svg')`;

    this.networkMarker = new Marker(networkMarkerEl)
      .setLngLat(this.networkPoint.geometry.coordinates)
      .addTo(this._map);
    
    document.getElementById('proximity_distance').innerHTML = `<span>Network Distance:</span> ${this.networkPoint.properties.dist.toFixed(2)} miles`;
  }
}

export { ProximitySearch };

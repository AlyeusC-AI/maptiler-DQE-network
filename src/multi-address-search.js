import { Popup, Marker, LngLatBounds } from '@maptiler/sdk';

class MultiAddressSearchControl {
  constructor(map, config) {
    this.map = map;
    this.config = config;
    this.addressList = [];
    this.markers = [];
    this.distanceCalculations = [];
    this.referenceLocation = null;
    this.referenceMarker = null;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl layers-filter active';
    
    const header = document.createElement('div');
    header.className = 'amc-map-header layers-filter-header';
    header.innerText = 'Multi-Address Search';
    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
    });

    const content = document.createElement('div');
    content.className = 'layers-filter-content';

    // Address input section
    const inputSection = document.createElement('div');
    inputSection.style.marginBottom = '15px';
    
    // Instructions
    const instructions = document.createElement('div');
    instructions.style.background = '#e3f2fd';
    instructions.style.padding = '8px';
    instructions.style.marginBottom = '10px';
    instructions.style.borderRadius = '3px';
    instructions.style.fontSize = '12px';
    instructions.style.color = '#1976d2';
    instructions.innerHTML = '<strong>Tip:</strong> Click anywhere on the map to set a reference point for distance calculations.';
    
    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    inputContainer.style.gap = '5px';
    inputContainer.style.marginBottom = '10px';

    const addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.id = 'multi-address-input';
    addressInput.placeholder = 'Enter address...';
    addressInput.style.flex = '1';
    addressInput.style.padding = '8px';
    addressInput.style.border = '1px solid #ced4da';
    addressInput.style.borderRadius = '4px';
    addressInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addAddress();
    });

    const addBtn = document.createElement('button');
    addBtn.innerText = 'Add';
    addBtn.style.padding = '8px 16px';
    addBtn.style.backgroundColor = '#007bff';
    addBtn.style.color = 'white';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '4px';
    addBtn.style.cursor = 'pointer';
    addBtn.addEventListener('click', () => this.addAddress());

    inputContainer.appendChild(addressInput);
    inputContainer.appendChild(addBtn);

    // Address list
    const listContainer = document.createElement('div');
    listContainer.id = 'multi-address-list';
    listContainer.style.maxHeight = '200px';
    listContainer.style.overflowY = 'auto';
    listContainer.style.marginBottom = '10px';

    // Distance information
    const distanceInfo = document.createElement('div');
    distanceInfo.id = 'distance-info';
    distanceInfo.style.background = '#f8f9fa';
    distanceInfo.style.padding = '10px';
    distanceInfo.style.marginBottom = '10px';
    distanceInfo.style.borderRadius = '3px';
    distanceInfo.style.borderLeft = '3px solid #007bff';
    distanceInfo.style.display = 'none';

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginBottom = '10px';

    const expandBtn = document.createElement('button');
    expandBtn.innerText = 'Expand Map to All Points';
    expandBtn.style.flex = '1';
    expandBtn.style.padding = '8px';
    expandBtn.style.backgroundColor = '#28a745';
    expandBtn.style.color = 'white';
    expandBtn.style.border = 'none';
    expandBtn.style.borderRadius = '4px';
    expandBtn.style.cursor = 'pointer';
    expandBtn.addEventListener('click', () => this.expandMapToAllPoints());

    const clearBtn = document.createElement('button');
    clearBtn.innerText = 'Clear List';
    clearBtn.style.flex = '1';
    clearBtn.style.padding = '8px';
    clearBtn.style.backgroundColor = '#dc3545';
    clearBtn.style.color = 'white';
    clearBtn.style.border = 'none';
    clearBtn.style.borderRadius = '4px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.addEventListener('click', () => this.clearAddressList());

    buttonContainer.appendChild(expandBtn);
    buttonContainer.appendChild(clearBtn);

    inputSection.appendChild(instructions);
    inputSection.appendChild(inputContainer);
    inputSection.appendChild(listContainer);
    inputSection.appendChild(distanceInfo);
    inputSection.appendChild(buttonContainer);

    content.appendChild(inputSection);

    // Hide list by default on mobile
    if (window.innerWidth < 768) {
      this._container.classList.remove('active');
    }

    this._container.appendChild(header);
    this._container.appendChild(content);
    
    // Add click event listener to the map for setting reference location
    this._map.on('click', (e) => this.handleMapClick(e));
    
    return this._container;
  }

  async addAddress() {
    const input = this._container.querySelector('#multi-address-input');
    const address = input.value.trim();
    
    if (!address) return;
    
    try {
      const geocoded = await this.geocodeAddress(address);
      if (geocoded) {
        this.addressList.push(geocoded);
        this.updateAddressList();
        this.addMarkerToMap(geocoded);
        this.calculateDistances();
        input.value = '';
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Could not geocode address. Please try again.');
    }
  }

  async geocodeAddress(address) {
    try {
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${this.config.key}&country=US&limit=1`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return {
          address: address,
          coordinates: data.features[0].center,
          geometry: data.features[0].geometry,
          place_name: data.features[0].place_name,
          confidence: data.features[0].relevance,
          index: this.addressList.length + 1
        };
      } else {
        throw new Error('No results found');
      }
    } catch (error) {
      throw error;
    }
  }

  updateAddressList() {
    const listContainer = this._container.querySelector('#multi-address-list');
    listContainer.innerHTML = '';
    
    if (this.addressList.length === 0) {
      listContainer.innerHTML = '<div style="color: #666; font-style: italic;">No addresses added</div>';
      return;
    }
    
    this.addressList.forEach((addr, index) => {
      const addrDiv = document.createElement('div');
      addrDiv.className = 'multi-address-item';
      addrDiv.style.display = 'flex';
      addrDiv.style.justifyContent = 'space-between';
      addrDiv.style.alignItems = 'center';
      addrDiv.style.padding = '8px 0';
      addrDiv.style.borderBottom = '1px solid #eee';
      
      const addressText = addr.address;
      const placeName = addr.place_name ? `<div style="font-size: 12px; color: #666;">${addr.place_name}</div>` : '';
      
      const removeBtn = document.createElement('button');
      removeBtn.innerText = 'Remove';
      removeBtn.style.background = '#dc3545';
      removeBtn.style.color = 'white';
      removeBtn.style.border = 'none';
      removeBtn.style.padding = '4px 8px';
      removeBtn.style.borderRadius = '3px';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.fontSize = '11px';
      removeBtn.addEventListener('click', () => this.removeAddress(index));
      
      addrDiv.innerHTML = `
        <div style="flex: 1;">
          <div style="font-weight: bold;">${addr.index}. ${addressText}</div>
          ${placeName}
        </div>
      `;
      
      addrDiv.appendChild(removeBtn);
      
      listContainer.appendChild(addrDiv);
    });
  }

  addMarkerToMap(address) {
    // Create marker element - different from Feature 2 (square instead of circle)
    const markerEl = document.createElement('div');
    markerEl.className = 'amc-map-marker';
    markerEl.style.width = '18px';
    markerEl.style.height = '18px';
    markerEl.style.backgroundColor = '#ff6b35'; // Orange color to distinguish from Feature 2
    markerEl.style.borderRadius = '3px'; // Square with rounded corners
    markerEl.style.border = '2px solid white';
    markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    markerEl.style.cursor = 'pointer';
    
    // Create popup content
    const popupContent = `
      <div style="padding: 10px; min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Address ${address.index}</h4>
        <p style="margin: 0 0 5px 0; font-weight: bold;">${address.address}</p>
        <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">${address.place_name || ''}</p>
        <p style="margin: 0; color: #999; font-size: 11px;">Confidence: ${Math.round((address.confidence || 0) * 100)}%</p>
      </div>
    `;
    
    // Create popup
    const popup = new Popup({ offset: 25 }).setHTML(popupContent);
    
    // Create and add marker
    const marker = new Marker(markerEl)
      .setLngLat(address.coordinates)
      .setPopup(popup)
      .addTo(this._map);
    
    this.markers.push(marker);
  }

  calculateDistances() {
    if (this.addressList.length === 0) {
      this.hideDistanceInfo();
      return;
    }
    
    this.distanceCalculations = [];
    
    if (this.referenceLocation && this.addressList.length > 0) {
      // Calculate distances from reference location to all addresses
      this.addressList.forEach((addr, index) => {
        const distance = this.calculateDistance(
          this.referenceLocation,
          addr.coordinates
        );
        
        this.distanceCalculations.push({
          from: 'Reference Point',
          to: addr.address,
          distance: distance,
          fromIndex: 'R',
          toIndex: index + 1
        });
      });
    } else if (this.addressList.length >= 2) {
      // Calculate distances between all pairs of addresses (fallback)
      for (let i = 0; i < this.addressList.length; i++) {
        for (let j = i + 1; j < this.addressList.length; j++) {
          const distance = this.calculateDistance(
            this.addressList[i].coordinates,
            this.addressList[j].coordinates
          );
          
          this.distanceCalculations.push({
            from: this.addressList[i].address,
            to: this.addressList[j].address,
            distance: distance,
            fromIndex: i + 1,
            toIndex: j + 1
          });
        }
      }
    }
    
    this.updateDistanceInfo();
  }

  calculateDistance(coord1, coord2) {
    const R = 3959; // Earth's radius in miles
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  updateDistanceInfo() {
    const infoContainer = this._container.querySelector('#distance-info');
    
    if (this.distanceCalculations.length === 0) {
      this.hideDistanceInfo();
      return;
    }
    
    const totalDistance = this.distanceCalculations.reduce((sum, calc) => sum + calc.distance, 0);
    const avgDistance = totalDistance / this.distanceCalculations.length;
    
    let infoHTML = '';
    
    if (this.referenceLocation) {
      // Show distances from reference point
      const shortest = this.distanceCalculations.reduce((min, calc) => calc.distance < min.distance ? calc : min);
      const longest = this.distanceCalculations.reduce((max, calc) => calc.distance > max.distance ? calc : max);
      
      infoHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">Distance from Reference Point:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
          <div>
            <strong>Total Distance:</strong> ${totalDistance.toFixed(2)} miles<br>
            <strong>Average Distance:</strong> ${avgDistance.toFixed(2)} miles<br>
            <strong>Number of Addresses:</strong> ${this.addressList.length}
          </div>
          <div>
            <strong>Closest Address:</strong> ${shortest.distance.toFixed(2)} miles<br>
            <strong>Farthest Address:</strong> ${longest.distance.toFixed(2)} miles<br>
            <strong>Reference Set:</strong> Yes
          </div>
        </div>
        <div style="font-size: 11px; color: #666;">
          <strong>Closest:</strong> ${shortest.toIndex} (${shortest.to})<br>
          <strong>Farthest:</strong> ${longest.toIndex} (${longest.to})
        </div>
      `;
    } else {
      // Show distances between address pairs
      const shortest = this.distanceCalculations.reduce((min, calc) => calc.distance < min.distance ? calc : min);
      const longest = this.distanceCalculations.reduce((max, calc) => calc.distance > max.distance ? calc : max);
      
      infoHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">Distance Analysis:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
          <div>
            <strong>Total Distance:</strong> ${totalDistance.toFixed(2)} miles<br>
            <strong>Average Distance:</strong> ${avgDistance.toFixed(2)} miles<br>
            <strong>Number of Routes:</strong> ${this.distanceCalculations.length}
          </div>
          <div>
            <strong>Shortest Route:</strong> ${shortest.distance.toFixed(2)} miles<br>
            <strong>Longest Route:</strong> ${longest.distance.toFixed(2)} miles<br>
            <strong>Addresses:</strong> ${this.addressList.length}
          </div>
        </div>
        <div style="font-size: 11px; color: #666;">
          <strong>Shortest:</strong> ${shortest.fromIndex} → ${shortest.toIndex} (${shortest.from} to ${shortest.to})<br>
          <strong>Longest:</strong> ${longest.fromIndex} → ${longest.toIndex} (${longest.from} to ${longest.to})
        </div>
      `;
    }
    
    infoContainer.innerHTML = infoHTML;
    infoContainer.style.display = 'block';
  }

  hideDistanceInfo() {
    const infoContainer = this._container.querySelector('#distance-info');
    if (infoContainer) {
      infoContainer.style.display = 'none';
    }
  }

  expandMapToAllPoints() {
    if (this.markers.length === 0) return;
    
    const bounds = new LngLatBounds();
    this.markers.forEach(marker => {
      bounds.extend(marker.getLngLat());
    });
    
    // Include reference location if exists
    if (this.referenceLocation) {
      bounds.extend(this.referenceLocation);
    }
    
    this._map.fitBounds(bounds, { padding: 50 });
  }

  calculateDistancesFromReference() {
    if (!this.referenceLocation || this.addressList.length === 0) {
      return;
    }
    
    this.distanceCalculations = [];
    
    // Calculate distances from reference location to all addresses
    this.addressList.forEach((addr, index) => {
      const distance = this.calculateDistance(
        this.referenceLocation,
        addr.coordinates
      );
      
      this.distanceCalculations.push({
        from: 'Reference Point',
        to: addr.address,
        distance: distance,
        fromIndex: 'R',
        toIndex: index + 1
      });
    });
    
    this.updateDistanceInfo();
  }

  removeAddress(index) {
    // Remove marker
    if (this.markers[index]) {
      this.markers[index].remove();
      this.markers.splice(index, 1);
    }
    
    // Remove from address list
    this.addressList.splice(index, 1);
    
    // Update indices for remaining addresses
    this.addressList.forEach((addr, i) => {
      addr.index = i + 1;
    });
    
    this.updateAddressList();
    this.calculateDistances();
  }

  clearAddressList() {
    this.addressList = [];
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
    this.distanceCalculations = [];
    
    // Clear reference location
    if (this.referenceMarker) {
      this.referenceMarker.remove();
      this.referenceMarker = null;
    }
    this.referenceLocation = null;
    
    this.updateAddressList();
    this.hideDistanceInfo();
  }

  handleMapClick(e) {
    // Remove previous reference marker if exists
    if (this.referenceMarker) {
      this.referenceMarker.remove();
    }
    
    // Set new reference location
    this.referenceLocation = e.lngLat.toArray();
    
    // Create red circle marker for reference location
    const markerEl = document.createElement('div');
    markerEl.style.width = '24px';
    markerEl.style.height = '24px';
    markerEl.style.backgroundColor = '#dc3545'; // Red color
    markerEl.style.borderRadius = '50%';
    markerEl.style.border = '3px solid white';
    markerEl.style.boxShadow = '0 3px 6px rgba(0,0,0,0.4)';
    markerEl.style.cursor = 'pointer';
    
    // Create popup for reference location
    const popupContent = `
      <div style="padding: 10px; min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Reference Point</h4>
        <p style="margin: 0 0 5px 0; font-weight: bold;">Lat: ${e.lngLat.lat.toFixed(6)}</p>
        <p style="margin: 0; color: #666; font-size: 12px;">Lng: ${e.lngLat.lng.toFixed(6)}</p>
      </div>
    `;
    
    const popup = new Popup({ offset: 25 }).setHTML(popupContent);
    
    // Add reference marker to map
    this.referenceMarker = new Marker(markerEl)
      .setLngLat(e.lngLat)
      .setPopup(popup)
      .addTo(this._map);
    
    // Recalculate distances if addresses exist
    if (this.addressList.length > 0) {
      this.calculateDistancesFromReference();
    }
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export { MultiAddressSearchControl };

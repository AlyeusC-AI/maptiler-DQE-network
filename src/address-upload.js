import { Popup, Marker, LngLatBounds } from '@maptiler/sdk';

class AddressUploadControl {
  constructor(map, config) {
    this.map = map;
    this.config = config;
    this.addresses = [];
    this.markers = [];
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl layers-filter active';
    
    const header = document.createElement('div');
    header.className = 'amc-map-header layers-filter-header';
    header.innerText = 'Address Upload';
    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
    });

    const content = document.createElement('div');
    content.className = 'layers-filter-content';

    // File upload section
    const fileSection = document.createElement('div');
    fileSection.style.marginBottom = '15px';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.txt';
    fileInput.id = 'csv-upload';
    fileInput.style.width = '100%';
    fileInput.style.marginBottom = '10px';
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    const fileLabel = document.createElement('label');
    fileLabel.htmlFor = 'csv-upload';
    fileLabel.innerText = 'Upload CSV with addresses:';
    fileLabel.style.display = 'block';
    fileLabel.style.marginBottom = '5px';
    fileLabel.style.fontWeight = 'bold';

    fileSection.appendChild(fileLabel);
    fileSection.appendChild(fileInput);

    // Address list
    const listContainer = document.createElement('div');
    listContainer.id = 'address-list';
    listContainer.style.maxHeight = '200px';
    listContainer.style.overflowY = 'auto';
    listContainer.style.marginBottom = '10px';

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginBottom = '10px';

    const geocodeBtn = document.createElement('button');
    geocodeBtn.innerText = 'Geocode Addresses';
    geocodeBtn.style.flex = '1';
    geocodeBtn.style.padding = '8px';
    geocodeBtn.style.backgroundColor = '#007bff';
    geocodeBtn.style.color = 'white';
    geocodeBtn.style.border = 'none';
    geocodeBtn.style.borderRadius = '4px';
    geocodeBtn.style.cursor = 'pointer';
    geocodeBtn.addEventListener('click', () => this.geocodeAddresses());

    const clearBtn = document.createElement('button');
    clearBtn.innerText = 'Clear All';
    clearBtn.style.flex = '1';
    clearBtn.style.padding = '8px';
    clearBtn.style.backgroundColor = '#dc3545';
    clearBtn.style.color = 'white';
    clearBtn.style.border = 'none';
    clearBtn.style.borderRadius = '4px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.addEventListener('click', () => this.clearAllAddresses());

    buttonContainer.appendChild(geocodeBtn);
    buttonContainer.appendChild(clearBtn);

    // Status display
    const statusDiv = document.createElement('div');
    statusDiv.id = 'address-status';
    statusDiv.style.fontSize = '12px';
    statusDiv.style.color = '#666';
    statusDiv.style.marginBottom = '10px';

    // Legend for status colors
    const legendDiv = document.createElement('div');
    legendDiv.id = 'status-legend';
    legendDiv.style.marginBottom = '15px';
    legendDiv.style.padding = '10px';
    legendDiv.style.backgroundColor = '#f8f9fa';
    legendDiv.style.borderRadius = '4px';
    legendDiv.style.fontSize = '11px';
    
    legendDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">Status Legend:</div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 12px; height: 12px; background-color: #28a745; border-radius: 50%;"></div>
          <span>Fiber Ready</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 12px; height: 12px; background-color: #ffc107; border-radius: 50%;"></div>
          <span>Existing Lit</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 12px; height: 12px; background-color: #17a2b8; border-radius: 50%;"></div>
          <span>Diverse Entrances</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 12px; height: 12px; background-color: #6f42c1; border-radius: 50%;"></div>
          <span>Type 1</span>
        </div>
      </div>
    `;

    // Statistics display
    const statsDiv = document.createElement('div');
    statsDiv.id = 'address-stats';
    statsDiv.style.marginBottom = '10px';
    statsDiv.style.padding = '8px';
    statsDiv.style.backgroundColor = '#e9ecef';
    statsDiv.style.borderRadius = '4px';
    statsDiv.style.fontSize = '11px';
    statsDiv.style.display = 'none'; // Hidden until data is loaded

    content.appendChild(fileSection);
    content.appendChild(statusDiv);
    content.appendChild(legendDiv);
    content.appendChild(statsDiv);
    content.appendChild(listContainer);
    content.appendChild(buttonContainer);

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
      this.updateStatus('Parsing CSV file...');
      const addresses = await this.parseCSV(file);
      this.addresses = addresses;
      this.updateAddressList();
      this.updateStatus(`Loaded ${addresses.length} addresses. Click "Geocode Addresses" to process.`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.updateStatus('Error parsing CSV file. Please check the file format.');
    }
  }

  async parseCSV(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const addresses = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const address = {};
          headers.forEach((header, headerIndex) => {
            address[header] = values[headerIndex] || '';
          });
          address.index = index + 1;
          
          // Build a searchable address string for geocoding
          address.searchAddress = this.buildSearchAddress(address);
          
          return address;
        }).filter(addr => {
          // Filter out empty rows and ensure we have some address data
          const hasAddress = addr['Structure Address'] || addr.address || addr.street || addr.location || addr.name;
          return hasAddress && Object.values(addr).some(val => val && val.trim());
        });
        
        resolve(addresses);
      };
      reader.readAsText(file);
    });
  }

  buildSearchAddress(addressData) {
    // Build a comprehensive address string for better geocoding
    const parts = [];
    
    // Add structure address if available
    if (addressData['Structure Address']) {
      parts.push(addressData['Structure Address']);
    }
    
    // Add city if available
    if (addressData['Structure City']) {
      parts.push(addressData['Structure City']);
    }
    
    // Add state if available
    if (addressData['Structure State']) {
      parts.push(addressData['Structure State']);
    }
    
    // Add ZIP if available
    if (addressData['Structure Zip Code']) {
      parts.push(addressData['Structure Zip Code']);
    }
    
    return parts.join(', ');
  }

  getStatusColor(status) {
    if (!status) return '#007bff'; // Default blue
    
    // Color coding based on structure status
    if (status.includes('Fiber Ready')) {
      return '#28a745'; // Green for fiber ready
    } else if (status.includes('Existing Lit')) {
      return '#ffc107'; // Yellow for existing lit
    } else if (status.includes('Diverse Entrances')) {
      return '#17a2b8'; // Cyan for diverse entrances
    } else if (status.includes('Type 1')) {
      return '#6f42c1'; // Purple for type 1
    } else {
      return '#007bff'; // Default blue for other statuses
    }
  }

  updateStatistics() {
    const statsDiv = this._container.querySelector('#address-stats');
    if (!statsDiv) return;

    if (this.addresses.length === 0) {
      statsDiv.style.display = 'none';
      return;
    }

    // Count structures by status
    const statusCounts = {};
    const stateCounts = {};
    let totalGeocoded = 0;

    this.addresses.forEach(addr => {
      const status = addr['Structure Status'] || 'Unknown';
      const state = addr['Structure State'] || 'Unknown';
      
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      stateCounts[state] = (stateCounts[state] || 0) + 1;
      
      if (addr.geocoded) totalGeocoded++;
    });

    // Build statistics HTML
    let statsHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">Statistics:</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <strong>Total Structures:</strong> ${this.addresses.length}<br>
          <strong>Geocoded:</strong> ${totalGeocoded}<br>
          <strong>Success Rate:</strong> ${Math.round((totalGeocoded / this.addresses.length) * 100)}%
        </div>
        <div>
          <strong>States:</strong> ${Object.keys(stateCounts).length}<br>
          <strong>Status Types:</strong> ${Object.keys(statusCounts).length}
        </div>
      </div>
    `;

    // Add top statuses
    const topStatuses = Object.entries(statusCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (topStatuses.length > 0) {
      statsHTML += `
        <div style="margin-top: 8px; font-weight: bold;">Top Statuses:</div>
        <div style="font-size: 10px;">
          ${topStatuses.map(([status, count]) => 
            `${status}: ${count}`
          ).join(' | ')}
        </div>
      `;
    }

    statsDiv.innerHTML = statsHTML;
    statsDiv.style.display = 'block';
  }

  updateAddressList() {
    const listContainer = this._container.querySelector('#address-list');
    listContainer.innerHTML = '';
    
    if (this.addresses.length === 0) {
      listContainer.innerHTML = '<div style="color: #666; font-style: italic;">No addresses loaded</div>';
      return;
    }
    
           this.addresses.forEach((addr, index) => {
         const addrDiv = document.createElement('div');
         addrDiv.className = 'address-item';
         addrDiv.style.display = 'flex';
         addrDiv.style.justifyContent = 'space-between';
         addrDiv.style.alignItems = 'center';
         addrDiv.style.padding = '8px 0';
         addrDiv.style.borderBottom = '1px solid #eee';
         
         // Display structure address or fallback to other address fields
         const addressText = addr['Structure Address'] || addr.address || addr.street || addr.location || addr.name || `Address ${index + 1}`;
         const cityState = addr['Structure City'] && addr['Structure State'] ? `${addr['Structure City']}, ${addr['Structure State']}` : '';
         const status = addr.geocoded ? '✓' : 'Pending';
         const statusColor = addr.geocoded ? '#28a745' : '#ffc107';
         
         addrDiv.innerHTML = `
           <div style="flex: 1;">
             <div style="font-weight: bold;">${addressText}</div>
             ${cityState ? `<div style="font-size: 12px; color: #666;">${cityState}</div>` : ''}
           </div>
           <span style="color: ${statusColor}; font-weight: bold; margin-left: 10px;">${status}</span>
         `;
         
         listContainer.appendChild(addrDiv);
       });
  }

  updateStatus(message) {
    const statusDiv = this._container.querySelector('#address-status');
    statusDiv.innerText = message;
  }

  async geocodeAddresses() {
    if (this.addresses.length === 0) {
      this.updateStatus('No addresses to geocode.');
      return;
    }

    this.updateStatus('Starting geocoding...');
    
    try {
      // Process addresses in batches (Maptiler has rate limits)
      const batchSize = 10;
      let processed = 0;
      
      for (let i = 0; i < this.addresses.length; i += batchSize) {
        const batch = this.addresses.slice(i, i + batchSize);
        await this.geocodeBatch(batch);
        processed += batch.length;
        this.updateStatus(`Geocoded ${processed}/${this.addresses.length} addresses...`);
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < this.addresses.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      this.updateStatus(`Geocoding complete! ${this.addresses.filter(a => a.geocoded).length} addresses processed.`);
      this.updateAddressList();
      this.addMarkersToMap();
      this.updateStatistics();
      
    } catch (error) {
      console.error('Geocoding error:', error);
      this.updateStatus(`Geocoding error: ${error.message}`);
    }
  }

  async geocodeBatch(addresses) {
    // Process each address individually (Maptiler's free tier doesn't support true batch)
    for (let i = 0; i < addresses.length; i++) {
      try {
        const addr = addresses[i];
        
        // Use the built search address for better geocoding results
        const searchQuery = addr.searchAddress || addr['Structure Address'] || addr.address || addr.street || addr.location || addr.name;
        
        if (!searchQuery || searchQuery.trim() === '') {
          addr.geocoded = false;
          addr.error = 'No address data';
          continue;
        }
        
        const response = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(searchQuery)}.json?key=${this.config.key}&country=US&limit=1`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          addr.geocoded = true;
          addr.coordinates = data.features[0].center;
          addr.geometry = data.features[0].geometry;
          addr.place_name = data.features[0].place_name;
          addr.confidence = data.features[0].relevance;
        } else {
          addr.geocoded = false;
          addr.error = 'No results found';
        }
        
      } catch (error) {
        addr.geocoded = false;
        addr.error = error.message;
      }
    }
  }

  addMarkersToMap() {
    this.clearMarkers();
    
    this.addresses.forEach(addr => {
      if (addr.coordinates) {
                 // Create marker element with status-based coloring
         const markerEl = document.createElement('div');
         markerEl.className = 'amc-map-marker';
         markerEl.style.width = '20px';
         markerEl.style.height = '20px';
         markerEl.style.backgroundColor = this.getStatusColor(addr['Structure Status']);
         markerEl.style.borderRadius = '50%';
         markerEl.style.border = '2px solid white';
         markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
         markerEl.style.cursor = 'pointer';
        
                 // Create popup content
         const popupContent = `
           <div style="padding: 10px; min-width: 250px;">
             <h4 style="margin: 0 0 8px 0; color: #333;">Structure ${addr.index}</h4>
             <p style="margin: 0 0 5px 0; font-weight: bold;">${addr['Structure Address'] || addr.address || addr.street || addr.location || addr.name}</p>
             ${addr['Structure City'] && addr['Structure State'] ? `<p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">${addr['Structure City']}, ${addr['Structure State']}</p>` : ''}
             ${addr['Structure Status'] ? `<p style="margin: 0 0 5px 0; color: #007bff; font-size: 12px; font-weight: bold;">${addr['Structure Status']}</p>` : ''}
             ${addr['Structure Zip Code'] ? `<p style="margin: 0 0 5px 0; color: #666; font-size: 11px;">ZIP: ${addr['Structure Zip Code']}</p>` : ''}
             <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">${addr.place_name || ''}</p>
             <p style="margin: 0; color: #999; font-size: 11px;">Confidence: ${Math.round((addr.confidence || 0) * 100)}%</p>
           </div>
         `;
        
                 // Create popup
         const popup = new Popup({ offset: 25 }).setHTML(popupContent);
         
         // Create and add marker
         const marker = new Marker(markerEl)
           .setLngLat(addr.coordinates)
           .setPopup(popup)
           .addTo(this._map);
        
        this.markers.push(marker);
      }
    });
    
    // Fit map to show all markers
    if (this.markers.length > 0) {
      this.fitMapToMarkers();
    }
  }

  fitMapToMarkers() {
    if (this.markers.length === 0) return;
    
    const bounds = new LngLatBounds();
    this.markers.forEach(marker => {
      bounds.extend(marker.getLngLat());
    });
    
    this._map.fitBounds(bounds, { padding: 50 });
  }

  clearMarkers() {
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
  }

  clearAllAddresses() {
    this.addresses = [];
    this.clearMarkers();
    this.updateAddressList();
    this.updateStatus('All addresses cleared.');
    this.updateStatistics();
    
    // Reset file input
    const fileInput = this._container.querySelector('#csv-upload');
    if (fileInput) fileInput.value = '';
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export { AddressUploadControl };

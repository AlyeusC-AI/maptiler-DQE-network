class PluginSettingsControl {
  constructor(config) {
    this.config = config;
    this.settings = this.loadSettings();
    this.observers = [];
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl layers-filter active';
    
    // Hide settings panel if plugins are completely disabled
    if (this.config.plugins?.enabled === false) {
      this._container.style.display = 'none';
      return this._container;
    }
    
    const header = document.createElement('div');
    header.className = 'amc-map-header layers-filter-header';
    header.innerText = 'Plugin Settings';
    header.addEventListener('click', () => {
      this._container.classList.toggle('active');
    });

    const content = document.createElement('div');
    content.className = 'layers-filter-content';

    // Settings section
    const settingsSection = document.createElement('div');
    settingsSection.style.marginBottom = '15px';

    // Title
    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '15px';
    title.style.color = '#333';
    title.style.fontSize = '14px';
    title.innerText = 'Feature Toggles';

    // Feature toggles
    const togglesContainer = document.createElement('div');
    togglesContainer.style.marginBottom = '15px';

    // Feature 1: KMZ Upload
    const kmzToggle = this.createFeatureToggle(
      'kmz-upload',
      'KMZ/KML Upload',
      'Allow users to upload KMZ/KML files and override map layers',
      this.settings.features['kmz-upload']
    );

    // Feature 2: Address Upload
    const addressToggle = this.createFeatureToggle(
      'address-upload',
      'Address Upload',
      'Allow users to upload addresses via spreadsheet and display on map',
      this.settings.features['address-upload']
    );

    // Feature 3: Multi-Address Search
    const multiAddressToggle = this.createFeatureToggle(
      'multi-address-search',
      'Multi-Address Search',
      'Allow users to search multiple addresses and calculate distances',
      this.settings.features['multi-address-search']
    );

    // Feature 4: Address Recording (placeholder for future)
    const addressRecordingToggle = this.createFeatureToggle(
      'address-recording',
      'Address Recording',
      'Record searched addresses in database (coming soon)',
      this.settings.features['address-recording'],
      true // disabled for now
    );

    // Feature 6: Building Styles (placeholder for future)
    const buildingStylesToggle = this.createFeatureToggle(
      'building-styles',
      'Building Styles',
      'Show different styles of buildings (coming soon)',
      this.settings.features['building-styles'],
      true // disabled for now
    );

    togglesContainer.appendChild(kmzToggle);
    togglesContainer.appendChild(addressToggle);
    togglesContainer.appendChild(multiAddressToggle);
    togglesContainer.appendChild(addressRecordingToggle);
    togglesContainer.appendChild(buildingStylesToggle);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.innerText = 'Save Settings';
    saveBtn.style.width = '100%';
    saveBtn.style.padding = '10px';
    saveBtn.style.backgroundColor = '#28a745';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontSize = '14px';
    saveBtn.style.marginBottom = '10px';
    saveBtn.addEventListener('click', () => this.saveSettings());

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.innerText = 'Reset to Defaults';
    resetBtn.style.width = '100%';
    resetBtn.style.padding = '8px';
    resetBtn.style.backgroundColor = '#6c757d';
    resetBtn.style.color = 'white';
    resetBtn.style.border = 'none';
    resetBtn.style.borderRadius = '4px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.style.fontSize = '12px';
    resetBtn.addEventListener('click', () => this.resetToDefaults());

    // Status message
    const statusMsg = document.createElement('div');
    statusMsg.id = 'settings-status';
    statusMsg.style.marginTop = '10px';
    statusMsg.style.padding = '8px';
    statusMsg.style.borderRadius = '3px';
    statusMsg.style.fontSize = '12px';
    statusMsg.style.display = 'none';

    settingsSection.appendChild(title);
    settingsSection.appendChild(togglesContainer);
    settingsSection.appendChild(saveBtn);
    settingsSection.appendChild(resetBtn);
    settingsSection.appendChild(statusMsg);

    content.appendChild(settingsSection);

    // Hide by default on mobile
    if (window.innerWidth < 768) {
      this._container.classList.remove('active');
    }

    this._container.appendChild(header);
    this._container.appendChild(content);
    return this._container;
  }

  createFeatureToggle(featureKey, title, description, enabled, disabled = false) {
    const toggleContainer = document.createElement('div');
    toggleContainer.style.marginBottom = '15px';
    toggleContainer.style.padding = '12px';
    toggleContainer.style.border = '1px solid #e9ecef';
    toggleContainer.style.borderRadius = '6px';
    toggleContainer.style.backgroundColor = disabled ? '#f8f9fa' : '#ffffff';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '8px';

    const titleDiv = document.createElement('div');
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.color = disabled ? '#6c757d' : '#333';
    titleDiv.innerText = title;

    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'toggle-switch';
    toggleSwitch.style.position = 'relative';
    toggleSwitch.style.display = 'inline-block';
    toggleSwitch.style.width = '50px';
    toggleSwitch.style.height = '24px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabled;
    checkbox.disabled = disabled;
    checkbox.style.opacity = '0';
    checkbox.style.width = '0';
    checkbox.style.height = '0';
    checkbox.addEventListener('change', (e) => {
      this.settings.features[featureKey] = e.target.checked;
      this.notifyObservers(featureKey, e.target.checked);
    });

    const slider = document.createElement('span');
    slider.className = 'slider';
    slider.style.position = 'absolute';
    slider.style.cursor = disabled ? 'not-allowed' : 'pointer';
    slider.style.top = '0';
    slider.style.left = '0';
    slider.style.right = '0';
    slider.style.bottom = '0';
    slider.style.backgroundColor = disabled ? '#ccc' : (enabled ? '#2196F3' : '#ccc');
    slider.style.transition = '0.4s';
    slider.style.borderRadius = '24px';

    const sliderBefore = document.createElement('span');
    sliderBefore.style.position = 'absolute';
    sliderBefore.style.content = '""';
    sliderBefore.style.height = '18px';
    sliderBefore.style.width = '18px';
    sliderBefore.style.left = enabled ? '26px' : '3px';
    sliderBefore.style.bottom = '3px';
    sliderBefore.style.backgroundColor = 'white';
    sliderBefore.style.transition = '0.4s';
    sliderBefore.style.borderRadius = '50%';
    sliderBefore.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

    const descriptionDiv = document.createElement('div');
    descriptionDiv.style.fontSize = '12px';
    descriptionDiv.style.color = disabled ? '#6c757d' : '#666';
    descriptionDiv.style.lineHeight = '1.4';
    descriptionDiv.innerText = description;

    if (disabled) {
      descriptionDiv.innerHTML += ' <span style="color: #dc3545; font-style: italic;">(Disabled)</span>';
    }

    toggleSwitch.appendChild(checkbox);
    toggleSwitch.appendChild(slider);
    slider.appendChild(sliderBefore);

    headerRow.appendChild(titleDiv);
    headerRow.appendChild(toggleSwitch);

    toggleContainer.appendChild(headerRow);
    toggleContainer.appendChild(descriptionDiv);

    // Update slider position when checkbox changes
    checkbox.addEventListener('change', (e) => {
      slider.style.backgroundColor = e.target.checked ? '#2196F3' : '#ccc';
      sliderBefore.style.left = e.target.checked ? '26px' : '3px';
    });

    return toggleContainer;
  }

  loadSettings() {
    // Get default settings from config if available, otherwise use hardcoded defaults
    const configDefaults = this.config.plugins?.defaultFeatures || {};
    
    const defaultSettings = {
      features: {
        'kmz-upload': configDefaults['kmz-upload'] !== undefined ? configDefaults['kmz-upload'] : true,
        'address-upload': configDefaults['address-upload'] !== undefined ? configDefaults['address-upload'] : true,
        'multi-address-search': configDefaults['multi-address-search'] !== undefined ? configDefaults['multi-address-search'] : true,
        'address-recording': configDefaults['address-recording'] !== undefined ? configDefaults['address-recording'] : false,
        'building-styles': configDefaults['building-styles'] !== undefined ? configDefaults['building-styles'] : false
      }
    };

    // Check if plugins are enabled in config
    if (this.config.plugins?.enabled === false) {
      // If plugins are disabled, hide all features
      Object.keys(defaultSettings.features).forEach(key => {
        defaultSettings.features[key] = false;
      });
    }

    try {
      const saved = localStorage.getItem('maptiler-plugin-settings');
      if (saved && this.config.plugins?.allowUserOverride !== false) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultSettings,
          ...parsed,
          features: {
            ...defaultSettings.features,
            ...parsed.features
          }
        };
      }
    } catch (error) {
      console.warn('Failed to load plugin settings:', error);
    }

    return defaultSettings;
  }

  saveSettings() {
    try {
      // Only save to localStorage if enabled in config
      if (this.config.plugins?.saveToLocalStorage !== false) {
        localStorage.setItem('maptiler-plugin-settings', JSON.stringify(this.settings));
        this.showStatus('Settings saved successfully!', 'success');
      } else {
        this.showStatus('Settings updated (not saved to storage)', 'info');
      }
      
      // Notify all observers of the current state
      Object.keys(this.settings.features).forEach(feature => {
        this.notifyObservers(feature, this.settings.features[feature]);
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      // Get config defaults
      const configDefaults = this.config.plugins?.defaultFeatures || {};
      
      this.settings = {
        features: {
          'kmz-upload': configDefaults['kmz-upload'] !== undefined ? configDefaults['kmz-upload'] : true,
          'address-upload': configDefaults['address-upload'] !== undefined ? configDefaults['address-upload'] : true,
          'multi-address-search': configDefaults['multi-address-search'] !== undefined ? configDefaults['multi-address-search'] : true,
          'address-recording': configDefaults['address-recording'] !== undefined ? configDefaults['address-recording'] : false,
          'building-styles': configDefaults['building-styles'] !== undefined ? configDefaults['building-styles'] : false
        }
      };
      
      // Update UI to reflect default values
      this._container.querySelectorAll('input[type="checkbox"]').forEach((checkbox, index) => {
        const featureKeys = Object.keys(this.settings.features);
        const featureKey = featureKeys[index];
        if (featureKey) {
          checkbox.checked = this.settings.features[featureKey];
          // Update slider position
          const slider = checkbox.parentElement.querySelector('.slider');
          const sliderBefore = slider.querySelector('span');
          if (slider && sliderBefore) {
            slider.style.backgroundColor = checkbox.checked ? '#2196F3' : '#ccc';
            sliderBefore.style.left = checkbox.checked ? '26px' : '3px';
          }
        }
      });
      
      this.showStatus('Settings reset to defaults', 'info');
    }
  }

  showStatus(message, type = 'info') {
    const statusMsg = this._container.querySelector('#settings-status');
    if (statusMsg) {
      statusMsg.textContent = message;
      statusMsg.style.display = 'block';
      
      // Set color based on type
      switch (type) {
        case 'success':
          statusMsg.style.backgroundColor = '#d4edda';
          statusMsg.style.color = '#155724';
          statusMsg.style.border = '1px solid #c3e6cb';
          break;
        case 'error':
          statusMsg.style.backgroundColor = '#f8d7da';
          statusMsg.style.color = '#721c24';
          statusMsg.style.border = '1px solid #f5c6cb';
          break;
        case 'info':
        default:
          statusMsg.style.backgroundColor = '#d1ecf1';
          statusMsg.style.color = '#0c5460';
          statusMsg.style.border = '1px solid #bee5eb';
          break;
      }
      
      // Hide after 3 seconds
      setTimeout(() => {
        statusMsg.style.display = 'none';
      }, 3000);
    }
  }

  addObserver(callback) {
    this.observers.push(callback);
  }

  removeObserver(callback) {
    const index = this.observers.indexOf(callback);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  notifyObservers(feature, enabled) {
    this.observers.forEach(callback => {
      try {
        callback(feature, enabled);
      } catch (error) {
        console.error('Error in settings observer:', error);
      }
    });
  }

  isFeatureEnabled(feature) {
    return this.settings.features[feature] === true;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export { PluginSettingsControl };

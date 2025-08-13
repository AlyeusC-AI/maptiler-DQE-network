# Usage

## The HTML

### Dependency Styles & Scripts
These go in the `head` element.
```html
<!-- Mapbox GL is the maps JS library -->
<script src="https://cdn.maptiler.com/mapbox-gl-js/v1.13.2/mapbox-gl.js"></script>
<link href="https://cdn.maptiler.com/mapbox-gl-js/v1.13.2/mapbox-gl.css" rel="stylesheet" />

<!-- MapTiler Geocoder Library - used for the address lookup -->
<script type="module">
  import { GeocodingControl } from "https://cdn.maptiler.com/maptiler-geocoding-control/v0.0.97/vanilla.js";
  window.maptilerGeocoder = {
    GeocodingControl
  };
</script>

<link
  href="https://cdn.maptiler.com/maptiler-geocoding-control/v0.0.97/style.css"
  rel="stylesheet"
/>
```

### Loading the Map

The `mapTilerIntegration.Map` constructor takes the URI path or URL to the `config.json` file. The JS should go right before the closing `body` tag.

```html
<!-- Our map Element - can have any idea. Just needs to be specified in the config.json file -->
<div id="map">
</div>
<!-- Our JS file -->
<script src="dist/main.js"></script>
<script>
    new mapTilerIntegration.Map('./config.json');
</script>
```

### Complete Example
```html
<!DOCTYPE html>
<html>
<head>
  <title>MapTiler Integration Example</title>
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <!-- Mapbox GL is the maps JS library -->
  <script src="https://cdn.maptiler.com/mapbox-gl-js/v1.13.2/mapbox-gl.js"></script>
  <link href="https://cdn.maptiler.com/mapbox-gl-js/v1.13.2/mapbox-gl.css" rel="stylesheet" />

  <!-- MapTiler Geocoder Library - used for the address lookup -->
  <script type="module">
    import { GeocodingControl } from "https://cdn.maptiler.com/maptiler-geocoding-control/v0.0.97/vanilla.js";
    window.maptilerGeocoder = {
      GeocodingControl
    };
  </script>
  <link
    href="https://cdn.maptiler.com/maptiler-geocoding-control/v0.0.97/style.css"
    rel="stylesheet"
  />
  <style>
    #map {position: absolute; top: 0; right: 0; bottom: 0; left: 0;}
  </style>
</head>
<body>
  <!-- Our map Element - can have any idea. Just needs to be specified in the config.json file -->
  <div id="map">
  </div>
  <!-- Our JS file -->
  <script src="dist/main.js"></script>
  <script>
    new mapTilerIntegration.Map('./config.json');
  </script>
</body>
</html>
```

## Config Options

Config options live in a JSON file that is loaded by our JS.

`target` - Required. The ID of the map HTML element.

`key` - Required. Your MapTiler key. This is needed to do the address lookups with the MapTiler Geocoder library.

`styleUrl` - Required. This is the MapTiler URL for your map. When you click on a map, you can find this URL under "Use vector style". The style URL will always be the one that ends in `style.json?key=`.

`markerImage` - Optional. The URL path to the custom map marker image you'd like to use.

### Example Config.json
```json
{
    "target": "map",
    "key": "12345678",
    "styleUrl": "https://api.maptiler.com/maps/{map-id}/style.json?key={your-key}",
    "markerImage": "https://www.example.com/images/marker.svg"
}
```

## Using the iFrame

You can embed an iframe:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>iFrame Embed</title>
    <style>
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      iframe {
        display:block;
        margin: 0 auto;
        height: 50vh;
        min-height: 300px;
        width: 80vw;
      }
    </style>
  </head>
  <body>
    <iframe title="Network map" src="https://maptiler-integration.gtstaging.com/?markerImage=https://maptiler-integration.gtstaging.com/dist/img/Iris_Map_Pin_FinServ.svg&key=sHB83eecw1gd3WcxsbpK&styleUrl=https://api.maptiler.com/maps/c5c5456a-1d29-4233-ade2-2bf739e1371a/style.json?key=sHB83eecw1gd3WcxsbpK" frameborder="0"></iframe>
  </body>
</html>
```

### The iFrame Source URL

You must pass the config options via query parameters on the URL (any except for `target`).

Additional Params:

`popupBgColor` - Background color for popups.

`popupTextColor` - Color for popup text.

`maxBounds` - list of coordinates separated by a pipe |

`minZoom`

## Layers

Layer names are extracted from the data provided to the map from the `style.json` file. Layer changes must occur within MapTiler or the data provided to it.

### Layer Metadata Options

`amcHideFromList` - The layer will not show in the layers show/hide filter when this is `true`.

`amcPopupDescription` - If this value is set, a popup will show on the layer when it is clicked containing this value.

`amcHoverLayer` - This is the ID of another layer that is meant to be shown when the current layer is hovered on. Example:
```json
{
  "id": "Myrtle Beach 1",
  "type": "circle",
  "source": "dcblox_atltomb_sprite",
  "source-layer": "Myrtle Beach",
  "layout": {"visibility": "visible"},
  "paint": {
    "circle-color": "rgba(87, 57, 107, 1)",
    "circle-radius": 8,
    "circle-stroke-color": "rgba(255, 255, 255, 1)",
    "circle-stroke-width": 3,
    "circle-stroke-opacity": 1
  },
  "metadata": {
    "amcHoverLayer": "Myrtle Beach"
  }
}
```
In this case, the layer with an ID of `Myrtle Beach` will be hidden on initial render and only show when `Myrtle Beach 1` is hovered over.
## Map Styling
All map styling aside from markers takes place in MapTiler. See [the MapTiler docs](https://documentation.maptiler.com/hc/en-us).

/**
 * https://leafletjs.com/reference.html
 * https://developers.arcgis.com/esri-leaflet/
 *
 * https://codepen.io/john-grayson/pen/gOzJRgg?editors=1011
 *
 */

// create a custom layer type extending from the LeafletJS GridLayer
// https://github.com/jwasilgeo/leaflet-experiments/blob/master/lerc-landcover/script.js
// INSPIRED HEAVILY BY https://github.com/jgravois/lerc-leaflet
//
// https://github.com/GIAPspzoo/L.TileLayer.Canvas/blob/master/index.js
//

const LercLayer = L.GridLayer.extend({

  createTile: function (coords, done) {
    let tileError;
    let tile = L.DomUtil.create("canvas", "leaflet-tile");
    tile.width = this.options.tileSize;
    tile.height = this.options.tileSize;

    const tileUrl = `${ this.options.url }/tile/${ coords.z }/${ coords.y }/${ coords.x }`;

    fetch(tileUrl, {method: "GET"}).then((response) => {
      return response.ok ? response.arrayBuffer() : Error(response);
    }).then((arrayBuffer) => {
      try {
        if (arrayBuffer instanceof ArrayBuffer) {

          tile.decodedPixels = Lerc.decode(arrayBuffer);
          tile.decodedPixels.coords = coords;

          this.draw.call(this, tile);
        }
      } catch (error) {
        console.error(error);
        // displaying error text in the canvas tile is for debugging/demo purposes
        // we could instead call `this.draw.call(this, tile);` to bring less visual attention to any errors
        this.drawError(tile);
      }
      done(tileError, tile);
    }).catch((error) => {
      console.error(error);
      // displaying error text in the canvas tile is for debugging/demo purposes
      // we could instead call `this.draw.call(this, tile);` to bring less visual attention to any errors
      this.drawError(tile);
      done(tileError, tile);
    });

    return tile;
  },

  draw: function (tile) {

    const width = tile.decodedPixels.width;
    const height = tile.decodedPixels.height;
    const pixels = tile.decodedPixels.pixels[0]; // get pixels from the first band (only 1 band when 8bit RGB)
    const mask = tile.decodedPixels.maskData;

    // write new canvas context image data by working with the decoded pixel array and mask array
    const ctx = tile.getContext("2d"); // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < width * height; i++) {
      // look up RGB colormap attributes in the raster attribute table for the decoded pixel value
      const pixelValue = pixels[i];

      // set RGB values in the pixel array
      data[i * 4] = (pixelValue / maxPixelValue) * 255;
      data[i * 4 + 1] = 0.0;
      data[i * 4 + 2] = 0.0;

      // make the pixel transparent when either missing data exists for the decoded mask value
      // or for this particular ImageServer when the ClassName raster attribute is "No Data"
      if (mask && !mask[i]) {
        data[i * 4 + 3] = 0;
      } else {
        data[i * 4 + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  },

  drawError: function (tile) {
    const width = tile.width;
    const height = tile.height;
    const ctx = tile.getContext("2d");
    ctx.font = "italic 12px sans-serif";
    ctx.fillStyle = "darkred";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Error decoding data or tile may not exist here.",
      width / 2,
      height / 2,
      width - 10
    );
  }

});

class App {

  // API KEY //
  apiKey = "AAPKbd2be5398c95403c8abaaf78ff7e0d0f9ozezhqoNZBhM_uogCWsFrbncARXuh9ITSwtZ83k7bQLo_kqnA-r-3put9HFxbJq";

  // LAYER INFOS //
  igcLeafletLayers = [
    /*{
     name: 'Global Predominant Ecosystem BSUs',
     type: 'Feature Layer',
     source: 'Feature Service',
     spatialReference: 4326,
     itemUrl: 'https://igcollab.maps.arcgis.com/home/item.html?id=e88e311f56ea42f39a4bde531bd95097',
     url: 'https://services9.arcgis.com/vBCQ4PWZkZBueexC/arcgis/rest/services/Global_BSU/FeatureServer/0'
     },*/
    {
      name: 'CAMS CO2 Anthropogenic Emissions v4.2 2018 (Mg/ha)',
      type: 'Tiled Imagery Layer',
      source: 'Image Service',
      spatialReference: 4326,
      itemUrl: 'https://igcollab.maps.arcgis.com/home/item.html?id=b2b44de7384447a59603e1de24c9f269',
      url: 'https://tiledimageservices9.arcgis.com/vBCQ4PWZkZBueexC/arcgis/rest/services/CAMS_CO2_Total_Emissions_2018__Mg_ha_/ImageServer'
    },
    {
      name: 'CAMS CH4 Anthropogenic Emissions v4.2 2018 (Mg/ha)',
      type: 'Tiled Imagery Layer',
      source: 'Image Service',
      spatialReference: 4326,
      itemUrl: 'https://igcollab.maps.arcgis.com/home/item.html?id=2fcea02312b649779135a47bd32fecd4',
      url: 'https://tiledimageservices9.arcgis.com/vBCQ4PWZkZBueexC/arcgis/rest/services/CAMS_CH4_Total_Emissions_2018__Mg_ha_/ImageServer'
    },
    {
      name: 'Manageable Carbon Sink - Total - 2018',
      type: 'Tiled Imagery Layer',
      source: 'Image Service',
      spatialReference: 4326,
      itemUrl: 'https://igcollab.maps.arcgis.com/home/item.html?id=c7c4d5822e014dd49141a738b5b09384',
      url: 'https://tiledimageservices9.arcgis.com/vBCQ4PWZkZBueexC/arcgis/rest/services/Manageable_Carbon_Total_2018/ImageServer'
    }
  ];

  constructor() {

    // MAP//
    const map = L.map('map').setView([34.0, -118.0], 9);

    // BASEMAP //
    const topoBasemap = L.esri.Vector.vectorBasemapLayer("ArcGIS:Topographic", {apikey: this.apiKey});
    topoBasemap.addTo(map);

    // LAYER CONTROL //
    const layerControl = L.control.layers({"Esri Topographic": topoBasemap}, {}, {collapsed: false});
    //layerControl.addTo(map);

    // LAYERS LIST //
    this.layersList = document.getElementById('layers-list');

    // TRY TO LOAD EACH LAYER //
    const layerInfos = this.igcLeafletLayers.reduce((list, layerInfo) => {

      let details = '------------------';

      try {

        // LAYER PROPERTIES FOR ALL LAYERS //
        const layerProperties = {url: layerInfo.url, crs: L.CRS.EPSG4326};
        // LINKS //
        const links = `<a href="${ layerInfo.itemUrl }" target="_blank">item</a> | <a href="${ layerInfo.url }" target="_blank">url</a>`;
        // DETAILS //
        details = `${ links } | Type: ${ layerInfo.type } | Source: ${ layerInfo.source } | Spatial Reference: ${ layerInfo.spatialReference || 'unknown' }`;

        let layer;

        switch (layerInfo.type) {
          case 'Feature Layer':
            layer = L.esri.featureLayer(layerProperties);
            break;

          case 'Tile Layer':
            layer = L.esri.tiledMapLayer(layerProperties);
            break;

          case 'Tiled Imagery Layer':
            layer = new LercLayer(layerProperties);
            break;

          case 'Imagery Layer':
            layer = L.esri.imageMapLayer(layerProperties);
            break;
        }

        list.push({[layerInfo.name]: layer});

        // ADD TO MAP //
        layer.addTo(map);
        // ADD TO LAYER CONTROL //
        layerControl.addOverlay(layer, layerInfo.name);

        this._addMessage({title: layerInfo.name, message: details});
      } catch (error) {
        this._addMessage({title: layerInfo.name, message: details, error});
      }

      return list;
    }, []);

    layerControl.addBaseLayer(topoBasemap, "Esri Topographic");

  }

  /**
   *
   * @param {string} title
   * @param {string} message
   * @param {Error} [error]
   * @private
   */
  _addMessage({title, message, error}) {

    const detailsNode = document.createElement('div');
    detailsNode.classList.add('details-node');

    const titleNode = document.createElement('div');
    titleNode.classList.add('title-node');
    titleNode.innerHTML = title;
    detailsNode.append(titleNode);

    const messageNode = document.createElement('div');
    messageNode.classList.add('message-node');
    messageNode.innerHTML = message;
    detailsNode.append(messageNode);

    if (error) {
      const errorNode = document.createElement('div');
      errorNode.classList.add('message-error');
      errorNode.innerHTML = error.message;
      detailsNode.append(errorNode);
    }

    this.layersList.append(detailsNode);
  };

}

// CLIENT ID //
//const clientId = "ScgcXXJeR4NDyitK";
// ACCESS TOKEN //
//let accessToken;

// AUTHENTICATION CALLBACK PAGE //
// const callbackPage = `${ location.origin }${ location.pathname.replace(/index/, 'authenticate') }`;
// ARCGIS REST IDENTITY MANAGER //
// import { ArcGISIdentityManager } from 'https://cdn.skypack.dev/@esri/arcgis-rest-request@4.0.0';

// BEGIN OAUTH //
/*ArcGISIdentityManager.beginOAuth2({
 clientId,
 redirectUri: callbackPage
 }).then(authenticationManager => {
 accessToken = authenticationManager.token;*/

//const links = `<a href="${ layerInfo.itemUrl }" target="_blank">item</a> | <a href="${ layerInfo.url }" target="_blank">url</a> | <a href="${ layerInfo.url }?token=${ accessToken }" target="_blank">url w token</a>`;

export default new App();

/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 *
 * GeodesignhubAPI
 *  - Simple wrapper to Geodesignhub API
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/14/2023 - 0.0.2 -
 * Modified:
 *
 */

class GeodesignhubAPI extends HTMLElement {

  static version = '0.0.2';

  /**
   *  GEODESIGNHUB API URL
   * @type {string}
   */
  static API_URL = 'https://www.geodesignhub.com/api/v1';

  /**
   *
   * @type {number}
   */
  #useIGCSpecificBridgeExtensions = 1;

  /**
   * @type {HTMLElement}
   */
  #container;

  /**
   * @type {string}
   */
  #gdhAPIToken;

  /**
   * @type {string}
   */
  #gdhProjectId;

  /**
   *
   */
  #allGDHSystems;

  /**
   * @type {GPLConfig}
   */
  #gplConfig;

  /**
   *
   * @param {HTMLElement|string} container
   * @param {GPLConfig} gplConfig
   * @param {string} gdhAPIToken
   * @param {string} gdhProjectId
   */
  constructor({container, gplConfig, gdhAPIToken, gdhProjectId}) {
    super();

    this.#container = (container instanceof HTMLElement) ? container : document.getElementById(container);

    this.#gplConfig = gplConfig;
    this.#gdhAPIToken = gdhAPIToken;
    this.#gdhProjectId = gdhProjectId;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {}      
        :host select,
        :host button {
          min-width: 600px;
          margin: 5px 0;
          padding: 5px 10px;
          font-size: 14pt;
        }
        :host .gdh-console:empty {          
          opacity: 0;
          transition: opacity 1s linear;
        }
        :host .gdh-console {
          width: 100%;
          max-height: 4rem;
          padding: 5px 15px;          
          font-size: 11pt;
          overflow-y: auto;        
          color: #666666;
          background-color: #efefef;
          border: solid 1px #cccccc;
          border-radius: 3px;
          opacity: 1;
          transition: opacity 1s linear;
        }
      </style>
      <pre class="gdh-console"></pre>            
    `;

    this.#container?.append(this);
  }

  /**
   *
   */
  connectedCallback() {

    // CONSOLE //
    this.consoleElement = this.shadowRoot.querySelector('.gdh-console');

    // BIND MESSAGE DISPLAY //
    this.displayMessage = this.displayMessage.bind(this);

    // VERIFY CREDENTIALS //
    this.verifyCredentials();

  }

  // Custom API error to throw
  ApiError(message, data, status) {

    let response = null;
    let isObject = false;

    // We are trying to parse response
    try {
      response = JSON.parse(data);
      isObject = true;
    } catch (e) {
      response = data;
    }

    return {
      response: response,
      message: message,
      status: status,
      toString: function () {
        return `${ this.message }\nResponse:\n${ isObject ? JSON.stringify(this.response, null, 2) : this.response }`;
      }
    };
  }

  // API wrapper function
  __fetchResource(path, userOptions = {}) {
    // Define default options
    const defaultOptions = {};  // mode: 'no-cors'
    // Define default headers
    const defaultHeaders = {};

    const options = {
      // Merge options
      ...defaultOptions,
      ...userOptions,
      // Merge headers
      headers: {
        ...defaultHeaders,
        ...userOptions.headers
      }
    };

    // Build Url
    const url = `${ GeodesignhubAPI.API_URL }/${ path }`;

    // Detect is we are uploading a file
    const isFile = options.body instanceof File;

    // Stringify JSON data
    // If body is not a file
    if (options.body && typeof options.body === 'object' && !isFile) {
      options.body = JSON.stringify(options.body);
    }

    // Variable which will be used for storing response
    let response = null;
    return fetch(url, options).then(responseObject => {
      // Saving response for later use in lower scopes
      response = responseObject;

      // HTTP unauthorized
      if (response.status === 401) {
        // Handle unauthorized requests
        // Maybe redirect to login page?
        throw this.ApiError(`Request failed with status ${ response.status }.`, "Problem with your API token, please verify by going to https://www.geodesignhub/api/token/", response.status);
      }
      // HTTP unauthorized
      if (response.status === 400) {
        // Handle unauthorized requests
        // Maybe redirect to login page?
        throw this.ApiError(`Request failed with status ${ response.status }.`, "Please verify the Project ID, it does not exist or you dont have access to it", response.status);
      }

      // Check for error HTTP error codes
      if (response.status < 200 || response.status >= 300) {
        // Get response as text
        return response.text();
      }

      // Get response as json
      return response.json();
    })
    // "parsedResponse" will be either text or javascript object depending if
    // "response.text()" or "response.json()" got called in the upper scope
    .then(parsedResponse => {
      // Check for HTTP error codes
      if (response.status < 200 || response.status >= 300) {
        // Throw error
        throw parsedResponse;
      }

      // Request succeeded
      return parsedResponse;
    }).catch(error => {
      // Throw custom API error
      // If response exists it means HTTP error occured
      if (response) {
        throw this.ApiError(`Request failed with status ${ response.status }.`, error, response.status);
      } else {
        throw this.ApiError(error, null, 'REQUEST_FAILED');
      }
    });
  }

  _gdhVerifyProjectCredentials() {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`
        }
      });
  };

  _gdhVerifyProjectSystems() {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/systems/`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`
        }
      });
  };

  _gdhGetProjectTags() {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/tags/`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`
        }
      });
  };

  _gdhGetProjectDesignTeams() {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/cteams/`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`
        }
      });
  };

  _gdhGetDesignTeamDesigns(designTeamID) {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/cteams/${ designTeamID }/`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`
        }
      });
  };

  _gdhGetDesignESRIJSON(designTeamID, designID) {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/cteams/${ designTeamID }/${ designID }/esri/`,
      {
        method: 'GET',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`
        }
      });
  };

  _gdhUpdateDiagramProperties(diagramID, postJson) {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/diagrams/${ diagramID }/`,
      {
        method: 'POST',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`,
          "content-type": "application/json"
        },
        body: JSON.stringify(postJson)
      });
  };

  _gdhMigrateDiagramsToProject(systemID, projectOrPolicy, postJson) {
    return this.__fetchResource(`projects/${ this.#gdhProjectId }/systems/${ systemID }/add/${ projectOrPolicy }/`,
      {
        method: 'POST',
        headers: {
          "Authorization": `Token ${ this.#gdhAPIToken }`,
          "content-type": "application/json"
        },
        body: JSON.stringify(postJson)
      });
  }

  //
  //
  //
  //
  //
  //

  /**
   *
   * @param {string|Error} messageOrError
   * @param {boolean} clearConsole
   */
  displayMessage(messageOrError, clearConsole = false) {
    clearConsole && (this.consoleElement.innerHTML = '');

    if (messageOrError) {

      const message = (messageOrError instanceof Error)
        ? `${ messageOrError.message }: ${ messageOrError.details?.messages?.[0] }`
        : messageOrError;

      this.consoleElement.innerHTML = message ? `<div>${ message }</div><div>============================</div>${ this.consoleElement.innerHTML }` : '';
      this.toggleAttribute('hidden', false);
    }
  }

  /**
   *
   */
  verifyCredentials() {

    let validated = (this.#gdhAPIToken && this.#gdhProjectId);
    if (!validated) {
      this.displayMessage("Please provide a valid API Token and Project ID");

    } else {
      // Check if the API token and the project works (the user has access to the project and the project is of the right tpype)
      this._gdhVerifyProjectCredentials().then(data => {
        if (data.external_connection !== 'esri') {
          this.displayMessage(`<div>${ JSON.stringify(data, null, 2) }</div><br><div>The project is not a ESRI workspace project in Geodesignhub, we cannot migrate data at this time.</div>`);

        } else {
          this._gdhVerifyProjectSystems().then(systemsData => {

            const validSystemColors = [
              {"gplSystemCode": 1, 'name': 'ENE', 'color': "#AB507E"},
              {"gplSystemCode": 2, 'name': 'AG', 'color': "#D9CD91"},
              {"gplSystemCode": 3, 'name': 'FOR', 'color': "#80BD75"},
              {"gplSystemCode": 4, 'name': 'OCN', 'color': "#8CCDD1"},
              {"gplSystemCode": 5, 'name': 'STL', 'color': "#E6564E"},
              {"gplSystemCode": 6, 'name': 'IND', 'color': "#916DA3"},
              {"gplSystemCode": 7, 'name': 'TRAN', 'color': "#706666"},
              {"gplSystemCode": 8, 'name': 'WAT', 'color': "#6B9CB0"}
            ];

            let allSysNameColorsFound = [];
            for (let x1 = 0; x1 < validSystemColors.length; x1++) {
              const currentSystemToCheck = validSystemColors[x1];
              const exists = systemsData.filter(function (singleSystem) {
                return singleSystem.sysname === currentSystemToCheck['name'] && singleSystem.syscolor === currentSystemToCheck['color'];
              });
              if (exists) {
                allSysNameColorsFound.push(1);
              } else {
                allSysNameColorsFound.push(0);
              }
            }

            const isAllOne = allSysNameColorsFound.every(item => item === 1);
            if (isAllOne) {
              this.displayMessage('Project successfully verified, ready for data migration...');

              this.#allGDHSystems = systemsData;

              this.dispatchEvent(new CustomEvent('ready', {}));
            } else {
              this.displayMessage("Geodesignhub project is not setup correctly, please contact your administrator");
            }
          }).catch(this.displayMessage);
        }
      }).catch(this.displayMessage);
    }

  }

  /**
   *
   * @param gplSystem
   * @returns {number}
   */
  gdhGPLSystemConverter(gplSystem) {
    // This function takes a "Intervention System" from Geoplanner and returns
    const gplGDHLookup = {
      1: 'ENE',
      2: 'AG',
      3: 'FOR',
      4: 'OCN',
      5: 'STL',
      6: 'IND',
      7: 'TRAN',
      8: 'WAT'
    };

    let gdhSystemID = 0;
    if (gplGDHLookup.hasOwnProperty(gplSystem)) {
      let gdhSystemName = gplGDHLookup[gplSystem];
      const gdhSystem = this.#allGDHSystems.filter(function (singleSystem) {
        return singleSystem.sysname === gdhSystemName;
      });
      if (gdhSystem.length === 1) { // There should be only one system in a GDH project
        gdhSystemID = gdhSystem[0]['id'];
      }

    }

    return gdhSystemID;
  }

  /**
   *
   * @param diagramsGeoJSON
   * @returns {Promise<unknown>}
   */
  migrateGPLFeaturesAsDiagrams(diagramsGeoJSON) {
    return new Promise((resolve, reject) => {

      let source_diagrams_len = diagramsGeoJSON.length;

      for (let index = 0; index < source_diagrams_len; index++) {
        const current_diagram_feature = diagramsGeoJSON[index];

        const gdhDiagramName = current_diagram_feature.properties.name || "GPL Migration";
        const gplSystem = current_diagram_feature.properties.system;
        const gdhTagCodes = current_diagram_feature.properties.tags;
        const gdhStartDate = current_diagram_feature.properties.start_date;
        const gdhEndDate = current_diagram_feature.properties.end_date;

        // METADATA //
        let gplAdditionalMetadata = current_diagram_feature.properties.metadata;
        if (!gplAdditionalMetadata) {
          gplAdditionalMetadata = {"globalid": current_diagram_feature.properties[this.#gplConfig.FIELD_NAMES.GLOBAL_ID]};
        }
        // REMOVE METADATA //
        delete current_diagram_feature.properties.metadata;

        // SYSTEM ID //
        const gdhSystemID = this.gdhGPLSystemConverter(gplSystem);

        // REWIND GEOMETRY //
        const gj = current_diagram_feature['geometry'];
        let geoJSONGeometryType = gj['type'].toLowerCase();
        let rewound = this.rewind(gj, false);
        current_diagram_feature['geometry'] = rewound;

        // CREATE FEATURE COLLECTION //
        let gj_feature_collection = {"type": "FeatureCollection", "features": [current_diagram_feature]};
        if (geoJSONGeometryType === 'LineString') { geoJSONGeometryType = 'polyline'; }

        const postJson = {"featuretype": geoJSONGeometryType, "description": gdhDiagramName, "geometry": gj_feature_collection};

        if (gdhSystemID !== 0) {

          let gdhDiagramProperties = {
            "additional_metadata": gplAdditionalMetadata,
            "tag_codes": gdhTagCodes,
            "title": gdhDiagramName,
            "start_date": gdhStartDate,
            "end_date": gdhEndDate
          };

          this._gdhMigrateDiagramsToProject(gdhSystemID, 'project', postJson).then(diagram_data => {
            this.displayMessage(JSON.stringify(diagram_data, null, 2));
            return diagram_data;
          }).then(diagram_data => {
            const dd = JSON.parse(diagram_data);
            let diagramID = dd['diagram_id'];

            this._gdhUpdateDiagramProperties(diagramID, gdhDiagramProperties).then(propertiesUpdated => {
              this.displayMessage("Diagram properties updated..");

              setTimeout(resolve, 250);

            }).catch(this.displayMessage);
          }).catch(this.displayMessage);
        }
      }
    });
  }

  /**
   * Source: https://github.com/chris48s/geojson-rewind
   *
   * @param gj
   * @param outer
   * @returns {*}
   */
  rewind(gj, outer) {
    var type = gj && gj.type, i;

    if (type === 'FeatureCollection') {
      for (i = 0; i < gj.features.length; i++) rewind(gj.features[i], outer);

    } else if (type === 'GeometryCollection') {
      for (i = 0; i < gj.geometries.length; i++) rewind(gj.geometries[i], outer);

    } else if (type === 'Feature') {
      rewind(gj.geometry, outer);

    } else if (type === 'Polygon') {
      this.rewindRings(gj.coordinates, outer);

    } else if (type === 'MultiPolygon') {
      for (i = 0; i < gj.coordinates.length; i++) this.rewindRings(gj.coordinates[i], outer);
    }

    return gj;
  }

  rewindRings(rings, outer) {
    if (rings.length === 0) return;

    this.rewindRing(rings[0], outer);
    for (var i = 1; i < rings.length; i++) {
      this.rewindRing(rings[i], !outer);
    }
  }

  rewindRing(ring, dir) {
    var area = 0, err = 0;
    for (var i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      var k = (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
      var m = area + k;
      err += Math.abs(area) >= Math.abs(k) ? area - m + k : k - m + area;
      area = m;
    }
    if (area + err >= 0 !== !!dir) ring.reverse();
  }

}

customElements.define("geodesignhub-api", GeodesignhubAPI);

export default GeodesignhubAPI;

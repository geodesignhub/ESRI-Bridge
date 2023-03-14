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
 * DiagramImporter
 *  - Element: diagram-importer
 *  - Description: Import Geodesignhub diagrams from a GeoPlanner Scenario
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/14/2023 - 0.0.1 -
 * Modified:
 *
 */

class DiagramImporter extends HTMLElement {

  static version = '0.0.1';

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   * @type {GeodesignhubAPI}
   */
  #geodesignhub;

  /**
   * @type {Portal}
   */
  #portal;

  /**
   * @type {PortalGroup} GeoPlanner Project = PortalGroup
   */
  #gplProjectGroup;

  /**
   * @type {PortalItem[]}
   */
  #scenarioPortalItems;

  /**
   * @type {PortalItem}
   */
  #scenarioPortalItem;

  /**
   * @type {string}
   */
  #projectID;

  /**
   * @type {string}
   */
  #sourceScenarioFilter;

  /**
   * @type {string}
   */
  #geoPlannerScenarioLayerQueryUrl;

  /**
   * @type {string}
   */
  #queryWhereClause;

  /**
   * @type {number}
   */
  #scenarioDiagramCount;

  /**
   * @type {GPLConfig}
   */
  #gplConfig;

  /**
   *
   * @param {HTMLElement|string} container
   * @param {Portal} portal
   * @param {GPLConfig} gplConfig
   * @param {PortalGroup} gplProjectGroup
   * @param {GeodesignhubAPI} geodesignhub
   */
  constructor({container, portal, gplConfig, gplProjectGroup, geodesignhub}) {
    super();

    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);

    this.#gplConfig = gplConfig;
    this.#geodesignhub = geodesignhub;

    this.#portal = portal;
    this.#gplProjectGroup = gplProjectGroup;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {}      
        :host h3 {
          text-align: center;
        }
        :host select,
        :host button {
          width: 100%;
          margin: 5px 0;
          padding: 5px 10px;
          font-size: 14pt;
        }
      </style>      
      <h3>Migrate GeoPlanner Scenario as Geodesignhub Diagrams</h3>
      <label>   
        <div>Select GeoPlanner Scenario</div> 
        <select class="scenario-items-select"></select>
        <div>The '<span class="scenario-name-label">?</span>' GeoPlanner Scenario contains <span class="scenario-diagram-count">---</span> diagrams.</div>         
        <button class="migrate-btn">Migrate GeoPlanner Scenario as Geodesignhub Diagrams</button>        
      </label>
      <div class="complete-section" hidden>
        <div>Please click the 'continue' button below and then refresh the Geodesignhub browser window.</div>
        <button class="close-btn">continue</button>
      </div>           
    `;

    this.container?.append(this);
  }

  /**
   *
   */
  connectedCallback() {

    this.scenarioNameLabel = this.shadowRoot.querySelector('.scenario-name-label');
    this.scenarioDiagramCount = this.shadowRoot.querySelector('.scenario-diagram-count');

    this.scenarioItemsSelect = this.shadowRoot.querySelector('.scenario-items-select');
    this.scenarioItemsSelect.addEventListener('change', () => {
      this.scenarioSelected();
    });

    this.migrateBtn = this.shadowRoot.querySelector('.migrate-btn');
    this.migrateBtn.addEventListener('click', () => {
      this.migrateSelectedScenario();
    });

    this.completeSection = this.shadowRoot.querySelector('.complete-section');
    this.closeBtn = this.shadowRoot.querySelector('.close-btn');
    this.closeBtn.addEventListener('click', () => { close(); });

    // BIND TO PROVIDE PROPER CONTEXT //
    this._getFeatureCount = this._getFeatureCount.bind(this);
    this._getAllFeatures = this._getAllFeatures.bind(this);

    // INITIALIZE THE UI //
    this.initialize();

  }

  /**
   *
   */
  initialize() {

    this.getPortalItemsList().then(({scenarioPortalItems}) => {
      this.#scenarioPortalItems = scenarioPortalItems;

      // GEOPLANNER SCENARIO ITEMS //
      const layerItemNodes = scenarioPortalItems.map(scenarioPortalItem => {

        const layerItemNode = document.createElement('option');
        layerItemNode.setAttribute('value', scenarioPortalItem.id);
        layerItemNode.innerHTML = scenarioPortalItem.title;

        return layerItemNode;
      });
      // DISPLAY LIST OF ALL GEOPLANNER LAYER ITEMS //
      this.scenarioItemsSelect.replaceChildren(...layerItemNodes);

      // INITIAL SELECTION
      this.scenarioSelected();

    }).catch(error => {
      this.#geodesignhub.displayMessage(error);
    });
  }

  /**
   *
   */
  scenarioSelected() {

    // SELECTED GEOPLANNER SCENARIO //
    this.#scenarioPortalItem = this.#scenarioPortalItems.find(item => item.id === this.scenarioItemsSelect.value);
    this.scenarioNameLabel.innerHTML = this.#scenarioPortalItem.title;

    this.geoPlannerScenarioSelected().then(({projectID, sourceScenarioFilter, geoPlannerScenarioLayerQueryUrl, queryWhereClause, maxFeatureCount}) => {

      this.#projectID = projectID;
      this.#sourceScenarioFilter = sourceScenarioFilter;
      this.#geoPlannerScenarioLayerQueryUrl = geoPlannerScenarioLayerQueryUrl;
      this.#queryWhereClause = queryWhereClause;
      this.scenarioDiagramCount.innerHTML = this.#scenarioDiagramCount = maxFeatureCount;

      this.dispatchEvent(new CustomEvent('scenario-change', {detail: {scenarioPortalItem: this.#scenarioPortalItem}}));
    }).catch(error => {
      this.#geodesignhub.displayMessage(error);
    });
  };

  /**
   *
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalGroup.html
   *
   * @returns {Promise<PortalItem[]>}
   * @private
   */
  getPortalItemsList() {
    return new Promise((resolve, reject) => {

      /**
       * https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalGroup.html#queryItems
       *
       * ASK PORTAL TO RETURN PORTAL ITEMS
       *  - group items with these tags: geodesign | geodesignScenario
       *
       */
      this.#gplProjectGroup.queryItems({
        query: 'tags:(geodesign AND geodesignScenario)',
        sortField: 'modified',
        sortOrder: 'desc',
        num: 100
      }).then(({results}) => {

        // LAYER PORTAL ITEMS //
        // - A PORTAL ITEM REPRESENTS THE SIMPLE METADATA ABOUT A GIS THING (MAP, LAYER, ETC...)
        //   AND IN THIS CASE WE'RE JUST INTERESTED IN THE FEATURE LAYERS...
        const scenarioPortalItems = results.filter(item => item.isLayer);

        resolve({scenarioPortalItems});
      }).catch(reject);
    });
  }

  /**
   *
   */
  geoPlannerScenarioSelected() {
    return new Promise((resolve, reject) => {

      // GET RPOJECT ID FROM TYPEKEYWORD //
      const projectIDKeyword = this.#scenarioPortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));
      const projectID = projectIDKeyword.replace(/geodesignProjectID/, '');

      // SOURCE SCENARIO FILTER //
      const sourceScenarioID = this.#scenarioPortalItem.id;
      const sourceScenarioFilter = `(Geodesign_ProjectID = '${ projectID }') AND (Geodesign_ScenarioID = '${ sourceScenarioID }')`;

      // QUERY REST ENDPOINT //
      const geoPlannerScenarioLayerQueryUrl = `${ this.#scenarioPortalItem.url }/${ this.#gplConfig.ACTIONS_LAYER_ID }/query`;
      // QUERY WHERE CLAUSE //
      const queryWhereClause = `${ sourceScenarioFilter } AND (${ this.#gplConfig.FIELD_NAMES.ACTION_ID } IS NOT NULL)`;

      //
      // GET MAXIMUM NUMBER OF FEATURES THAT MATCH OUR QUERY FILTER
      //
      this._getFeatureCount({
        queryUrl: geoPlannerScenarioLayerQueryUrl,
        queryFilter: queryWhereClause
      }).then(({maxFeatureCount}) => {
        resolve({
          projectID,
          sourceScenarioFilter,
          geoPlannerScenarioLayerQueryUrl,
          queryWhereClause,
          maxFeatureCount
        });
      }).catch(reject);
    });
  }

  /**
   *
   */
  migrateSelectedScenario() {

    //
    // GET THE FEATURES AS GEOJSON DIRECTLY FROM THE REST ENDPOINT //
    //  - esri/request IS A GENERIC METHOD TO MAKE DIRECT WEB CALLS BUT WILL HANDLE ESRI SPECIFIC USE-CASES
    //      DOC: https://developers.arcgis.com/javascript/latest/api-reference/esri-request.html
    //  - HERE WE USE IT TO MAKE A DIRECT CALL TO THE QUERY REST ENDPOINT OF THE FEATURE LAYER
    //
    //  - NOTE: CURRENTLY ALSO FILTERING OUT FEATURES WITH 'NA' IN THE SYSTEM FIELD
    //          AND NOT SURE IF WE'LL ALWAYS NEED THIS...
    //
    this._getAllFeatures({
      queryUrl: this.#geoPlannerScenarioLayerQueryUrl,
      queryFilter: this.#queryWhereClause,
      maxFeatureCount: this.#scenarioDiagramCount
    }).then(({features}) => {

      const diagramsGeoJSON = features.map((feature, featureIdx) => {

        // DIAGRAM NAME //
        const diagramName = feature.properties[this.#gplConfig.FIELD_NAMES.NAME];

        // START AND END DATES //
        const startDate = new Date(feature.properties[this.#gplConfig.FIELD_NAMES.START_DATE] || 'January 1, 2024');
        const endDate = new Date(feature.properties[this.#gplConfig.FIELD_NAMES.NAME.END_DATE] || 'December 31, 2049');

        // GET CLIMATE ACTION //
        const climateAction = feature.properties[this.#gplConfig.FIELD_NAMES.ACTION_ID];
        // GET CLIMATE ACTION SYSTEM //
        const [systemCode] = climateAction?.split('.');

        // CLIMATE ACTIONS PROPERTY //
        const climateActionsStr = feature.properties[this.#gplConfig.FIELD_NAMES.ACTION_IDS];
        // CLIMATE ACTION CODES //
        const climateActions = (climateActionsStr?.length) ? climateActionsStr.split('|') : [climateAction];

        const newDiagram = {
          type: 'Feature',
          id: (featureIdx + 1),
          geometry: feature.geometry,
          properties: {
            name: diagramName,
            system: Number(systemCode),
            tags: climateActions,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            source: JSON.stringify(feature.properties)
          }
        };
        console.info(newDiagram);

        return newDiagram;
      });

      // GEODESIGNHUB MIGRATE FEATURES AS DIAGRAMS //
      this.#geodesignhub.migrateGPLFeaturesAsDiagrams(diagramsGeoJSON).then(() => {
        this.completeSection.toggleAttribute('hidden', false);
      });
    });

  }

  /**
   *
   * GET MAXIMUM NUMBER OF FEATURES THAT MATCH OUR QUERY FILTER
   *
   * @param {string} queryUrl
   * @param {string} queryFilter
   * @returns {Promise<{maxFeatureCount:number}>}
   * @private
   */
  _getFeatureCount({queryUrl, queryFilter}) {
    return new Promise((resolve, reject) => {
      require(['esri/request'], (esriRequest) => {
        if (queryUrl && queryFilter) {
          esriRequest(queryUrl, {
            query: {
              returnCountOnly: true,
              where: queryFilter,
              token: this.#portal.credential?.token,
              f: 'json'
            }
          }).then(({data: {count}}) => {
            // MAXIMUM NUMBER OF FEATURES THAT MATCH OUR QUERY FILTER //
            resolve({maxFeatureCount: count});
          }).catch(reject);
        } else {
          reject(new Error("Can't query for counts: missing URL or filter parameters."));
        }
      });
    });
  }

  /**
   *
   * ITERATIVELY RETRIEVE ALL FEATURES
   *
   * @param {string} queryUrl
   * @param {string} queryFilter
   * @param {number} [startOffset]
   * @param {number} maxFeatureCount
   * @param {Graphic[]} [allFeatures]
   * @returns {Promise<{features:Graphic[]}>}
   * @private
   */
  _getAllFeatures({queryUrl, queryFilter, startOffset = 0, maxFeatureCount = 1000, allFeatures = []}) {
    return new Promise((resolve, reject) => {
      require(['esri/request'], (esriRequest) => {
        if (queryUrl && queryFilter) {
          esriRequest(queryUrl, {
            query: {
              resultOffset: startOffset,
              where: queryFilter,
              outFields: '*',
              outSR: 4326,
              token: this.#portal.credential?.token,
              f: 'geojson'
            }
          }).then((response) => {
            // GEOJSON FEATURES //
            const {features} = response.data;
            // AGGREGATED FEATURES //
            allFeatures.push(...features);

            // DO WE NEED TO RETRIEVE MORE FEATURES? //
            if (allFeatures.length < maxFeatureCount) {
              this._getAllFeatures({
                queryUrl,
                queryFilter,
                startOffset: allFeatures.length,
                maxFeatureCount,
                allFeatures
              }).then(resolve).catch(reject);
            } else {
              // WE HAVE THEM ALL //
              resolve({features: allFeatures});
            }
          }).catch(reject);
        } else {
          reject(new Error("Can't query for features: missing URL or filter parameters."));
        }
      });
    });
  };

}

customElements.define("diagram-importer", DiagramImporter);

export default DiagramImporter;

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

/**
 * @typedef {{ systemName: string, policyName: string, systemCode: string, actionCode: string, policyCode: string, actionName: string, gdhSystemCode: string}} CLIMATE_ACTION
 */

/**
 *
 * CLIMATE ACTIONS DETAILS
 *
 * @type {CLIMATE_ACTION[]}
 */
/*const CLIMATE_ACTIONS = [
 {
 actionCode: '1.3.4',
 actionName: 'Natural gas power plant closure',
 policyCode: '1.3',
 policyName: 'Close fossil energy generators',
 systemCode: '1',
 systemName: 'Energy',
 gdhSystemCode: 'ENE'
 },
 {
 actionCode: '1.4.1',
 actionName: 'Solar photovoltaics',
 policyCode: '1.4',
 policyName: 'Substitute with renewable energy systems',
 systemCode: '1',
 systemName: 'Energy',
 gdhSystemCode: 'ENE'
 },
 {
 actionCode: '1.4.3',
 actionName: 'Wind power',
 policyCode: '1.4',
 policyName: 'Substitute with renewable energy systems',
 systemCode: '1',
 systemName: 'Energy',
 gdhSystemCode: 'ENE'
 },
 {
 actionCode: '3.1.11',
 actionName: 'Forest protection',
 policyCode: '3.1',
 policyName: 'Manage forests sustainably',
 systemCode: '3',
 systemName: 'Forests, Peatlands, and Grasslands',
 gdhSystemCode: 'FOR'

 },
 {
 actionCode: '3.1.12',
 actionName: 'Forest restoration',
 policyCode: '3.1',
 policyName: 'Manage forests sustainably',
 systemCode: '3',
 systemName: 'Forests, Peatlands, and Grasslands',
 gdhSystemCode: 'FOR'
 }
 ];*/

/*static SYSTEMS_INFOS = [
 {"gplSystemCode": 1, 'name': 'ENE', 'color': "#AB507E"},
 {"gplSystemCode": 2, 'name': 'AG', 'color': "#D9CD91"},
 {"gplSystemCode": 3, 'name': 'FOR', 'color': "#80BD75"},
 {"gplSystemCode": 4, 'name': 'OCN', 'color': "#8CCDD1"},
 {"gplSystemCode": 5, 'name': 'STL', 'color': "#E6564E"},
 {"gplSystemCode": 6, 'name': 'IND', 'color': "#916DA3"},
 {"gplSystemCode": 7, 'name': 'TRAN', 'color': "#706666"},
 {"gplSystemCode": 8, 'name': 'WAT', 'color': "#6B9CB0"}
 ];*/

class DiagramImporter extends HTMLElement {

  static version = '0.0.1';

  /**
   * @type {HTMLElement}
   */
  #container;

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
   * @type {number}
   */
  #interventionLayerId;

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
   *
   * @type {boolean}
   */
  #supportsMultipleActionsPerDiagram = true;

  /**
   *
   */
  constructor({container, portal, gplProjectGroup, geodesignhub}) {
    super();

    this.#container = (container instanceof HTMLElement) ? container : document.getElementById(container);

    this.#portal = portal;
    this.#gplProjectGroup = gplProjectGroup;
    this.#interventionLayerId = 0;
    this.#geodesignhub = geodesignhub;

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
    `;

    this.#container?.append(this);
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

      this.scenarioSelected();
    }).catch(error => {
      this.#geodesignhub.displayMessage(error.message);
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
      this.#geodesignhub.displayMessage(error.message);
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
      //console.info("Source Scenario Filter: ", sourceScenarioFilter);

      // QUERY REST ENDPOINT //
      const geoPlannerScenarioLayerQueryUrl = `${ this.#scenarioPortalItem.url }/${ this.#interventionLayerId }/query`;
      // QUERY WHERE CLAUSE //
      const queryWhereClause = `${ sourceScenarioFilter } AND (ACTION_IDS IS NOT NULL)`;

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

      let diagramsGeoJSON;

      if (this.#supportsMultipleActionsPerDiagram) {

        //
        // DECONSTRUCT/DISASSEMBLE FEATURES INTO DIAGRAMS
        //
        // ONCE WE HAVE ALL THE SOURCE SCENARIO FEATURES WE'LL HAVE ORGANIZE THE THEM INTO GDH DIAGRAMS
        // BASED ON THE SYSTEM. WHICH WILL LIKELY RESULT IN MORE DIAGRAMS THAN SOURCE SCENARIO FEATURES
        //
        // IN THIS WORKFLOW, FOR EACH INPUT FEATURE, WE END UP WITH A DIAGRAM WITH MULTIPLE ACTIONS
        // PER SYSTEM. IF NOT ACTIONS EXIST FOR A SYSTEM THEN THERE IS NO DIAGRAM FOR THAT SYSTEM.
        //
        diagramsGeoJSON = features.reduce((list, feature) => {

          // GROUP CLIMATE ACTIONS BY SYSTEM //
          const actions = feature.properties.ACTION_IDS.split('|');
          const groupedActionsBySystem = actions.reduce((bySystem, action) => {

            // GET CLIMATE ACTION DETAILS //
            const systemCode = +action.split('.')[0];

            // GET LIST OF CLIMATE ACTIONS BY SYSTEM //
            const actionsBySystem = bySystem.get(systemCode) || [];
            // ADD ACTION TO LIST OF ACTIONS BY SYSTEM //
            actionsBySystem.push(action);

            return bySystem.set(systemCode, actionsBySystem);
          }, new Map());

          // CREATE ONE DIAGRAM FOR EACH SYSTEM //
          groupedActionsBySystem.forEach((climateActions, systemCode) => {
            // DIAGRAM //
            const newDiagram = {
              type: 'Feature',
              id: (list.length + 1),
              geometry: feature.geometry,
              properties: {
                ...feature.properties, // HERE WE COULD RESTRICT OR FILTER WHICH PROPERTIES/ATTRIBUTES TO MAINTAIN... //
                system: systemCode,
                tags: climateActions // ARRAY OF CLIMATE ACTION CODES //
              }
            };
            list.push(newDiagram);
          });

          return list;
        }, []);

      } else {
        //
        // SINGLE ACTION PER DIAGRAM
        //
        diagramsGeoJSON = features.map((feature, featureIdx) => {

          // GET LIST OF ALL CLIMATE ACTIONS FOR EACH FEATURE //
          const actionCode = feature.properties.ACTION_IDS;
          // GET CLIMATE ACTION DETAILS //
          const systemCode = +actionCode.split('.')[0];

          const newDiagram = {
            type: 'Feature',
            id: (featureIdx + 1),
            geometry: feature.geometry,
            properties: {
              ...feature.properties, // HERE WE COULD RESTRICT OR FILTER WHICH PROPERTIES/ATTRIBUTES TO MAINTAIN... //
              system: systemCode,
              tags: [actionCode] // ARRAY OF CLIMATE ACTION CODES //
            }
          };
          //console.info(newDiagram);

          return newDiagram;
        });
      }

      // GEODESIGNHUB MIGRATE FEATURES AS DIAGRAMS //
      this.#geodesignhub.migrateGPLFeaturesAsDiagrams(diagramsGeoJSON).then(() => {
        // TODO: CLOSE WINDOW OR SHOW CLOSE BUTTON ??
        // close();
      });
    });

  }

  /**
   *
   * GET CLIMATE ACTION DETAILS
   * - this is just temporary until we can ask GDH for this info...
   *
   * @param {string} actionCode
   * @returns {CLIMATE_ACTION}
   */

  /* _getClimateAction(actionCode) {
   return CLIMATE_ACTIONS.find(action => {
   return (action.actionCode === actionCode);
   });
   };*/

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
        esriRequest(queryUrl, {
          query: {
            returnCountOnly: true,
            where: queryFilter,
            f: 'json'
          }
        }).then(({data: {count}}) => {
          //
          // MAXIMUM NUMBER OF FEATURES THAT MATCH OUR QUERY FILTER //
          //
          resolve({maxFeatureCount: count});
        }).catch(reject);
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
  _getAllFeatures({queryUrl, queryFilter, startOffset = 0, maxFeatureCount, allFeatures = []}) {
    return new Promise((resolve, reject) => {
      require(['esri/request'], (esriRequest) => {
        esriRequest(queryUrl, {
          query: {
            resultOffset: startOffset,
            where: queryFilter,
            outFields: '*',
            outSR: 4326,
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
      });
    });
  };

}

customElements.define("diagram-importer", DiagramImporter);

export default DiagramImporter;
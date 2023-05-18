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
 * DiagramExporter
 *  - Element: diagram-exporter
 *  - Description: Export Geodesignhub diagrams as a new GeoPlanner Scenario
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/14/2023 - 0.0.1 -
 * Modified:
 *
 */

class DiagramExporter extends HTMLElement {

  static version = '0.0.1';

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   * @type {Portal}
   */
  #portal;

  /**
   * @type {PortalGroup}
   */
  #gplProjectGroup;

  /**
   * @type {PortalItem}
   */
  #projectPortalItem;

  /**
   * @type {string}
   */
  #gdhDesignTeamId;

  /**
   * @type {string}
   */
  #gdhDesignId;

  /**
   * @type {GeodesignhubAPI}
   */
  #geodesignhub;

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
   * @param {string} gdhDesignTeamId
   * @param {string} gdhDesignId
   * @param {GeodesignhubAPI} geodesignhub
   */
  constructor({container, portal, gplConfig, gplProjectGroup, gdhDesignTeamId, gdhDesignId, geodesignhub}) {
    super();

    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);

    this.#geodesignhub = geodesignhub;
    this.#gplConfig = gplConfig;

    this.#portal = portal;
    this.#gplProjectGroup = gplProjectGroup;
    this.#gdhDesignTeamId = gdhDesignTeamId;
    this.#gdhDesignId = gdhDesignId;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {}
        :host h3 {
          text-align: center;
        }
        :host input,
        :host button {
          width: 100%;
          margin: 5px 0;
          padding: 5px 10px;
          font-size: 14pt;
        }  
      </style>                  
      <h3>Migrate Geodesignhub Design as GeoPlanner Scenario</h3>                    
      <label>
        <div>Selected Design Team</div>
        <input class="design-team-input" type="text" readonly placeholder="design team">
      </label>                       
      <label>
        <div>Selected Design</div>   
        <input class="design-input" type="text" readonly placeholder="design">        
      </label>
      <button class="migrate-selected-btn" disabled>Migrate Geodesignhub Design as GeoPlanner Scenario</button>
      <div class="complete-section" hidden>
        <div>    
          <a class="new-scenario-link" href="" target="_blank">View new Scenario in ArcGIS</a>
        </div>
        <button class="close-btn">continue</button>
      </div>      
    `;

    this.container?.append(this);
  }

  /**
   *
   */
  connectedCallback() {

    this.designTeamInput = this.shadowRoot.querySelector('.design-team-input');
    this.designInput = this.shadowRoot.querySelector('.design-input');

    this.migrateSelectedBtn = this.shadowRoot.querySelector('.migrate-selected-btn');
    this.migrateSelectedBtn.addEventListener('click', () => {
      this.migrateDesignAsScenario();
    });

    this.completeSection = this.shadowRoot.querySelector('.complete-section');
    this.newScenarioLink = this.shadowRoot.querySelector('.new-scenario-link');
    this.closeBtn = this.shadowRoot.querySelector('.close-btn');
    this.closeBtn.addEventListener('click', () => { close(); });

    // INITIALIZE THE UI //
    this.getProjectPortalItem().then(({projectPortalItem}) => {
      this.#projectPortalItem = projectPortalItem;
      this.initializeDesignTeams();
    }).catch(error => {
      this.#geodesignhub.displayMessage(error);
    });

  }

  /**
   *
   */
  initializeDesignTeams() {

    // GET DESIGN TEAMS //
    this.#geodesignhub._gdhGetProjectDesignTeams().then(teamInfos => {

      // FIND SELECTED DESIGN TEAM //
      const selectedDesignTeam = teamInfos.find(teamInfo => teamInfo.id === Number(this.#gdhDesignTeamId));
      this.designTeamInput.value = selectedDesignTeam.title;

      // GET DESIGNS //
      this.#geodesignhub._gdhGetDesignTeamDesigns(selectedDesignTeam.id).then((designData) => {

        // FIND SELECTED DESIGN //
        const selectedDesign = designData.synthesis.find(designSynthesis => designSynthesis.id === this.#gdhDesignId);
        this.designInput.value = selectedDesign.description;

        // ENABLE MIGRATE BUTTON //
        this.migrateSelectedBtn.toggleAttribute('disabled', false);
      }).catch(error => {
        this.#geodesignhub.displayMessage(error);
      });
    }).catch(error => {
      this.#geodesignhub.displayMessage(error);
    });

  }

  /**
   *
   * @returns {Promise<{projectPortalItem:PortalItem}>}
   */
  getProjectPortalItem() {
    return new Promise((resolve, reject) => {

      /**
       * https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalGroup.html#queryItems
       *
       * ASK PORTAL TO RETURN PORTAL ITEMS
       *  - group item with tag of geodesignProjectFeatureService
       *
       */
      this.#gplProjectGroup.queryItems({
        query: 'tags:geodesignProjectFeatureService',
        num: 1
      }).then(({results}) => {
        resolve({projectPortalItem: results[0]});
      }).catch(reject);
    });
  }

  /**
   *
   */
  migrateDesignAsScenario() {

    const gdhDesignTeamID = this.#gdhDesignTeamId;
    const gdhDesignTeamName = this.designTeamInput.value;
    const gdhDesignID = this.#gdhDesignId;
    const gdhDesignName = this.designInput.value;

    this.#geodesignhub.displayMessage("Migration process started...");
    this.#geodesignhub._gdhGetDesignESRIJSON(gdhDesignTeamID, gdhDesignID).then(_designFeaturesAsEsriJSON => {

      // This filters out the design features that have "empty" tag_codes, meaning that these features dont have a climate action tag attached to them.
      let designFeaturesAsEsriJSON = _designFeaturesAsEsriJSON.filter((_esri_json_feature) => {
        const {tag_codes} = _esri_json_feature.attributes;
        const isValid = (tag_codes?.length > 0);
        if (!isValid) {
          //console.info('diagram with no climate action: ', _esri_json_feature.attributes);
          this.#geodesignhub.displayMessage("Warning: diagram with no climate action.");
        }
        return isValid;
      });

      // MAKE SURE WE HAVE AT LEAST ONE DIAGRAM AVAILABLE TO EXPORT //
      if (designFeaturesAsEsriJSON.length) {

        //
        // CREATE TARGET SCENARIO PORTAL ITEM //
        //  - THIS WILL GIVE US THE NECESSARY NEW SCENARIO ID...
        //
        this._createNewGeoPlannerScenarioPortalItem({
          designTeamName: gdhDesignTeamName,
          designName: gdhDesignName
        }).then(({newPortalItem, newScenarioID, scenarioFilter}) => {
          this.#geodesignhub.displayMessage(`New GeoPlanner scenario created: ${ gdhDesignName }`);

          // UPDATE NEW SCENARIO FEATURES //
          const updatedDesignFeaturesAsEsriJSON = this._updateScenarioCandidates({candidateFeatures: designFeaturesAsEsriJSON, newScenarioID});

          // ADD NEW GEOPLANNER SCENARIO FEATURES //
          this._addNewGeoPlannerScenarioFeatures({designFeaturesAsEsriJSON: updatedDesignFeaturesAsEsriJSON, newPortalItem}).then(({addFeaturesOIDs}) => {
            this.#geodesignhub.displayMessage(`Migration process complete: ${ addFeaturesOIDs.length } diagrams`);

            this.newScenarioLink.setAttribute('href', `https://${ this.#portal.urlKey }.${ this.#portal.customBaseUrl }/apps/mapviewer/index.html?layers=${ newScenarioID }`);
            this.completeSection.toggleAttribute('hidden', false);

          }).catch(error => {
            this.#geodesignhub.displayMessage(error);
          });
        }).catch(error => {
          this.#geodesignhub.displayMessage(error);
        });
      } else {
        this.#geodesignhub.displayMessage(new Error("All diagrams missing at least one Climate Action. No diagrams available for export."));
      }
    }).catch(error => {
      this.#geodesignhub.displayMessage(error);
    });
  }

  /**
   *
   *
   * @param {PortalUser} portalUser
   * @param {string} geoPlannerProjectID
   * @returns {Promise<{portalFolder: PortalFolder}>}
   * @private
   */
  _findGeoPlannerProjectFolder({portalUser, geoPlannerProjectID}) {
    return new Promise((resolve, reject) => {
      portalUser.fetchFolders().then((userFolders) => {

        const geoPlannerFolder = userFolders.find(folder => folder.title.endsWith(geoPlannerProjectID));

        resolve({portalFolder: geoPlannerFolder});
      }).catch(reject);
    });
  }

  /**
   *
   * PortalItem: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html
   *
   * @param {string} designTeamName
   * @param {string} designName
   * @returns {Promise<{newPortalItem: PortalItem, projectID: string, scenarioID: string, scenarioFilter: string}>}
   * @private
   */
  _createNewGeoPlannerScenarioPortalItem({designTeamName, designName}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/request',
        'esri/portal/PortalItem'
      ], (esriRequest, PortalItem) => {

        // PROJECT TYPEKEYWORD //
        const projectKeyword = this.#projectPortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));

        // SCENARIO TYPEKEYWORDS //
        const scenarioTypeKeywords = [
          'ArcGIS Server',
          'Data',
          'Feature Access',
          'Feature Service',
          projectKeyword,
          'geodesignScenario',
          'Service'
        ];

        // SCENARIO TAGS //
        const scenarioTags = ['geodesign', 'geodesignScenario', 'Geodesignhub'];

        //
        // CREATE NEW PORTAL ITEM FOR THE NEW SCENARIO //
        //
        // SUGGESTION: USE NEW DESIGN NAME AS THE PORTAL ITEM TITLE BELOW
        //             ALSO, WE CAN USE THE DESCRIPTION TO ADD ANY OTHER
        //             DESIGN RELATED METADATA
        //
        const newPortalItem = new PortalItem({
          type: this.#projectPortalItem.type,
          url: this.#projectPortalItem.url,
          title: designName,
          snippet: `GDH negotiated design by team ${ designTeamName }`,
          description: `The GDH negotiated design '${ designName }' by team ${ designTeamName } on ${ (new Date()).toLocaleString() }`,
          licenseInfo: this.#projectPortalItem.licenseInfo,
          accessInformation: this.#projectPortalItem.accessInformation,
          typeKeywords: scenarioTypeKeywords,
          tags: scenarioTags
        });

        // PORTAL USER //
        // - PortalUser: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html
        const portalUser = this.#portal.user;

        // FIND GEOPLANNER PROJECT FOLDER //
        this._findGeoPlannerProjectFolder({portalUser, geoPlannerProjectID: this.#gplProjectGroup.id}).then(({portalFolder}) => {

          // ADD ITEM PROPERTIES //
          const addItemProps = {item: newPortalItem};
          // IF USER HAS A MATCHING GEOPLANNER PROJECT FOLDER //
          portalFolder && (addItemProps.folder = portalFolder.id);

          //
          // ADD NEW PORTAL ITEM FOR THE NEW SCENARIO TO THE PORTAL //
          //  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalUser.html#addItem
          //
          portalUser.addItem(addItemProps).then(newScenarioPortalItem => {
            //console.info("NEW Scenario Portal Item: ", newScenarioPortalItem);

            // SCENARIO ID IS SAME AS THE NEW PORTAL ITEM ID //
            const newScenarioID = newScenarioPortalItem.id;
            // QUERY FILTER USED TO GET BACK SCENARIO SPECIFIC FEATURES //
            const scenarioFilter = `(Geodesign_ProjectID = '${ this.#gplProjectGroup.id }') AND (Geodesign_ScenarioID = '${ newScenarioID }')`;

            //
            // SET NEW SUBLAYER INFOS - DEFINITION EXPRESSION //
            //
            const updatedLayerPortalItemData = {
              layers: [
                {id: this.#gplConfig.ACTIONS_LAYER_ID, layerDefinition: {definitionExpression: scenarioFilter}},
                {id: this.#gplConfig.AOI_LAYER_ID, layerDefinition: {}}
              ]
            };

            // UPDATE ITEM DATA WITH NEW SUBLAYER DEFINITION
            // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#update
            newScenarioPortalItem.update({data: updatedLayerPortalItemData}).then((updatedScenarioPortalItem) => {
              //console.info("UPDATED Scenario Portal Item: ", updatedScenarioPortalItem);

              // VERIFY UPDATED SUBLAYER DEFINITION
              // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#fetchData
              updatedScenarioPortalItem.fetchData().then((updatedLayerPortalItemData) => {
                //console.info("UPDATED Scenario Portal Item Data: ", updatedLayerPortalItemData);

                // UPDATING PORTAL ITEM SHARING
                // https://developers.arcgis.com/rest/users-groups-and-items/share-item-as-item-owner-.htm
                const portalItemShareUrl = `${ updatedScenarioPortalItem.userItemUrl }/share`;
                esriRequest(portalItemShareUrl, {
                  query: {
                    everyone: false,
                    org: true,
                    groups: this.#gplProjectGroup.id,
                    f: 'json'
                  },
                  method: 'post'
                }).then((response) => {
                  resolve({
                    newPortalItem: updatedScenarioPortalItem,
                    newScenarioID,
                    scenarioFilter
                  });
                }).catch(error => {
                  this.#geodesignhub.displayMessage(error);
                });
              }).catch(error => {
                this.#geodesignhub.displayMessage(error);
              });
            }).catch(error => {
              this.#geodesignhub.displayMessage(error);
            });
          }).catch(error => {
            this.#geodesignhub.displayMessage(error);
          });
        }).catch(error => {
          this.#geodesignhub.displayMessage(error);
        });
      });
    });
  }

  /**
   *
   * THESE ARE UPDATES THAT WILL HAVE TO BE MADE TO ALL SCENARIO FEATURES BEFORE
   * ADDING THEM BACK TO THE FEATURE LAYER
   *
   * @param {{}[]} candidateFeatures
   * @param {string} newScenarioID
   * @returns {{geometry:{}, attributes:{}}[]}
   */
  _updateScenarioCandidates({candidateFeatures, newScenarioID}) {

    //
    // POLYGON CANDIDATE FEATURES //
    //
    // - ONLY FEATURES WITH POLYGON GEOMETRIES ALLOWED CURRENTLY...
    //
    const validDiagramFeatures = candidateFeatures.filter(diagramFeature => {
      // HERE WE CAN ADD OTHER VALIDITY CHECKS TO DIAGRAMS //
      return (diagramFeature.geometry.rings != null);
    });

    //
    // FEATURES TO BE ADDED TO NEW GPL SCENARIO //
    //
    const newFeaturesToAdd = validDiagramFeatures.map((diagramFeature) => {
      //console.info("diagramFeature: ", diagramFeature.attributes);

      // DIAGRAM INFORMATION //
      let {description, tag_codes, start_date, end_date, additional_metadata} = diagramFeature.attributes;

      // SOURCE ID = GLOBAL ID //
      let sourceID = null;

      // ACTION ID(S) //
      let actionIDs;
      let actionID;

      // HAS ACTION IDS //
      if (tag_codes?.length) {
        actionIDs = tag_codes.split('|');
        [actionID] = actionIDs;
      }

      // START AND END DATES //
      let startDate;
      let endDate;

      //
      // IF AVAILABLE VIA GDH ASSIGN DATES //
      //
      start_date && (startDate = new Date(start_date));
      end_date && (endDate = new Date(end_date));

      // ORIGINAL VALUES //
      if (additional_metadata) {

        // SOURCE ID = GLOBAL ID //
        sourceID = additional_metadata[this.#gplConfig.FIELD_NAMES.GLOBAL_ID];

        //
        // IF NO ACTION IDS //
        //  - IF tag_codes IS EMPTY THEN FALL BACK TO ORIGINAL VALUES //
        //
        if (!tag_codes?.length) {
          actionIDs = additional_metadata[this.#gplConfig.FIELD_NAMES.ACTION_IDS].split('|');
          [actionID] = actionIDs;
        }

        //
        // IF CLIMATE ACTION CHANGED BUT THE NAME HAS NOT, THEN UPDATE THE NAME TO INDICATE STATE //
        //
        const nameChanged = (description !== additional_metadata[this.#gplConfig.FIELD_NAMES.NAME]);
        const actionChanged = (actionID !== additional_metadata[this.#gplConfig.FIELD_NAMES.ACTION_ID]);
        if (actionChanged) {
          // IF THE ACTION ID HAS CHANGED BUT THE NAME HAS //
          // NOT THEN WE SHOULD NOT USE THE PREVIOUS NAME  //
          !nameChanged && (description = "[climate action changed]");
        }

        // START AND END DATES //
        //
        //  - IF NOT AVAILABLE VIA GDH THEN ASSIGN SOURCE DATES //
        //
        !startDate && (startDate = new Date(additional_metadata[this.#gplConfig.FIELD_NAMES.START_DATE] || this.#gplConfig.DATES.START));
        !endDate && (endDate = new Date(additional_metadata[this.#gplConfig.FIELD_NAMES.END_DATE] || this.#gplConfig.DATES.END));

      } else {
        additional_metadata = {};
      }

      // NEW SCENARIO FEATURE //
      const newScenarioFeature = {
        geometry: diagramFeature.geometry,
        attributes: {
          ...additional_metadata,                                         // START WITH ANY ADDITIONAL ATTRIBUTES //
          Geodesign_ProjectID: this.#gplProjectGroup.id,                  // GPL PROJECT ID - SHOULD BE THE SAME  //
          Geodesign_ScenarioID: newScenarioID,                            // GPL SCENARIO ID  //
          [this.#gplConfig.FIELD_NAMES.NAME]: description,                // GPL DIAGRAM NAME //
          [this.#gplConfig.FIELD_NAMES.SOURCE_ID]: sourceID,              // SOURCE ID = GLOBAL ID //
          [this.#gplConfig.FIELD_NAMES.ACTION_ID]: actionID,              // ACTION ID  //
          [this.#gplConfig.FIELD_NAMES.ACTION_IDS]: actionIDs.join('|'),  // ACTION IDS //
          [this.#gplConfig.FIELD_NAMES.START_DATE]: startDate.valueOf(),  // START DATE //
          [this.#gplConfig.FIELD_NAMES.END_DATE]: endDate.valueOf()       // END DATE   //
        }
      };
      //console.info("newScenarioFeature: ", newScenarioFeature.attributes);

      return newScenarioFeature;
    });

    return newFeaturesToAdd;
  }

  /**
   *
   * ADD THE CANDIDATE FEATURES TO THE GEOPLANNER PROJECT AS A NEW SCENARIO
   *
   * @param {Graphic[]} designFeaturesAsEsriJSON array of features as Esri JSON
   * @param {PortalItem} newPortalItem
   * @returns {Promise<{addFeaturesOIDs:number[]}>}
   */
  _addNewGeoPlannerScenarioFeatures({designFeaturesAsEsriJSON, newPortalItem}) {
    return new Promise((resolve, reject) => {
      require(['esri/request'], (esriRequest) => {

        //
        // https://developers.arcgis.com/rest/services-reference/enterprise/apply-edits-feature-service-layer-.htm
        //
        const geoPlannerScenarioLayerApplyEditsUrl = `${ newPortalItem.url }/${ this.#gplConfig.ACTIONS_LAYER_ID }/applyEdits`;
        esriRequest(geoPlannerScenarioLayerApplyEditsUrl, {
          query: {
            adds: JSON.stringify(designFeaturesAsEsriJSON),
            //rollbackOnFailure: false,
            f: 'json'
          },
          method: 'post'
        }).then((response) => {

          // RESULTS OF ADDING NEW FEATURES //
          const {addResults} = response.data;

          // LIST OF OBJECTIDS OF NEWLY ADDED FEATURES //
          // - APPLY EDITS RETURNS THE NEW OBJECTIDS OF ADDED FEATURES - OR ERROR IF FAILED //
          const addFeaturesOIDs = addResults.reduce((oids, addFeatureResult) => {
            return addFeatureResult.error ? oids : oids.concat(addFeatureResult.objectId);
          }, []);

          resolve({addFeaturesOIDs});
        }).catch(reject);
      });
    });
  }

}

customElements.define("diagram-exporter", DiagramExporter);

export default DiagramExporter;

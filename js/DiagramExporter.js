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
   * @type {GeodesignhubAPI}
   */
  #geodesignhub;

  /**
   *
   */
  constructor({container, portal, gplProjectGroup, geodesignhub}) {
    super();

    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);

    this.#portal = portal;
    this.#gplProjectGroup = gplProjectGroup;
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
      <h3>Migrate Geodesignhub Design as GeoPlanner Scenario</h3>                    
      <label>
        <div>Select Design Team</div>
        <select class="teams-list"></select>        
      </label>                       
      <label>
        <div>Select a Design</div>   
        <select class="team-design-list"></select>
      </label>
      <button class="migrate-selected-btn">Migrate Geodesignhub Design as GeoPlanner Scenario</button>
    `;

    this.container?.append(this);
  }

  /**
   *
   */
  connectedCallback() {

    this.teamsList = this.shadowRoot.querySelector('.teams-list');
    this.teamsList.addEventListener('change', () => {
      this.initializeTeamDesigns(this.teamsList.value);
    });
    this.teamDesignList = this.shadowRoot.querySelector('.team-design-list');
    this.migrateSelectedBtn = this.shadowRoot.querySelector('.migrate-selected-btn');
    this.migrateSelectedBtn.addEventListener('click', () => {
      this.migrateDesignAsScenario();
    });

    // INITIALIZE THE UI //
    this.getProjectPortalItem().then(({projectPortalItem}) => {
      this.#projectPortalItem = projectPortalItem;
      this.initializeDesignTeams();
    }).catch(error => {
      this.#geodesignhub.displayMessage(error.message);
    });

  }

  /**
   *
   */
  initializeDesignTeams() {
    this.#geodesignhub._gdhGetProjectDesignTeams().then(teamInfos => {
      const teamsItems = teamInfos.map(teamInfo => {
        const teamOption = document.createElement('option');
        teamOption.setAttribute("value", teamInfo.id);
        teamOption.innerHTML = teamInfo.title;
        return teamOption;
      });
      this.teamsList.replaceChildren(...teamsItems);
      this.initializeTeamDesigns(this.teamsList.value);
    }).catch(error => {
      this.#geodesignhub.displayMessage(error.message);
    });
  }

  /**
   *
   * @param designTeamId
   */
  initializeTeamDesigns(designTeamId) {
    this.#geodesignhub._gdhGetDesignTeamDesigns(designTeamId).then((designData) => {
      const designSynthesisData = designData.synthesis;
      const designItems = designSynthesisData.map(designSynthesis => {
        const designItem = document.createElement('option');
        designItem.setAttribute("value", designSynthesis.id);
        designItem.innerHTML = designSynthesis.description;
        return designItem;
      });
      this.teamDesignList.replaceChildren(...designItems);
    }).catch(error => {
      this.#geodesignhub.displayMessage(error.message);
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

    const gdhDesignTeamID = this.teamsList.options[this.teamsList.selectedIndex].id;
    const gdhDesignTeamName = this.teamsList.options[this.teamsList.selectedIndex].innerText;
    const gdhDesignID = this.teamDesignList.options[this.teamDesignList.selectedIndex].id;
    const gdhDesignName = this.teamDesignList.options[this.teamDesignList.selectedIndex].innerText;

    this.#geodesignhub._gdhGetDesignESRIJSON(gdhDesignTeamID, gdhDesignID).then(designFeaturesAsEsriJSON => {

      //
      // CREATE TARGET SCENARIO PORTAL ITEM //
      //  - THIS WILL GIVE US THE NECESSARY NEW SCENARIO ID...
      //
      this._createNewGeoPlannerScenarioPortalItem({
        designTeamName: gdhDesignTeamName,
        designName: gdhDesignName
      }).then(({newPortalItem, newScenarioID, scenarioFilter}) => {

        // UPDATE NEW SCENARIO FEATURES //
        //
        // - TODO: THESE MODIFICATIONS WILL HAVE TO HAPPEN AND WILL CHANGE AS WE MOVE THE PROJECT FORWARD...
        //
        const updatedDesignFeaturesAsEsriJSON = this._updateScenarioCandidates({candidateFeatures: designFeaturesAsEsriJSON, newScenarioID});
        console.info("Updated negotiated GDH diagrams as Esri features: ", updatedDesignFeaturesAsEsriJSON);

        // ADD NEW GEOPLANNER SCENARIO FEATURES //
        this._addNewGeoPlannerScenarioFeatures({designFeaturesAsEsriJSON: updatedDesignFeaturesAsEsriJSON, newPortalItem}).then(({addFeaturesOIDs}) => {
          //resolve({newPortalItem, newScenarioID, scenarioFilter, addFeaturesOIDs});

          const mapUrl = `https://igcollab.maps.arcgis.com/apps/mapviewer/index.html?layers=${ newScenarioID }`;
          console.info('New GeoPlanner Scenario Feature OIDs: ', addFeaturesOIDs, mapUrl);

          // TODO: CLOSE WINDOW OR SHOW CLOSE BUTTON ??
          // close();

        }).catch(error => {
          /*  error reporting here */
        });
      }).catch(error => {
        /*  error reporting here */
      });
    }).catch(error => {
      /*  error reporting here */
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

        const geoPlannerFolderName = `_ Geoplanner ${ geoPlannerProjectID }`;
        const geoPlannerFolder = userFolders.find(folder => folder.title === geoPlannerFolderName);

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

        // GET PORTAL ITEM DATA //
        //  - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#fetchData
        this.#projectPortalItem.fetchData().then((sourceLayerPortalItemData) => {
          //console.info("SOURCE Scenario Portal Item: ", this.sourcePortalItem);
          //console.info("SOURCE Scenario Portal Item Data: ", sourceLayerPortalItemData);

          // PROJECT TYPEKEYWORD //
          const projectKeyword = this.#projectPortalItem.typeKeywords.find(keyword => keyword.startsWith('geodesignProjectID'));

          // SCENARIO TYPEKEYWORDS //
          const scenarioTypeKeywords = [
            'ArcGIS API for JavaScript',
            'ArcGIS Server',
            'Data',
            'Feature Access',
            'Feature Service',
            projectKeyword,
            'geodesignScenario',
            'Service'
          ];

          // SCENARIO TAGS //
          // ADD GDH TAG TO IDENTIFY WHICH SCENARIOS CAME FROM GDH //
          const tags = new Set([this.#projectPortalItem.tags.concat(['GDH', 'geodesign', 'geodesignScenario'])]);

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
            title: `GDH design ${ designName } by team ${ designTeamName }`,
            snippet: `GDH negotiated design by team ${ designTeamName }`,
            description: `The GDH negotiated design ${ designName } by team ${ designTeamName }.`,
            licenseInfo: 'Restricted use for International Geodesign Collaboration activities only.',
            accessInformation: 'International Geodesign Collaboration',
            typeKeywords: scenarioTypeKeywords, // THE PROJECT ID WILL BE IN ONE OF THE TYPEKEYWORDS
            tags: Array.from(tags.values())
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
              // SET NEW LAYER DEFINITION EXPRESSION //
              //
              const updatedLayerPortalItemData = {...sourceLayerPortalItemData};
              updatedLayerPortalItemData.layers[this.interventionLayerId].layerDefinition = {definitionExpression: scenarioFilter};
              //console.info("UPDATE to Scenario Portal Item Data", updatedLayerPortalItemData);

              // UPDATE ITEM DATA WITH NEW SUBLAYER DEFINITION
              // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#update
              newScenarioPortalItem.update({data: updatedLayerPortalItemData}).then((updatedScenarioPortalItem) => {
                //console.info("UPDATED Scenario Portal Item: ", updatedScenarioPortalItem);

                // VERIFY UPDATED SUBLAYER DEFINITION
                // - https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-PortalItem.html#fetchData
                updatedScenarioPortalItem.fetchData().then((updatedLayerPortalItemData) => {
                  //console.info("UPDATED Scenario Portal Item Data: ", updatedLayerPortalItemData);

                  //
                  // UPDATING PORTAL ITEM SHARING
                  //
                  // https://developers.arcgis.com/rest/users-groups-and-items/share-item-as-item-owner-.htm
                  //
                  const portalItemShareUrl = `${ updatedScenarioPortalItem.userItemUrl }/share`;
                  esriRequest(portalItemShareUrl, {
                    query: {
                      everyone: false,
                      org: false,
                      groups: this.sourcePortalGroup.id,
                      f: 'json'
                    },
                    method: 'post'
                  }).then((response) => {

                    resolve({
                      newPortalItem: updatedScenarioPortalItem,
                      newScenarioID,
                      scenarioFilter
                    });

                  }).catch(console.error);
                }).catch(console.error);
              }).catch(console.error);
            }).catch(console.error);
          }).catch(console.error);
        }).catch(console.error);

      });
    });
  }

  /**
   *
   * THESE ARE UPDATES THAT WILL HAVE TO BE MADE TO ALL SCENARIO FEATURES BEFORE
   * ADDING THEM BACK TO THE FEATURE LAYER
   *
   *
   * @param {{}[]} candidateFeatures
   * @param {string} newScenarioID
   * @returns {{geometry:{}, attributes:{}}[]}
   */
  _updateScenarioCandidates({candidateFeatures, newScenarioID}) {
    //
    // CREATE A FEATURE FOR EACH DIAGRAM
    //
    // - NOTE: ONLY FEATURES WITH POLYGON GEOMETRIES ALLOWED CURRENTLY...
    //
    // - TODO: AGGREGATE MULTIPLE FEATURES WITH SAME GLOBALID...
    //         - COMBINE ALL ACTION IDS PER GLOBAL ID
    //         - GEOMETRY HAS CHANGES? - HOW TO TRACK?
    //         - NO ACTION ID?
    //         - DIFFERENT NAMES?
    //         - MISSING GLOBALID = NEW GDH DIAGRAM
    //         - ???
    //

    //
    // VALID CANDIDATE FEATURES //
    //
    const validDiagramFeatures = candidateFeatures.filter(diagramFeature => {
      //
      // HERE WE CAN ADD OTHER VALIDITY CHECKS TO DIAGRAMS //
      //
      return (diagramFeature.geometry.rings != null);
    });

    //
    // FEATURES TO BE ADDED TO NEW GPL SCENARIO //
    //
    let newFeaturesToAdd;

    const supportsMultipleActionsPerDiagram = false;
    if (supportsMultipleActionsPerDiagram) {

      //
      // MULTIPLE ACTIONS PER DIAGRAM
      //
      const featuresByGlobalID = validDiagramFeatures.reduce((byGlobalID, diagramFeature) => {

        const globalID = diagramFeature.attributes.notes.globalid || diagramFeature.attributes.notes;

        let featureByGlobalID;

        if (globalID?.length && byGlobalID.has(globalID)) {
          featureByGlobalID = byGlobalID.get(globalID);
          featureByGlobalID.attributes.ACTION_IDS += `|${ diagramFeature.attributes.tag_codes }`;
        } else {
          featureByGlobalID = {
            geometry: diagramFeature.geometry,
            attributes: {
              Geodesign_ProjectID: this.#gplProjectGroup.id,
              Geodesign_ScenarioID: newScenarioID,
              SOURCE_ID: globalID,
              ACTION_IDS: diagramFeature.attributes.tag_codes,
              name: diagramFeature.attributes.description
            }
          };
        }

        byGlobalID.set(globalID, featureByGlobalID);

        return byGlobalID;
      }, new Map());

      //
      // NEW GPL SCENARIO FEATURES TO ADD //
      //
      newFeaturesToAdd = Array.from(featuresByGlobalID.values());

    } else {
      //
      // SINGLE ACTION PER DIAGRAM
      //
      newFeaturesToAdd = validDiagramFeatures.map((diagramFeature) => {

        const globalID = diagramFeature.attributes.notes.globalid || diagramFeature.attributes.notes;

        const newScenarioFeature = {
          geometry: diagramFeature.geometry,
          attributes: {
            Geodesign_ProjectID: this.#gplProjectGroup.id,
            Geodesign_ScenarioID: newScenarioID,
            SOURCE_ID: globalID,
            ACTION_IDS: diagramFeature.attributes.tag_codes,
            name: diagramFeature.attributes.description
          }
        };

        return newScenarioFeature;
      });
    }

    //
    // MULTIPLE ACTIONS PER DIAGRAM
    //
    /*const featuresByGlobalID = validDiagramFeatures.reduce((byGlobalID, diagramFeature) => {

     const globalID = diagramFeature.attributes.notes.globalid || diagramFeature.attributes.notes;

     let featureByGlobalID;

     if (globalID?.length && byGlobalID.has(globalID)) {
     featureByGlobalID = byGlobalID.get(globalID);
     featureByGlobalID.attributes.ACTION_IDS += `|${ diagramFeature.attributes.tag_codes }`;
     } else {
     featureByGlobalID = {
     geometry: diagramFeature.geometry,
     attributes: {
     Geodesign_ProjectID: this.#gplProjectGroup.id,
     Geodesign_ScenarioID: newScenarioID,
     SOURCE_ID: globalID,
     ACTION_IDS: diagramFeature.attributes.tag_codes,
     name: diagramFeature.attributes.description
     }
     };
     }

     byGlobalID.set(globalID, featureByGlobalID);

     return byGlobalID;
     }, new Map());*/

    //
    // NEW GPL SCENARIO FEATURES TO ADD //
    //
    //const newFeaturesToAdd = Array.from(featuresByGlobalID.values());
    console.info("Aggregated new features to add: ", newFeaturesToAdd);

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
        const geoPlannerScenarioLayerApplyEditsUrl = `${ newPortalItem.url }/${ this.interventionLayerId }/applyEdits`;
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
            console.assert(!addFeatureResult.error, addFeatureResult.error);
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

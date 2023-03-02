/*
 Copyright 2023 Esri

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

import DiagramImporter from './DiagramImporter.js';
import EsriBridgeWelcome from './EsriBridgeWelcome.js';
import DiagramExporter from './DiagramExporter.js';
import GeodesignhubAPI from './GeodesignhubAPI.js';

/**
 *
 * EsriBridge
 *  - Bridge for GeoPlanner and Geodesignhub
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/14/2023 - 0.0.1 -
 * Modified:
 *
 * ASANA PROJECT: https://app.asana.com/0/1203835742423665/list
 *
 */

class EsriBridge extends EventTarget {

  static version = '0.0.1';

  /**
   *
   * USED TO CONFIGURE LAYER AND FIELD NAMES
   *
   * @typedef {{FIELD_NAMES: {ACTION_IDS: string, SOURCE_ID: string, DESCRIPTION: string, ACTION_ID: string, GLOBAL_ID: string, NAME: string}, ACTIONS_LAYER_ID: number}} GPLConfig
   */

  /**
   *
   * @type {GPLConfig}
   */
  static GPL_CONFIG = {
    ACTIONS_LAYER_ID: 0,
    FIELD_NAMES: {
      GLOBAL_ID: 'GlobalID',
      SOURCE_ID: 'SOURCE_ID',
      NAME: 'Name',
      DESCRIPTION: 'Description',
      ACTION_ID: 'Type',
      ACTION_IDS: 'Policy_Action_IDS'
    }
  };

  /**
   *
   * NOTE: HERE WE CAN MAINTAIN BOTH APP IDS AND WE CAN
   *       SWITCH LOCALLY WHILE TESTING...
   *
   * @type {{PORTAL_URL: string}}
   */
  static CONFIG = {
    PORTAL_URL: "https://www.arcgis.com/"
  };

  /**
   *
   * @type {{IMPORT: string, EXPORT: string, WELCOME: string}}
   */
  static MODES = {
    WELCOME: 'welcome',
    IMPORT: 'import',
    EXPORT: 'export'
  };

  static USE_IGC_BRIDGE_EXTENSIONS = true;

  constructor() {
    super();

    //
    // URL SEARCH PARAMETERS //
    //
    const urlParameters = new URLSearchParams(window.location.search);
    console.info("URL Parameters: ", urlParameters.toString());

    // GEODESIGNHUB SPECIFIC //
    const gdhAPIToken = urlParameters.get('apitoken');
    const gdhProjectId = urlParameters.get('projectid');
    const gdhDesignTeamId = urlParameters.get('cteamid');
    const gdhDesignId = urlParameters.get('synthesisid');

    // GEOPLANNER SPECIFIC //
    const gplProjectId = urlParameters.get('gplProjectId');
    const arcgisToken = urlParameters.get('arcgisToken');

    // MODE //
    const mode = urlParameters.get('mode') || EsriBridge.MODES.WELCOME;

    // IMPORT AND EXPORT MODULES //
    let diagramImporter;
    let diagramExporter;

    //
    // WELCOME MODULE //
    // - INITIALLY SHOW WELCOME //
    //
    const bridgeWelcome = new EsriBridgeWelcome({container: 'welcome-container'});

    // ABOUT BUTTON //
    const aboutBtn = document.getElementById('about-btn');
    aboutBtn.addEventListener('click', () => {
      const isActive = aboutBtn.classList.toggle('active');
      aboutBtn.innerHTML = isActive ? mode : 'about';
      bridgeWelcome.container.toggleAttribute('hidden', !isActive);
      diagramImporter?.container.toggleAttribute('hidden', isActive);
      diagramExporter?.container.toggleAttribute('hidden', isActive);
    });

    // ARE ALL VALUES VALID = NOT NULL OR EMPTY STRING //
    const _validate = values => values.every(value => value?.length > 0);

    // GEODESIGNHUB API //
    const geodesignhub = new GeodesignhubAPI({
      container: 'gdh-api-container',
      gplConfig: EsriBridge.GPL_CONFIG,
      gdhAPIToken: gdhAPIToken,
      gdhProjectId: gdhProjectId
    });
    // VALIDATE GDH API TOKEN AND PROJECT ID //
    geodesignhub.addEventListener('ready', () => {
      geodesignhub.toggleAttribute('hidden', true);

      // VALIDATE ARCGIS TOKEN //
      if (_validate([arcgisToken, gplProjectId])) {

        // AUTHENTICATE AND INITIALIZE PORTAL //
        this.authenticateArcGISOnline({arcgisToken}).then(({portal}) => {
          // GEOPLANNER GROUP //
          this.getGeoPlannerGroup({portal, gplProjectId}).then(({gplProjectGroup}) => {
            // MODE URL PARAMETER //
            switch (mode) {
              case EsriBridge.MODES.IMPORT:
                //
                // DIAGRAM IMPORTER //
                //
                diagramImporter = new DiagramImporter({
                  container: 'import-container',
                  geodesignhub: geodesignhub,
                  portal: portal,
                  gplConfig: EsriBridge.GPL_CONFIG,
                  gplProjectGroup: gplProjectGroup
                });
                bridgeWelcome.container.toggleAttribute('hidden', true);
                diagramImporter.container.toggleAttribute('hidden', false);
                geodesignhub.toggleAttribute('hidden', false);
                aboutBtn.toggleAttribute('hidden', false);
                break;

              case EsriBridge.MODES.EXPORT:
                if (_validate([gdhDesignTeamId, gdhDesignId])) {
                  //
                  // DIAGRAM EXPORTER
                  //
                  diagramExporter = new DiagramExporter({
                    container: 'export-container',
                    geodesignhub: geodesignhub,
                    portal: portal,
                    gplConfig: EsriBridge.GPL_CONFIG,
                    gplProjectGroup: gplProjectGroup,
                    gdhDesignTeamId: gdhDesignTeamId,
                    gdhDesignId: gdhDesignId
                  });
                  bridgeWelcome.container.toggleAttribute('hidden', true);
                  diagramExporter.container.toggleAttribute('hidden', false);
                  geodesignhub.toggleAttribute('hidden', false);
                  aboutBtn.toggleAttribute('hidden', false);
                } else {
                  geodesignhub.displayMessage(`Missing information about the selected design team and/or design.`);
                }
                break;
            }
          }).catch(error => {
            geodesignhub.displayMessage(error);
          });
        }).catch(error => {
          geodesignhub.displayMessage(error);
        });
      } else {
        geodesignhub.displayMessage("Missing ArcGIS token or GPL Project Id.");
      }
    });

  }

  /**
   *
   * IdentityManager: https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-IdentityManager.html
   * Portal: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-Portal.html
   *
   * @param {string} arcgisToken
   * @returns {Promise<{portal:Portal}>}
   */
  authenticateArcGISOnline({arcgisToken}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/identity/IdentityManager',
        'esri/portal/Portal'
      ], (esriId, Portal) => {

        // SHARING URL //
        const portalSharingURL = `${ EsriBridge.CONFIG.PORTAL_URL }/sharing`;

        // REGISTER ARCGIS TOKEN //
        esriId.registerToken({
          server: portalSharingURL,
          token: arcgisToken
        });

        // PORTAL //
        //  - IGC ORG IN ARCGIS.COM
        const portal = new Portal({url: EsriBridge.CONFIG.PORTAL_URL});

        // CHECK THE SIGN-IN STATUS
        esriId.checkSignInStatus(portalSharingURL).then(() => {
          return esriId.getCredential(portalSharingURL);
        }).catch(() => {
          // IF USER IS NOT ALREADY SIGNED-IN IN THE BROWSER THEN ASK THE USER TO SIGN IN NOW... //
          portal.authMode = 'immediate';
        }).then(() => {
          // LOAD PORTAL //
          portal.load().then(() => {
            console.info(`Signed in user: ${ portal.user?.username || 'none' }`);
            resolve({portal});
          }).catch(reject);
        });
      });

    });
  }

  /**
   *
   * @param {Portal} portal
   * @param {string} gplProjectId
   * @returns {Promise<{gplProjectGroup:PortalGroup}>}
   * @private
   */
  getGeoPlannerGroup({portal, gplProjectId}) {
    return new Promise((resolve, reject) => {
      /**
       * ASK PORTAL TO FIND GEOPLANNER GROUP
       *  - group with specific id and tags of geodesign and geodesignScenario
       */
      portal.queryGroups({
        query: `id:${ gplProjectId } tags:(geodesign AND geodesignProject)`,
        num: 1
      }).then(({results}) => {
        if (results.length) {
          resolve({gplProjectGroup: results[0]});
        } else {
          reject(new Error(`Can't find GeoPlanner Project: ${ gplProjectId }`));
        }
      }).catch(reject);
    });
  }

}

export default new EsriBridge();



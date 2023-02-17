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
   * NOTE: HERE WE CAN MAINTAIN BOTH APP IDS AND WE CAN
   *       SWITCH LOCALLY WHILE TESTING...
   *
   * @type {{OAUTH_APP_ID: string, PORTAL_URL: string}}
   */
  static CONFIG = {
    PORTAL_URL: "https://www.arcgis.com/"
    //OAUTH_APP_ID: "L7TzVXFYcEkBe7qz"  // HB //
    //OAUTH_APP_ID: "PZdAgiu187TroTCX"    // JG //
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

  /**
   * @type {Portal}
   */
  #portal;

  /**
   * @type {string}
   */
  #gdhProjectId;

  /**
   * @type {string}
   */
  #gplProjectId;

  /**
   * @type {PortalGroup}
   */
  #gplProjectGroup;

  /**
   * @type {string}
   */
  #gdhAPIToken;

  /**
   * @type {string}
   */
  #arcgisToken;

  constructor() {
    super();

    /*if (window.name !== 'bridge') {
     const size = {
     width: 1024,
     height: 700
     };
     const pos = {
     top: ((window.screen.availHeight - size.height) * 0.5),
     left: ((window.screen.availWidth - size.width) * 0.5)
     };
     window.open(location.href, 'bridge', `top=${ pos.top },left=${ pos.left },width=${ size.width },height=${ size.height }`);
     }*/

    //
    // BRIDGE WELCOME //
    // - INITIALLY SHOW WELCOME //
    //
    const bridgeWelcome = new EsriBridgeWelcome({container: 'welcome-container'});

    //
    // URL SEARCH PARAMETERS //
    //
    const urlParameters = new URLSearchParams(window.location.search);
    this.#gdhProjectId = urlParameters.get('gdhProjectId') || '184cd61c05e0e2c7';
    this.#gdhAPIToken = urlParameters.get('gdhAPIToken') || 'c0ae02b64a7e0ca453231143ae2fe2d8202e51e8';
    this.#arcgisToken = urlParameters.get('arcgisToken') || 'XbVAIgYG2gNTuBKecngWU5UYcEJan-L2BWAfE0rWv4FTemnudPn3W4Fy0hc0-p56uuA-ph8wRHS2QjLk4U72SaE7y4lkRqYBeGV-sVZfzo9uyRhpb1589mrn4AsiH5DYGt3slz-N6_qFXTFxGohhyf56Qu8JczSiEKUFIbEgIrrJBiINPrgN55_-di6P1FD-pS0MugJ7mw-M9YzHKMfM5LTooaU0eJiHRacPkMYHa2I.';
    this.#gplProjectId = urlParameters.get('gplProjectId') || 'bd92225f9c0645e0b1f6a50faa93ef9a'; // 8722fceaa08b4f32bc51896f1dcfa8da

    // ARE ALL VALUES VALID = NOT NULL OR EMPTY STRING //
    const _validate = values => values.every(value => value?.length > 0);

    // VALIDATE GDH API TOKEN AND PROJECT ID //
    if (_validate([this.#gdhAPIToken, this.#gdhProjectId])) {

      // GEODESIGNHUB API //
      const geodesignhub = new GeodesignhubAPI({
        container: 'gdh-api-container',
        gdhAPIToken: this.#gdhAPIToken,
        gdhProjectId: this.#gdhProjectId
      });
      geodesignhub.toggleAttribute('hidden', true);

      // VALIDATE ARCGIS TOKEN //
      if (_validate([this.#arcgisToken, this.#gplProjectId])) {

        // AUTHENTICATE AND INITIALIZE PORTAL //
        this.authenticateArcGISOnline().then(({portal}) => {
          // ARCGIS PORTAL //
          this.#portal = portal;

          // GEOPLANNER GROUP //
          this.getGeoPlannerGroup().then(({gplProjectGroup}) => {
            this.#gplProjectGroup = gplProjectGroup;

            // MODE URL PARAMETER //
            const mode = urlParameters.get('mode');
            switch (mode) {
              case 'import': // MODE IMPORT //
                //
                // DIAGRAM IMPORTER //
                //
                const diagramImporter = new DiagramImporter({
                  container: 'import-container',
                  portal: this.#portal,
                  gplProjectGroup: this.#gplProjectGroup,
                  geodesignhub: geodesignhub
                });
                bridgeWelcome.toggleAttribute('hidden', true);
                geodesignhub.toggleAttribute('hidden', false);
                break;

              case 'export': // MODE EXPORT //
                //
                // DIAGRAM EXPORTER
                //
                const diagramExporter = new DiagramExporter({
                  container: 'export-container',
                  portal: this.#portal,
                  gplProjectGroup: this.#gplProjectGroup,
                  geodesignhub: geodesignhub
                });
                bridgeWelcome.toggleAttribute('hidden', true);
                geodesignhub.toggleAttribute('hidden', false);
                break;
            }
          }).catch(error => {
            geodesignhub.displayMessage(error.message);
          });
        }).catch(error => {
          geodesignhub.displayMessage(error.message);
        });
      } else {
        geodesignhub.displayMessage("Missing ArcGIS token or GPL Project Id.");
      }
    }
  }

  /**
   *
   * IdentityManager: https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-IdentityManager.html
   * OAuthInfo: https://developers.arcgis.com/javascript/latest/api-reference/esri-identity-OAuthInfo.html
   * Portal: https://developers.arcgis.com/javascript/latest/api-reference/esri-portal-Portal.html
   *
   * @returns {Promise<Portal>}
   */
  authenticateArcGISOnline() {
    return new Promise((resolve, reject) => {
      require([
        'esri/identity/IdentityManager',
        'esri/identity/OAuthInfo',
        'esri/portal/Portal'
      ], (esriId, OAuthInfo, Portal) => {

        // SHARING URL //
        const portalSharingURL = `${ EsriBridge.CONFIG.PORTAL_URL }/sharing`;

        esriId.registerToken({
          server: portalSharingURL,
          token: this.#arcgisToken
        });

        // CONFIGURE OAUTH //
        /*const oauthInfo = new OAuthInfo({
         portalUrl: EsriBridge.CONFIG.PORTAL_URL,
         appId: EsriBridge.CONFIG.OAUTH_APP_ID,
         popup: true
         });
         esriId.registerOAuthInfos([oauthInfo]);*/

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
   * @returns {Promise<{gplProjectGroup:PortalGroup}>}
   * @private
   */
  getGeoPlannerGroup() {
    return new Promise((resolve, reject) => {

      /**
       * ASK PORTAL TO FIND GEOPLANNER GROUP
       *  - groups with these tags: geodesign | geodesignScenario
       *  - group with specific id
       */
      this.#portal.queryGroups({
        //query: 'tags:(geodesign AND geodesignProject)',
        query: `id:${ this.#gplProjectId }`,
        num: 1
      }).then(({results}) => {
        //console.info(results);
        resolve({gplProjectGroup: results[0]});
      }).catch(reject);
    });
  }

}

export default new EsriBridge();


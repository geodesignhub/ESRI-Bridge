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
 * EsriBridgeWelcome
 *  - Element: bridge-welcome
 *  - Description: Esri Bridge Welcome
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/14/2023 - 0.0.1 -
 * Modified:
 *
 */

class EsriBridgeWelcome extends HTMLElement {

  static version = '0.0.1';

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   *
   */
  constructor({container}) {
    super();

    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {}      
        :host .welcome-message-container {          
          height: calc(100vh - 390px);
        }
      </style>
      <div class="welcome-message-container">      
        <h4>Who is this for?</h4>
        <p>This bridge is meant for Geodesignhub project administrators and who want to migrate data between a specially configured Geodesignhub projects into ArcGIS (and vice versa). Some actions are irreversible so please review the workflow documentation before proceeding, you can also contact via <a href="https://community.geodesignhub.com">Geodesignhub Community</a> portal in case of questions.</p>
        <h4>Before you begin</h4>
        <p>To use this bridge, you will need an account in <a href="https://www.arcgis.com/index.html">ArcGIS online</a> and be a part of an ArcGIS Organization. On the <a href="https://www.geodesignhub.com">Geodesignhub</a> side, you must be a member of a Geodesignhub project. 
        </p>
        <h4>Step by step instruction</h4>
        <h5>Worflow 1: Geoplanner / ArcGIS Organization -> Geodesignhub</h5>
        <p><strong>Estimated time: 3 min.</strong></p>
        <p>Follow these instructions step by step to do a migration of Geoplanner data into Geodesignhub as diagrams.</p>
        <ol>
          <li>Authenticate yourself via OAuth to ESRI Systems, this should populate the GeoPlanner groups</li>
          <li>Find GeoPlanner Project Groups
            <ol>
              <li>Select one Group</li>
            </ol>
          </li>
          <li>Find GeoPlanner Scenario Portal Items in selected Group
            <ol>
              <li>Select one Portal Item</li>
            </ol>
          </li>
          <li>Query GeoPlanner Scenario features as GeoJSON</li>
          <li>Input your Geodesignhub Project ID and API Token and press "Verify Project", this will verify that the target project in Geodesignhub is correctly configured.</li>
          <li>After verification checks have passed, you will see a "Migrate Diagrams" button this one time process will migrate the selected data from Geoplanner into Geodesignhub project as diagrams.</li>
        </ol>        
        <h5>Worflow 2: Negotiated Design from Geodesignhub -> Geoplanner / ArcGIS Scenario</h5>
        <p><strong>Estimated time: 1 min.</strong></p>
        <p>Follow these instructions step by step to do a migration of Geodesignhub diagrams as new Geoplanner scenario.</p>        
        <ol>
          <li>Select the design team from Geodesignhub from the dropdown</li>
          <li>Select the specific design that you want to migrate to Geoplanner</li>
          <li>Add GDH Design diagrams/features as new features to the Scenario Portal Item
            <ul>
              <li>Confirm number of added features</li>
            </ul>
          </li>
        </ol>
      </div>    
    `;

    this.container?.append(this);
  }

  /**
   *
   */
  connectedCallback() {

  }

}

customElements.define("bridge-welcome", EsriBridgeWelcome);

export default EsriBridgeWelcome;

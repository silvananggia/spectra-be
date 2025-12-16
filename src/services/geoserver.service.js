const axios = require('axios');
const logger = require('../utils/logger');

/**
 * GeoServer REST API Service
 * Handles all interactions with GeoServer via REST API
 */
class GeoServerService {
  constructor() {
    this.baseURL = process.env.GEOSERVER_URL || 'http://geoserver:8080/geoserver';
    this.username = process.env.GEOSERVER_USER || 'admin';
    this.password = process.env.GEOSERVER_PASSWORD || 'geoserver';
    this.workspace = process.env.GEOSERVER_WORKSPACE || 'spectra';

    // Create axios instance with basic auth
    this.api = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.username,
        password: this.password,
      },
      headers: {
        'Content-Type': 'application/xml',
      },
      timeout: 30000,
    });
  }

  /**
   * Create workspace if it doesn't exist
   */
  async createWorkspace(workspaceName = null) {
    const ws = workspaceName || this.workspace;
    
    try {
      // Check if workspace exists
      const response = await this.api.get(`/rest/workspaces/${ws}.json`);
      if (response.status === 200) {
        logger.info(`Workspace ${ws} already exists`);
        return true;
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    try {
      // Create workspace
      const workspaceXML = `<workspace><name>${ws}</name></workspace>`;
      await this.api.post(`/rest/workspaces`, workspaceXML, {
        headers: { 'Content-Type': 'application/xml' },
      });
      logger.info(`Created workspace: ${ws}`);
      return true;
    } catch (error) {
      logger.error(`Failed to create workspace ${ws}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create PostGIS datastore
   */
  async createPostGISDataStore(datastoreName, connectionParams) {
    await this.createWorkspace();

    const {
      host,
      port,
      database,
      user,
      password,
      schema = 'public',
      dbtype = 'postgis',
    } = connectionParams;

    try {
      // Check if datastore exists
      try {
        await this.api.get(`/rest/workspaces/${this.workspace}/datastores/${datastoreName}.json`);
        logger.info(`DataStore ${datastoreName} already exists`);
        return true;
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // Create datastore
      const datastoreXML = `
        <dataStore>
          <name>${datastoreName}</name>
          <type>PostGIS</type>
          <enabled>true</enabled>
          <connectionParameters>
            <entry key="host">${host}</entry>
            <entry key="port">${port}</entry>
            <entry key="database">${database}</entry>
            <entry key="schema">${schema}</entry>
            <entry key="user">${user}</entry>
            <entry key="passwd">${password}</entry>
            <entry key="dbtype">${dbtype}</entry>
            <entry key="Evictor run periodicity">300</entry>
            <entry key="Max open prepared statements">50</entry>
            <entry key="encode functions">false</entry>
            <entry key="Support on the fly geometry simplification">true</entry>
            <entry key="create database">false</entry>
            <entry key="preparedStatements">false</entry>
            <entry key="Loose bbox">true</entry>
            <entry key="Expose primary keys">true</entry>
            <entry key="validate connections">true</entry>
            <entry key="Connection timeout">20</entry>
            <entry key="min connections">1</entry>
            <entry key="max connections">10</entry>
          </connectionParameters>
        </dataStore>
      `;

      await this.api.post(
        `/rest/workspaces/${this.workspace}/datastores`,
        datastoreXML,
        {
          headers: { 'Content-Type': 'application/xml' },
        }
      );

      logger.info(`Created PostGIS DataStore: ${datastoreName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to create DataStore ${datastoreName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publish feature type (vector layer) from PostGIS table
   */
  async publishFeatureType(datastoreName, layerName, nativeName = null) {
    await this.createWorkspace();
    const native = nativeName || layerName;

    try {
      // Check if feature type exists
      try {
        await this.api.get(
          `/rest/workspaces/${this.workspace}/datastores/${datastoreName}/featuretypes/${layerName}.json`
        );
        logger.info(`FeatureType ${layerName} already exists`);
        return true;
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // Create feature type
      const featureTypeXML = `
        <featureType>
          <name>${layerName}</name>
          <nativeName>${native}</nativeName>
          <enabled>true</enabled>
          <store class="dataStore">
            <name>${datastoreName}</name>
          </store>
        </featureType>
      `;

      await this.api.post(
        `/rest/workspaces/${this.workspace}/datastores/${datastoreName}/featuretypes`,
        featureTypeXML,
        {
          headers: { 'Content-Type': 'application/xml' },
        }
      );

      logger.info(`Published FeatureType: ${layerName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to publish FeatureType ${layerName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create coverage store for GeoTIFF
   */
  async createCoverageStore(storeName, geotiffPath) {
    await this.createWorkspace();

    try {
      // Check if coverage store exists
      try {
        await this.api.get(`/rest/workspaces/${this.workspace}/coveragestores/${storeName}.json`);
        logger.info(`CoverageStore ${storeName} already exists`);
        return true;
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // Create coverage store (using file path)
      const coverageStoreXML = `
        <coverageStore>
          <name>${storeName}</name>
          <type>GeoTIFF</type>
          <enabled>true</enabled>
          <workspace>
            <name>${this.workspace}</name>
          </workspace>
          <url>file:${geotiffPath}</url>
        </coverageStore>
      `;

      await this.api.post(
        `/rest/workspaces/${this.workspace}/coveragestores`,
        coverageStoreXML,
        {
          headers: { 'Content-Type': 'application/xml' },
        }
      );

      logger.info(`Created CoverageStore: ${storeName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to create CoverageStore ${storeName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publish coverage (raster layer) from coverage store
   */
  async publishCoverage(storeName, coverageName) {
    await this.createWorkspace();

    try {
      // Check if coverage exists
      try {
        await this.api.get(
          `/rest/workspaces/${this.workspace}/coveragestores/${storeName}/coverages/${coverageName}.json`
        );
        logger.info(`Coverage ${coverageName} already exists`);
        return true;
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // Create coverage
      const coverageXML = `
        <coverage>
          <name>${coverageName}</name>
          <nativeName>${coverageName}</nativeName>
          <enabled>true</enabled>
          <store class="coverageStore">
            <name>${storeName}</name>
          </store>
        </coverage>
      `;

      await this.api.post(
        `/rest/workspaces/${this.workspace}/coveragestores/${storeName}/coverages`,
        coverageXML,
        {
          headers: { 'Content-Type': 'application/xml' },
        }
      );

      logger.info(`Published Coverage: ${coverageName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to publish Coverage ${coverageName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get WMS capabilities URL
   */
  getWMSCapabilitiesURL(layerName) {
    return `${this.baseURL}/${this.workspace}/wms?service=WMS&version=1.1.0&request=GetCapabilities`;
  }

  /**
   * Get WMS layer URL
   */
  getWMSLayerURL(layerName) {
    return `${this.baseURL}/${this.workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${this.workspace}:${layerName}&styles=&format=image/png`;
  }

  /**
   * Delete layer from GeoServer
   */
  async deleteLayer(layerName, layerType = 'featuretype') {
    try {
      const datastoreName = process.env.GEOSERVER_DATASTORE || 'postgis';
      
      if (layerType === 'featuretype') {
        await this.api.delete(
          `/rest/workspaces/${this.workspace}/datastores/${datastoreName}/featuretypes/${layerName}?recurse=true`
        );
      } else if (layerType === 'coverage') {
        await this.api.delete(
          `/rest/workspaces/${this.workspace}/coveragestores/${datastoreName}/coverages/${layerName}?recurse=true`
        );
      }
      
      logger.info(`Deleted ${layerType}: ${layerName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete layer ${layerName}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new GeoServerService();


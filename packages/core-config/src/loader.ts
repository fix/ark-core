import { configManager } from "@arkecosystem/crypto";
import * as axios from "axios";
import * as dirTree from "directory-tree";
import * as fs from "fs-extra";
import * as ow from "ow";
import * as path from "path";

class ConfigLoader {
  public network: any;
  public peers: any;
  public delegates: any;
  public genesisBlock: any;

  private options: any;

  /**
   * Make the config instance.
   * @param  {Object} options
   * @return {ConfigLoader}
   */
  public async setUp(options: object = {}): Promise<this> {
    this.options = options;
    this.network = JSON.parse(process.env.ARK_NETWORK);

    await this.__createFromDirectory();

    this._validateConfig();

    this.configureCrypto();

    return this;
  }

  /**
   * Get constants for the specified height.
   * @param  {Number} height
   * @return {void}
   */
  public getConstants(height): void {
    return configManager.getConstants(height);
  }

  /**
   * Configure the crypto package.
   * @return {void}
   */
  public configureCrypto(): void {
    configManager.setConfig(this.network);
  }

  /**
   * Copy the config files to the given destination.
   * @param  {String} dest
   * @return {Promise}
   */
  public async copyFiles(dest): Promise<any> {
    if (!dest) {
      dest = `${process.env.ARK_PATH_DATA}/config`;
    }

    await fs.ensureDir(dest);

    return fs.copy(process.env.ARK_PATH_CONFIG, dest);
  }

  /**
   * Load and bind the config.
   * @return {void}
   */
  public async __createFromDirectory(): Promise<void> {
    const files: Record<string, string> = this.__getFiles();

    this.__createBindings(files);

    await this.__buildPeers(files.peers);
  }

  /**
   * Bind the config values to the instance.
   * @param  {Array} files
   * @return {void}
   */
  public __createBindings(files): void {
    for (const [key, value] of Object.entries(files)) {
      // @ts-ignore
      this[key] = require(value);
    }
  }

  /**
   * Get all config files.
   * @return {Object}
   */
  public __getFiles(): Record<string, string> {
    const basePath = path.resolve(process.env.ARK_PATH_CONFIG);

    if (!fs.existsSync(basePath)) {
      throw new Error(
        "An invalid configuration was provided or is inaccessible due to it's security settings.",
      );
      process.exit(1);
    }

    const formatName = (file) => path.basename(file.name, path.extname(file.name));

    const configTree = {};

    // @ts-ignore
    dirTree(basePath, { extensions: /\.(js|json)$/ }).children.forEach(
      (entry) => {
        if (entry.type === "file") {
          configTree[formatName(entry)] = entry.path;
        }
      },
    );

    return configTree;
  }

  /**
   * Build the peer list either from a local file, remote file or object.
   * @param  {String} configFile
   * @return {void}
   */
  public async __buildPeers(configFile): Promise<void> {
    if (this.peers.sources) {
      const output = require(configFile);

      for (const source of this.peers.sources) {
        // Local File...
        if (source.startsWith("/")) {
          output.list = require(source);

          fs.writeFileSync(configFile, JSON.stringify(output, null, 2));

          break;
        }

        // URL...
        try {
          // @ts-ignore
          const response = await axios.get(source);

          output.list = response.data;

          fs.writeFileSync(configFile, JSON.stringify(output, null, 2));

          break;
        } catch (error) {
          //
        }
      }
    }
  }

  /**
   * Validate crucial parts of the configuration.
   * @return {void}
   */
  public _validateConfig(): void {
    try {
      // @ts-ignore
      ow(this.network.pubKeyHash, ow.number);
      // @ts-ignore
      ow(this.network.nethash, ow.string.length(64));
      // @ts-ignore
      ow(this.network.wif, ow.number);
    } catch (error) {
      throw Error(error.message);
      process.exit(1);
    }
  }
}

export const configLoader = new ConfigLoader();

import { dotenv, get, set } from "@arkecosystem/utils";
import { existsSync, readFileSync } from "fs";
import importFresh from "import-fresh";
import { extname } from "path";

import { Application } from "../../../contracts/kernel";
import { ConfigLoader } from "../../../contracts/kernel/config";
import { defaults } from "../../../defaults";
import {
    ApplicationConfigurationCannotBeLoaded,
    EnvironmentConfigurationCannotBeLoaded,
} from "../../../exceptions/config";
import { Identifiers, inject, injectable } from "../../../ioc";
import { JsonObject, KeyValuePair, Primitive } from "../../../types";
import { ConfigRepository } from "../repository";

/**
 * @export
 * @class LocalConfigLoader
 * @implements {ConfigLoader}
 */
@injectable()
export class LocalConfigLoader implements ConfigLoader {
    /**
     * The application instance.
     *
     * @protected
     * @type {Application}
     * @memberof LocalConfigLoader
     */
    @inject(Identifiers.Application)
    protected readonly app: Application;

    /**
     * The application configuration.
     *
     * @private
     * @type {ConfigRepository}
     * @memberof LoadCryptography
     */
    @inject(Identifiers.ConfigRepository)
    private readonly configRepository: ConfigRepository;

    /**
     * @returns {Promise<void>}
     * @memberof LocalConfigLoader
     */
    public async loadEnvironmentVariables(): Promise<void> {
        try {
            const config: Record<string, Primitive> = dotenv.parseFile(this.app.environmentFile());

            for (const [key, value] of Object.entries(config)) {
                set(process.env, key, value);
            }
        } catch {
            throw new EnvironmentConfigurationCannotBeLoaded();
        }
    }

    /**
     * @returns {Promise<void>}
     * @memberof LocalConfigLoader
     */
    public async loadConfiguration(): Promise<void> {
        try {
            this.loadApplication();

            this.loadPeers();

            this.loadDelegates();

            this.loadCryptography();
        } catch {
            throw new ApplicationConfigurationCannotBeLoaded();
        }
    }

    /**
     * @private
     * @returns {void}
     * @memberof LocalConfigLoader
     */
    private loadApplication(): void {
        const config = this.loadFromLocation(["app.json", "app.js"]);

        this.configRepository.set("app.flags", {
            ...this.app.get<JsonObject>(Identifiers.ConfigFlags),
            ...defaults.flags,
            ...get(config, "flags", {}),
        });

        this.configRepository.set("app.services", { ...defaults.services, ...get(config, "services", {}) });

        this.configRepository.set("app.plugins", [...defaults.plugins, ...get(config, "plugins", [] as any)]);
    }

    /**
     * @private
     * @returns {void}
     * @memberof LocalConfigLoader
     */
    private loadPeers(): void {
        this.configRepository.set("peers", this.loadFromLocation(["peers.json"]));
    }

    /**
     * @private
     * @returns {void}
     * @memberof LocalConfigLoader
     */
    private loadDelegates(): void {
        this.configRepository.set("delegates", this.loadFromLocation(["delegates.json"]));
    }

    /**
     * @private
     * @returns {void}
     * @memberof LocalConfigLoader
     */
    private loadCryptography(): void {
        for (const key of ["genesisBlock", "exceptions", "milestones", "network"]) {
            const config: KeyValuePair | undefined = this.loadFromLocation([`crypto/${key}.json`]);

            if (config) {
                this.configRepository.set(`crypto.${key}`, config);
            }
        }
    }

    /**
     * @private
     * @param {string[]} files
     * @returns {KeyValuePair}
     * @memberof LocalConfigLoader
     */
    private loadFromLocation(files: string[]): KeyValuePair | undefined {
        for (const file of files) {
            const fullPath: string = this.app.configPath(file);

            if (existsSync(fullPath)) {
                return extname(fullPath) === ".json"
                    ? JSON.parse(readFileSync(fullPath).toString())
                    : importFresh(fullPath);
            }
        }

        return undefined;
    }
}

import { app } from "@arkecosystem/core-container";
import { registerWithContainer, setUpContainer } from "../../../utils/helpers/container";

jest.setTimeout(60000);

const options = {
    enabled: true,
    host: "0.0.0.0",
    port: 4005,
};

export const setUp = async () => {
    process.env.CORE_GRAPHQL_ENABLED = "true";

    await setUpContainer({
        exclude: ["@arkecosystem/core-api", "@arkecosystem/core-forger"],
    });

    const { plugin } = require("../../../../packages/core-graphql/src");
    await registerWithContainer(plugin, options);

    return app;
};

export const tearDown = async () => {
    await app.tearDown();

    const { plugin } = require("../../../../packages/core-graphql/src");
    await plugin.deregister(app, options);
};

import { app } from "@arkecosystem/core-container";
import { Peer } from "@arkecosystem/core-p2p";

export function transformPeer(model) {
    const config = app.getConfig();

    const peer: any = {
        ip: model.ip,
        port: +model.port,
        version: model.version,
        height: model.state ? model.state.height : model.height,
        status: Peer.isOk(model) ? 200 : 400,
        os: model.os,
        latency: model.delay,
    };

    if (config.get("network.name") !== "mainnet") {
        peer.hashid = model.hashid || "unknown";
    }

    return peer;
}

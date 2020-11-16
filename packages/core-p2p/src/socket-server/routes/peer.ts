import { getCommonBlocks, getPeers, getStatus } from "../codecs/peer";
import { PeerController } from "../controllers/peer";
import { peerSchemas } from "../schemas/peer";
import { Route, RouteConfig } from "./route";

export class PeerRoute extends Route {
    public getRoutesConfigByPath(): { [path: string]: RouteConfig } {
        const controller = this.getController();
        return {
            "/p2p/peer/getPeers": {
                id: "p2p.peer.getPeers",
                handler: controller.getPeers,
                validation: peerSchemas.getPeers,
                codec: getPeers,
            },
            "/p2p/peer/getCommonBlocks": {
                id: "p2p.peer.getCommonBlocks",
                handler: controller.getCommonBlocks,
                validation: peerSchemas.getCommonBlocks,
                codec: getCommonBlocks,
            },
            "/p2p/peer/getStatus": {
                id: "p2p.peer.getStatus",
                handler: controller.getStatus,
                validation: peerSchemas.getStatus,
                codec: getStatus,
            },
        };
    }

    protected getController(): PeerController {
        return this.app.resolve(PeerController);
    }
}

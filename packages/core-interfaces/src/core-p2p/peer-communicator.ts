import { IPeer } from "./peer";

export interface IPeerCommunicator {
    ping(peer: IPeer, timeoutMsec: number, force?: boolean): Promise<any>;
    downloadBlocks(peer: IPeer, fromBlockHeight): Promise<any>;
    postBlock(peer: IPeer, block);
    postTransactions(peer: IPeer, transactions): Promise<any>;
    getPeers(peer: IPeer): Promise<any>;
    getPeerBlocks(peer: IPeer, afterBlockHeight: number, timeoutMsec?: number): Promise<any>;
    hasCommonBlocks(peer: IPeer, ids: string[], timeoutMsec?: number): Promise<any>;
}

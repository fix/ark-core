import { Managers } from "@arkecosystem/crypto";

export const mapHeightToMilestoneSpanTimestamp = async (
    height: number,
    findBlockTimestampByHeight: (height: number) => Promise<number>,
): Promise<(height: number) => number> => {
    let nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(1, "blocktime");

    // TODO: could cache this object here to reduce slow calls to DB.
    const heightMappedToBlockTimestamp: Map<number, number> = new Map();
    heightMappedToBlockTimestamp.set(1, 0); // Block of height one always has a timestamp of 0

    while (nextMilestone.found && nextMilestone.height <= height) {
        // to calculate the timespan between two milestones we need to look up the timestamp of the last block
        const endSpanBlockHeight = nextMilestone.height - 1;

        heightMappedToBlockTimestamp[endSpanBlockHeight] = await findBlockTimestampByHeight(endSpanBlockHeight);

        nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(nextMilestone.height, "blocktime");
    }

    return (height) => {
        const result = heightMappedToBlockTimestamp[height];
        if (result === undefined) {
            throw new Error(
                `Attempted lookup of block height ${height} for milestone span calculation, but none exists.`,
            );
        } else {
            return result;
        }
    };
};

import { state } from './state.js';
import { sendCommand } from './debugger.js';

export function processProfile(tabId) {
    return new Promise((resolve) => {
        sendCommand(tabId, 'Profiler.stop', {}, (result) => {
            state.tabLogs[tabId].rawProfile = result.profile;
            state.tabLogs[tabId].profile = analyzeProfile(result.profile);
            resolve();
        });
    });
}

export function analyzeProfile(profile) {
    const idToNodeMap = profile.nodes.reduce((map, node) => {
        map[node.id] = node;
        return map;
    }, {});

    const processedNodes = new Set();

    function calculateSelfTime(node) {
        let selfTime = 0;
        profile.samples.forEach((sample, index) => {
            if (sample === node.id) selfTime += profile.timeDeltas[index];
        });
        return selfTime / 1000000;
    }

    const itemMap = new Map();

    function analyzeNode(node, parentFrame = null) {
        if (processedNodes.has(node.id)) return;
        processedNodes.add(node.id);

        const totalTime = calculateSelfTime(node);
        let selfTime = totalTime;
        if (node.children) {
            node.children.forEach(childId => {
                const childSelfTime = calculateSelfTime(idToNodeMap[childId]);
                if (childSelfTime <= totalTime) selfTime -= childSelfTime;
            });
        }

        if (node.callFrame) {
            const { functionName, url, lineNumber, columnNumber, scriptId } = node.callFrame;
            const key = `${functionName}@${url}:${lineNumber}:${columnNumber}`;
            const existing = itemMap.get(key);
            if (existing) {
                existing.selfTime += selfTime;
                existing.totalTime += totalTime;
                existing.nodeIds.push(node.id);
                existing.scriptIds.push(scriptId);
                if (parentFrame && !existing.parentFunctions.includes(parentFrame)) {
                    existing.parentFunctions.push(parentFrame);
                }
            } else {
                itemMap.set(key, {
                    functionName, selfTime, totalTime, url, lineNumber, columnNumber,
                    parentFunctions: parentFrame ? [parentFrame] : [],
                    nodeIds: [node.id],
                    scriptIds: [scriptId],
                });
            }
        }

        if (node.children) {
            node.children.forEach(childId => analyzeNode(idToNodeMap[childId], node.callFrame));
        }
    }

    profile.nodes.forEach(node => analyzeNode(node, null));

    return Array.from(itemMap.values())
        .sort((a, b) => b.totalTime - a.totalTime)
        .reduce((acc, item) => {
            acc[`[${item.functionName}] ${item.totalTime}s ${item.url}`] = item;
            return acc;
        }, {});
}

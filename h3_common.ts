import search from 'N/search';
import log from 'N/log';

export default {

    isScriptRunning(scriptId: string, deploymentId: string) {
        const executingStatuses = ["PENDING", "PROCESSING", "RESTART", "RETRY"];
        return Boolean(search.create({
            type: search.Type.SCHEDULED_SCRIPT_INSTANCE,
            filters: [
                ["status", search.Operator.ANYOF, executingStatuses], "AND",
                ["script.scriptid", search.Operator.IS, scriptId], "AND",
                ["scriptDeployment.scriptid", search.Operator.ISNOT, deploymentId]
            ],
        }).runPaged().count);
    },

    searchRecord(callback: any, type: search.SearchCreateOptions['type'], filters?: search.SearchCreateOptions['filters'], columns?: search.SearchCreateOptions['columns']) {
        const pagedData = search.create({ type, filters, columns }).runPaged({ pageSize: 1000 });
        for (let i = 0; i < pagedData.pageRanges.length; i++) {
            pagedData.fetch({ index: i }).data.map(callback);
        }
    },

    scheduleScript(store_permission_map: [{ store: string, permission: string; }] | []) {
        if (store_permission_map.length == 0) return;
        log.debug("common.scheduleScript => store_permission_map", store_permission_map);
        const { permission } = store_permission_map[0];
        switch (permission) {
            case "":

                break;

            default:
                break;
        }
    }

};



// isCurrentScriptRunning: () {
//     const currentScript = runtime.getCurrentScript();
//     return isScriptRunning(currentScript.id, currentScript.deploymentId);
// },
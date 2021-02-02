import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import task from "N/task";
import * as shopifyWrapper from "./h3_shopify_wrapper";
import format from "N/format";

export function isScriptRunning(scriptId: string, deploymentId: string) {
    const executingStatuses = ["PENDING", "PROCESSING", "RESTART", "RETRY"];
    return Boolean(search.create({
        type: search.Type.SCHEDULED_SCRIPT_INSTANCE,
        filters: [
            ["status", search.Operator.ANYOF, executingStatuses], "AND",
            ["script.scriptid", search.Operator.IS, scriptId], "AND",
            ["scriptDeployment.scriptid", search.Operator.ISNOT, deploymentId]
        ],
    }).runPaged().count);
}

export function searchRecords(callback: any, type: search.SearchCreateOptions['type'], filters?: search.SearchCreateOptions['filters'], columns?: search.SearchCreateOptions['columns']) {
    const pagedData = search.create({ type, filters, columns }).runPaged({ pageSize: 1000 });
    for (let i = 0; i < pagedData.pageRanges.length; i++) {
        pagedData.fetch({ index: i }).data.map(callback);
    }
}

export function scheduleScript(storePermissions: [{ store: string, permission: string; }] | []) {
    if (storePermissions.length == 0) return;
    log.debug("common.scheduleScript => storePermissions", storePermissions);
    const { permission } = storePermissions[0];
    switch (permission) {
        case "ITEM_IMPORT":
            task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: constants.SCRIPTS.ITEM_IMPORT,
                deploymentId: constants.SCRIPTS_DEPLOYMENTS.ITEM_IMPORT,
                params: {
                    [constants.SCRIPT_PARAMS.ITEM_IMPORT_STORE_PERMISSIONS]: JSON.stringify(storePermissions)
                }
            }).submit();
            break;

        default:
            log.error("common.scheduleScript => unknown permission", permission);
            break;
    }

}

export function isCurrentScriptRunning() {
    const currentScript = runtime.getCurrentScript();
    return isScriptRunning(currentScript.id, currentScript.deploymentId);
}

export const functions: { [key: string]: any; } = {
    setValue(this: { record: record.Record, fieldId: string; }, value: any) {
        this.record.setValue({ fieldId: this.fieldId, value });
    }
};

export const esConfig: { [key: string]: string; } = {};

function initializeEsConfig(storePermission: { store: string, permission: string; }) {
    const { store, permission } = storePermission;
    function callback(this: any, result: search.Result) {
        const key = result.getValue(result.columns[0].name) as string;
        const value = result.getValue(result.columns[1].name) as string;
        this[key] = value;
    }
    searchRecords(
        callback.bind(esConfig),
        constants.RECORDS.EXTERNAL_STORES_CONFIG.ID,
        [
            [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.STORE, search.Operator.IS, store],
            "AND",
            [
                [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.STARTSWITH, permission.toLowerCase()],
                "OR",
                [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, "type"],
                "OR",
                [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, "url"],
                "OR",
                [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, "access_token"]
            ]
        ],
        [
            constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY,
            constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.VALUE
        ]
    );
    log.debug("common.initializeEsConfig => esConfig", esConfig);
}

export function getWrapper(storePermission: { store: string, permission: string; }) {
    if (Object.keys(esConfig).length == 0) initializeEsConfig(storePermission);
    switch (esConfig.type) {
        case "SHOPIFY":
            return shopifyWrapper;

        default:
            log.error("common.getWrapper => unknown wrapper", storePermission);
            break;
    }
}

export function getISODate(date: string) {
    return (format.parse({
        value: format.format({
            value: new Date(date),
            type: format.Type.DATETIMETZ,
            timezone: format.Timezone.AMERICA_LOS_ANGELES
        }),
        type: format.Type.DATETIMETZ,
    }) as Date).toISOString();
}
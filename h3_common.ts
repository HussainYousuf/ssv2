import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import task from "N/task";
import * as shopifyWrapper from "./h3_shopify_wrapper";
import * as itemImport from "./h3_item_import";

export function isScriptRunning(scriptIds: [string]) {
    const executingStatuses = ["PENDING", "PROCESSING", "RESTART", "RETRY"];
    return Boolean(search.create({
        type: search.Type.SCHEDULED_SCRIPT_INSTANCE,
        filters: [
            ["status", search.Operator.ANYOF, executingStatuses], "AND",
            ["script.scriptid", search.Operator.ANYOF, scriptIds]
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
    const esConfig = getEsConfig(storePermissions[0]);
    log.debug("common.scheduleScript => esConfig", esConfig);
    task.create({
        taskType: task.TaskType.MAP_REDUCE,
        scriptId: constants.SCRIPTS.BASE,
        deploymentId: constants.SCRIPTS_DEPLOYMENTS.BASE,
        params: {
            [constants.SCRIPT_PARAMS.BASE_STORE_PERMISSIONS]: JSON.stringify(storePermissions),
            [constants.SCRIPT_PARAMS.BASE_CONFIG]: JSON.stringify(esConfig),
            [constants.SCRIPT_PARAMS.BASE_TYPE]: esConfig[constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS.TYPE],
            [constants.SCRIPT_PARAMS.BASE_PERMISSION]: storePermissions[0].permission
        }
    }).submit();
}

export function isCurrentScriptRunning() {
    const currentScript = runtime.getCurrentScript();
    return isScriptRunning([currentScript.id]);
}

function getEsConfig({ store, permission }: { store: string, permission: string; }) {
    const esConfig = {};
    const { ITEM_IMPORT_FIELDMAP, TYPE, URL, ACCESSTOKEN } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
    function callback(this: any, result: search.Result) {
        const key = result.getValue(result.columns[0].name) as string;
        const value = result.getValue(result.columns[1].name) as string;
        if ([ITEM_IMPORT_FIELDMAP].includes(key)) this[key] ? this[key].push(value) : this[key] = [value];
        else this[key] = value;
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
                [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, TYPE],
                "OR",
                [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, URL],
                "OR",
                [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, ACCESSTOKEN]
            ]
        ],
        [
            constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY,
            constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.VALUE
        ]
    );
    log.debug("common.initializeEsConfig => esConfig", esConfig);
    return esConfig as { [key: string]: string; };
}

export function getWrapper() {
    const type = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_TYPE);
    switch (type) {
        case constants.RECORDS.EXTERNAL_STORES_CONFIG.TYPE.SHOPIFY:
            return shopifyWrapper;

        default:
            log.error("common.getWrapper => unknown type", type);
            break;
    }
}

export function getPermission() {
    const permission = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_PERMISSION);
    switch (permission) {
        case constants.RECORDS.EXTERNAL_STORES_CONFIG.PERMISSIONS.ITEM_IMPORT:
            return itemImport;

        default:
            log.error("common.getWrapper => unknown permission", permission);
            break;
    }
}

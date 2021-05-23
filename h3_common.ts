import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import task from "N/task";
import * as shopifyWrapper from "./h3_shopify_wrapper";
import * as salesforceWrapper from "./h3_salesforce_wrapper";
import * as item from "./h3_item";
import * as customer from "./h3_customer";
import * as baseImport from "./h3_import";
import * as baseExport from "./h3_export";


const { EXTERNAL_STORES_CONFIG, RECORDS_SYNC } = constants.RECORDS;
const { BASE_MR_ESCONFIG, BASE_MR_STORE_PERMISSIONS } = constants.SCRIPT_PARAMS;

export function init() {
    const esConfig: Record<string, any> = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string);
    const { store, permission }: Record<string, string> = esConfig;
    const [rsRecType, operation] = permission.split("_");
    const rsStatus = operation + "ed";
    const filters = [
        [RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
        "AND",
        [RECORDS_SYNC.FIELDS.RECORD_TYPE, search.Operator.IS, rsRecType],
        "AND",
        [RECORDS_SYNC.FIELDS.STATUS, search.Operator.IS, rsStatus],
    ];
    return { store, permission, rsRecType, rsStatus, filters, esConfig };
}

export function getFailedRecords(column: string, filters: any[]) {
    filters.pop();
    filters.push([RECORDS_SYNC.FIELDS.STATUS, search.Operator.IS, ""]);
    const failedRecords: string[] = [];
    searchRecords((function (result: search.Result) {
        failedRecords.push(String(result.getValue(column)));
    }), RECORDS_SYNC.ID, filters, [column]);
    return failedRecords;
}

// serializes date obj to yyyy-mm-dd hh24:mi:ss
export function getFormattedDateTime(dateObj: Date) {
    return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60 * 1000).toISOString().split(".")[0].replace("T", " ");
    // new Date(dateObj.toString().split('GMT')[0]+'UTC').toISOString().split(".")[0].replace("T", " ") alternate logic
}

export function areOtherDeploymentsRunning(scriptId: string, deploymentId: string) {
    const executingStatuses = ["PENDING", "PROCESSING", "RESTART", "RETRY"];
    return Boolean(search.create({
        type: search.Type.SCHEDULED_SCRIPT_INSTANCE,
        filters: [
            ["status", search.Operator.ANYOF, executingStatuses], "AND",
            ["script.scriptid", search.Operator.IS, scriptId], "AND",
            ["scriptdeployment.scriptid", search.Operator.ISNOT, deploymentId]
        ]
    }).runPaged().count);
}

export function searchRecords(callback: any, type: search.SearchCreateOptions['type'], filters?: search.SearchCreateOptions['filters'], columns?: search.SearchCreateOptions['columns']) {
    const pagedData = search.create({ type, filters, columns }).runPaged({ pageSize: 1000 });
    for (let i = 0; i < pagedData.pageRanges.length; i++) {
        pagedData.fetch({ index: i }).data.map(callback);
    }
}

export function scheduleScript(storePermissions: { store: string, permission: string; }[]) {
    if (storePermissions.length == 0) return;
    log.debug("common.scheduleScript => storePermissions", storePermissions);
    const { store, permission } = storePermissions[0];
    const esConfig = getEsConfig(store, permission);
    task.create({
        taskType: task.TaskType.MAP_REDUCE,
        scriptId: constants.SCRIPTS.BASE_MR,
        deploymentId: constants.SCRIPTS_DEPLOYMENTS.BASE_MR,
        params: {
            [BASE_MR_STORE_PERMISSIONS]: JSON.stringify(storePermissions),
            [BASE_MR_ESCONFIG]: JSON.stringify(esConfig),
        }
    }).submit();
}

function getEsConfig(store: string, permission: string) {
    const esConfig: Record<string, string | string[]> = { store, permission };
    const { TYPE } = EXTERNAL_STORES_CONFIG.KEYS;
    searchRecords(
        (function (result: search.Result) {
            const key = String(result.getValue(result.columns[0].name)).trim();
            const value = String(result.getValue(result.columns[1].name)).split("\n").map(value => value.trim()).filter(value => value);
            if (value.length) {
                if (value.length > 1)
                    esConfig[key] = value;
                else
                    esConfig[key] = value[0];
            }
        }),
        EXTERNAL_STORES_CONFIG.ID,
        [
            [EXTERNAL_STORES_CONFIG.FIELDS.STORE, search.Operator.IS, store],
            "AND",
            [
                [EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.STARTSWITH, permission],
                "OR",
                [EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, TYPE]
            ]
        ],
        [
            EXTERNAL_STORES_CONFIG.FIELDS.KEY,
            EXTERNAL_STORES_CONFIG.FIELDS.VALUE
        ]
    );
    log.debug("common.getEsConfig => esConfig", esConfig);
    return esConfig;
}

export function getWrapper() {
    const { permission, [EXTERNAL_STORES_CONFIG.KEYS.TYPE]: type }: Record<string, string> = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string);
    switch (type) {
        case EXTERNAL_STORES_CONFIG.TYPES.SHOPIFY:
            return (shopifyWrapper as any)[permission.toUpperCase()];
        case EXTERNAL_STORES_CONFIG.TYPES.SALESFORCE:
            return (salesforceWrapper as any)[permission.toUpperCase()];
        default:
            throw Error(`common.getWrapper => unknown type ${type}`);
    }
}

export function getRecordType() {
    const { permission }: Record<string, string> = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string);
    const [record, operation] = permission.split("_");
    switch (record) {
        case EXTERNAL_STORES_CONFIG.RECORDS.ITEM:
            return (item as any)[operation.toUpperCase()];
        case EXTERNAL_STORES_CONFIG.RECORDS.CUSTOMER:
            return (customer as any)[operation.toUpperCase()];
        default:
            throw Error(`common.getPermission => unknown permission ${permission}`);
    }
}

export function getOperation() {
    const { permission }: Record<string, string> = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string);
    const operation = permission.split("_")[1];
    switch (operation) {
        case EXTERNAL_STORES_CONFIG.OPERATIONS.IMPORT:
            return baseImport as any;
        case EXTERNAL_STORES_CONFIG.OPERATIONS.EXPORT:
            return baseExport as any;
        default:
            throw Error(`common.getPermission => unknown operation ${operation}`);
    }
}

export function getProperty(object: any, property: string) {
    for (const key of property.split(".")) {
        object = object?.[key];
    }
    return object;
}
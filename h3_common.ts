import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import task from "N/task";
import * as shopifyWrapper from "./h3_shopify_wrapper";
import * as salesforceWrapper from "./h3_salesforce_wrapper";
import * as itemImport from "./h3_item_import";
import * as itemExport from "./h3_item_export";

const { EXTERNAL_STORES_CONFIG } = constants.RECORDS;
const { BASE_MR_ESCONFIG, BASE_MR_STORE_PERMISSIONS } = constants.SCRIPT_PARAMS;


export function getFormattedDateTime(dateObj: Date) {
    return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60 * 1000).toISOString().split(".")[0].replace("T", " ");
    // new Date(dateObj.toString().split('GMT')[0]+'UTC').toISOString().split(".")[0].replace("T", " ") alternate logic
}

export function otherDeploymentsAreRunning(scriptIds: string[], deploymentIds: string[]) {
    const executingStatuses = ["PENDING", "PROCESSING", "RESTART", "RETRY"];
    return Boolean(search.create({
        type: search.Type.SCHEDULED_SCRIPT_INSTANCE,
        filters: [
            ["status", search.Operator.ANYOF, executingStatuses], "AND",
            ["script.scriptid", search.Operator.ANYOF, scriptIds], "AND",
            ["scriptDeployment.scriptid", search.Operator.NONEOF, deploymentIds]
        ],
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
    const esConfig = {};
    const { ITEM_IMPORT_FIELDMAP, ITEM_IMPORT_FUNCTION, TYPE, } = EXTERNAL_STORES_CONFIG.KEYS;
    function callback(this: any, result: search.Result) {
        const key = result.getValue(result.columns[0].name) as string;
        const value = result.getValue(result.columns[1].name) as string;
        if ([ITEM_IMPORT_FIELDMAP, ITEM_IMPORT_FUNCTION].includes(key)) this[key] ? this[key].push(value) : this[key] = [value];
        else this[key] = value;
    }
    searchRecords(
        callback.bind(esConfig),
        EXTERNAL_STORES_CONFIG.ID,
        [
            [EXTERNAL_STORES_CONFIG.FIELDS.STORE, search.Operator.IS, store],
            "AND",
            [
                [EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.STARTSWITH, permission.toLowerCase()],
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
    return esConfig as { [key: string]: string; };
}

export function getWrapper(): any {
    function getWrapper(): any {
        const type = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string)[EXTERNAL_STORES_CONFIG.KEYS.TYPE];
        switch (type) {
            case EXTERNAL_STORES_CONFIG.TYPES.SHOPIFY:
                return shopifyWrapper;
            case EXTERNAL_STORES_CONFIG.TYPES.SALESFORCE:
                return salesforceWrapper;
            default:
                throw Error(`common.getWrapper => unknown type ${type}`);
        }
    }
    const { permission } = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_STORE_PERMISSIONS) as string)[0];
    return getWrapper()[permission];
}

export function getPermission() {
    const { permission } = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_STORE_PERMISSIONS) as string)[0];
    switch (permission) {
        case EXTERNAL_STORES_CONFIG.PERMISSIONS.ITEM_IMPORT:
            return itemImport;
        case EXTERNAL_STORES_CONFIG.PERMISSIONS.ITEM_EXPORT:
            return itemExport;
        default:
            throw Error(`common.getPermission => unknown permission ${permission}`);
    }
}

export function getProperty(object: any, property: string) {
    for (const key of property.split(".")) {
        object = object?.[key];
    }
    return object;
}

export const functions: any = {
    setValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esFields: string) {
        for (const esField of esFields.split("|")) {
            const value = getProperty(this.esRecord, esField);
            if (value) {
                this.nsRecord.setValue(nsField, value);
                break;
            }
        }
    },

    setRecordValue(this: { nsRecord: { record: record.Record, search: any; }, esRecord: any, esConfig: any; }, esField: string, nsFields: string) {
        for (const nsField of nsFields.split("|")) {
            const value = this.nsRecord.record.getValue(nsField);
            if (value) {
                this.esRecord[esField] = value;
                break;
            }
        }
    },

    setRecordText(this: { nsRecord: { record: record.Record, search: any; }, esRecord: any, esConfig: any; }, esField: string, nsFields: string) {
        for (const nsField of nsFields.split("|")) {
            const value = this.nsRecord.record.getText(nsField);
            if (value) {
                this.esRecord[esField] = value;
                break;
            }
        }
    },
};
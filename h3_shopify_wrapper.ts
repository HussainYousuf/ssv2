import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import search from 'N/search';
import runtime from 'N/runtime';
import format from 'N/format';
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';

export const ITEM_IMPORT = {

    getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
        const store = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_STORE);
        const esConfig = JSON.parse(runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_CONFIG) as string);
        const filters = [
            [constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
            "AND",
            [constants.RECORDS.RECORDS_SYNC.FIELDS.STATUS_NAME, search.Operator.IS, constants.LIST_RECORDS.STATUSES.IMPORTED],
            "AND",
            [constants.RECORDS.RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, search.Operator.IS, constants.LIST_RECORDS.RECORD_TYPES.ITEM]
        ];
        const maxEsModDateCol = search.createColumn({
            name: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE,
            summary: search.Summary.MAX,
        });
        let maxEsModDate = search.create({
            type: constants.RECORDS.RECORDS_SYNC.ID,
            filters,
            columns: [maxEsModDateCol]
        }).run().getRange(0, 1)[0]?.getValue(maxEsModDateCol) as string;

        if (maxEsModDate) maxEsModDate = (format.parse({ type: format.Type.DATETIMETZ, value: maxEsModDate }) as Date).toISOString();
        log.debug("item_import.getInputData => maxEsModDate", maxEsModDate);

        const { ITEM_IMPORT_URL } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const response = https.get({
            url: esConfig[ITEM_IMPORT_URL] + `&updated_at_min=${maxEsModDate}`,
            headers: {
                "Content-Type": "application/json"
            }
        }).body;
        log.debug("shopify_wrapper.getItemsFromEs => response", response);
        return JSON.parse(response).products;

    },

    map(context: EntryPoints.MapReduce.mapContext) {
    },

    reduce(context: EntryPoints.MapReduce.reduceContext) {
    },

    summarize(context: EntryPoints.MapReduce.summarizeContext) {
    }

};

export const functions: { [key: string]: any; } = {
    setValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esField: string) {
        let value;
        for (const key of esField.split(".")) {
            value = this.esRecord[key];
            this.esRecord = this.esRecord[key];
        }
        this.nsRecord.setValue(nsField, value);
    }
};


export function getItemsFromEs(maxEsModDate: string | undefined, esConfig: any) {
    const { ITEM_IMPORT_URL } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
    const response = https.get({
        url: esConfig[ITEM_IMPORT_URL] + `&updated_at_min=${maxEsModDate}`,
        headers: {
            "Content-Type": "application/json"
        }
    }).body;

    log.debug("shopify_wrapper.getItemsFromEs => response", response);
    return JSON.parse(response).products;
}

// export function getItemsFromEs(maxEsModDate: string | undefined, esConfig: any) {
//     const { ACCESSTOKEN, ITEM_IMPORT_FILTERS, ITEM_IMPORT_QUERY, URL } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
//     const url = esConfig[URL];
//     const accessToken = esConfig[ACCESSTOKEN];
//     const query = esConfig[ITEM_IMPORT_QUERY].replace(/[\n\r]/gm, "");

//     if (!esConfig[ITEM_IMPORT_FILTERS]) esConfig[ITEM_IMPORT_FILTERS] = "";
//     const filters = maxEsModDate ?
//         esConfig[ITEM_IMPORT_FILTERS] + ` updated_at:>'${maxEsModDate}'` :
//         esConfig[ITEM_IMPORT_FILTERS];

//     const response = https.post({
//         url,
//         body: JSON.stringify({
//             query,
//             variables: {
//                 filters
//             }
//         }),
//         headers: {
//             "X-Shopify-Access-Token": accessToken,
//             "Content-Type": "application/json"
//         }
//     }).body;

//     log.debug("shopify_wrapper.getItemsFromEs => response", response);
//     return JSON.parse(response).data.products.edges;
// }

// export function parseEsItem(item: string) {
//     const { node, node: { id: esId, updatedAt: esModDate } } = JSON.parse(item);
//     return { ...node, esId, esModDate: new Date(esModDate), esItemType: record.Type.INVENTORY_ITEM };
// }

export function parseEsItem(item: string) {
    const { node, node: { id: esId, updatedAt: esModDate } } = JSON.parse(item);
    return { ...node, esId, esModDate: new Date(esModDate), esItemType: record.Type.INVENTORY_ITEM };
}
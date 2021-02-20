import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import search from 'N/search';
import runtime from 'N/runtime';
import format from 'N/format';
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';

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
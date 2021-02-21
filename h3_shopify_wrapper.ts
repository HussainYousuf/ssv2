import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';

export const ITEM_IMPORT = {

    getItems(maxEsModDate: string | undefined, esConfig: any) {
        const { ITEM_IMPORT_URL } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const response = https.get({
            url: maxEsModDate ? esConfig[ITEM_IMPORT_URL] + `&updated_at_min=${maxEsModDate}` : esConfig[ITEM_IMPORT_URL],
            headers: {
                "Content-Type": "application/json"
            }
        }).body;

        log.debug("shopify_wrapper.getItemsFromEs => response", response);
        return JSON.parse(response).products;
    },

    parseItem(item: string) {
        const esItem = JSON.parse(item);
        return {
            ...esItem,
            esId: esItem.id,
            esModDate: new Date(esItem.updated_at),
            recType: record.Type.INVENTORY_ITEM,
        };
    },

    shouldReduce(context: EntryPoints.MapReduce.mapContext, esItem: { variants: [any], nsId: string; }) {
        esItem.variants?.map((value, index) => esItem.nsId && context.write(String(index), { ...value, parentNsId: esItem.nsId }));
    }

};


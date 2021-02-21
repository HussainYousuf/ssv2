import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import constants from "./h3_constants";

export const ITEM_IMPORT = {

    getItems(maxEsModDate: string | undefined, esConfig: any) {
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

    parseItem(item: string) {
        const { id: esId, updated_at: esModDate } = JSON.parse(item);
        return { esId, esModDate: new Date(esModDate), esItemType: record.Type.INVENTORY_ITEM };
    }

};


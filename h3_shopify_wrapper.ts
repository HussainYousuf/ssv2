import log from 'N/log';
import https from 'N/https';
import { esConfig } from "./h3_common";

export function getItemsFromEs(maxEsModDate: string) {
    const url = esConfig.url;
    const accessToken = esConfig["access_token"];
    const query = esConfig["item_import.query"].replace(/(\n|\r)/gm, "");

    if (!esConfig["item_import.query.filters"]) esConfig["item_import.query.filters"] = "";
    const filters = maxEsModDate ?
        esConfig["item_import.query.filters"] + ` updated_at:>'${maxEsModDate}'` :
        esConfig["item_import.query.filters"];

    const response = https.post({
        url,
        body: JSON.stringify({
            query,
            variables: {
                filters
            }
        }),
        headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json"
        }
    }).body;

    log.debug("shopify_wrapper.getItemsFromEs => response", response);
    return JSON.parse(response).data.products.edges;
}

export function parseEsItem(item: string) {
    const { cursor, node } = JSON.parse(item);
    return { ...node, cursor };
}
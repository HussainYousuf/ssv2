import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';
import { getProperty } from 'h3_common';

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
        esItem.variants?.map((value, index) => esItem.nsId && context.write(String(index), { ...value, productNsId: esItem.nsId }));
    },

    setValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esField: string) {
        esField.split("|").reverse().map(esField => {
            const value = getProperty(this.esRecord, esField);
            value && this.nsRecord.setValue(nsField, value);
        });
    },

    setParentRawValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, rawValue: string) {
        !this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setChildRawValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, rawValue: string) {
        this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    // when you don't know ns field
    setParentFieldMappedTexts(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, arrField: any, esField: string, esValueField: string) {
        if (this.esRecord.productNsId) return;
        const arr = getProperty(this.esRecord, arrField);
        arr.map((e: any) => {
            
         });
        const { ITEM_IMPORT_FIELDMAP } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const fieldMap: { [key: string]: string; } = {};
        this.esConfig[ITEM_IMPORT_FIELDMAP].map((value: string) => {
            const values = value.trim().split(/\s+/);
            fieldMap[values[0]] = values[1];
        });
        const nsField = fieldMap[getProperty(this.esRecord, esField)];
        const value = getProperty(this.esRecord, esValueField);
        this.nsRecord.setText(nsField, value);
    },

    setChildFieldMappedText(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, esField: string, esValueField: string) {
        if (!this.esRecord.productNsId) return;
        const { ITEM_IMPORT_FIELDMAP } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const fieldMap: { [key: string]: string; } = {};
        this.esConfig[ITEM_IMPORT_FIELDMAP].map((value: string) => {
            const values = value.trim().split(/\s+/);
            fieldMap[values[0]] = values[1];
        });
        const nsField = fieldMap[getProperty(this.esRecord, esField)];
        const value = getProperty(this.esRecord, esValueField);
        this.nsRecord.setText(nsField, value);
    },
};


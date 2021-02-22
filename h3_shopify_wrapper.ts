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

    shouldReduce(context: EntryPoints.MapReduce.mapContext, esItem: { variants: [any], optionFieldMap: { [key: string]: string; }, nsId: string; }) {
        esItem.variants?.map((value, index) => esItem.nsId && context.write(String(index), {
            ...value,
            productNsId: esItem.nsId,
            optionFieldMap: esItem.optionFieldMap
        }));
    },

    setValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esField: string) {
        esField.split("|").reverse().map(esField => {
            const value = getProperty(this.esRecord, esField);
            value && this.nsRecord.setValue(nsField, value);
        });
    },

    setParentValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esField: string) {
        !this.esRecord.productNsId && ITEM_IMPORT.setValue.call(this, nsField, esField);
    },

    setChildValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esField: string) {
        this.esRecord.productNsId && ITEM_IMPORT.setValue.call(this, nsField, esField);
    },

    setParentRawValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, rawValue: string) {
        !this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setChildRawValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, rawValue: string) {
        this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setParentMatrixOptions(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, arrField: any, esField: string, esValueField: string) {
        if (this.esRecord.productNsId) return;
        // when you don't know ns field
        const { ITEM_IMPORT_FIELDMAP } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const fieldMap: { [key: string]: string; } = {};
        this.esConfig[ITEM_IMPORT_FIELDMAP].map((value: string) => {
            const values = value.trim().split(/\s+/);
            fieldMap[values[0]] = values[1];
        });
        const arr: [] = getProperty(this.esRecord, arrField);
        this.esRecord.optionFieldMap = {};
        arr.map((obj: any, index: number) => {
            const nsField = fieldMap[getProperty(obj, esField)];
            this.esRecord.optionFieldMap[`option${index + 1}`] = nsField;
            const value = getProperty(obj, esValueField);
            this.nsRecord.setText(nsField, value);
        });
    },

    setChildMatrixOptions(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }) {
        if (!this.esRecord.productNsId) return;
        for (const [esField, nsField] of Object.entries(this.esRecord.optionFieldMap)) {
            this.nsRecord.setText("matrixoption" + nsField as string, this.esRecord[esField]);
        }
    },

};


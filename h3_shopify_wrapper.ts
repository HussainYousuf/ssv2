import format from 'N/format';
import search from 'N/search';
import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';
import { getFormattedDateTime, getProperty, functions } from './h3_common';

export const ITEM_EXPORT = {

    getItems(maxNsModDate: string | Date | undefined, esConfig: any) {
        const { ITEM_EXPORT_FILTERS, ITEM_EXPORT_LIMIT, ITEM_EXPORT_COLUMNS } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;

        const columns = JSON.parse(esConfig[ITEM_EXPORT_COLUMNS]);
        columns.push(
            search.createColumn({ name: "formulatext_modified", formula: "to_char({modified},'yyyy-mm-dd hh24:mi:ss')" }),
            search.createColumn({ name: "formulatext_lastquantityavailablechange", formula: "to_char({lastquantityavailablechange},'yyyy-mm-dd hh24:mi:ss')" })
        );

        const filters = search.load({
            id: esConfig[ITEM_EXPORT_FILTERS]
        }).filterExpression;

        if (maxNsModDate) {
            maxNsModDate = getFormattedDateTime(maxNsModDate as Date);
            filters.length && filters.push("AND");
            filters.push([
                [`formulatext: CASE WHEN to_char({modified},'yyyy-mm-dd hh24:mi:ss') >= '${maxNsModDate}' THEN 'T' END`, search.Operator.IS, "T"],
                "OR",
                [`formulatext: CASE WHEN to_char({lastquantityavailablechange},'yyyy-mm-dd hh24:mi:ss') >= '${maxNsModDate}' THEN 'T' END`, search.Operator.IS, "T"],
            ]);
        }

        return search.create({
            type: search.Type.ITEM,
            filters,
            columns
        }).run().getRange(0, Number(esConfig[ITEM_EXPORT_LIMIT]));
    },

    parseItem(item: string) {
        const nsItem = JSON.parse(item);
        const { formulatext_modified, formulatext_lastquantityavailablechange } = nsItem.values;
        const modified = new Date((formulatext_modified as string).replace(" ", "T") + "Z");
        const lastquantityavailablechange = formulatext_lastquantityavailablechange ? new Date((formulatext_lastquantityavailablechange as string).replace(" ", "T") + "Z") : new Date(0);
        const maxNsModDate = modified >= lastquantityavailablechange ? modified : lastquantityavailablechange;
        return {
            ...nsItem.values,
            nsId: nsItem.id,
            nsModDate: format.format({ value: maxNsModDate, type: format.Type.DATETIMETZ, timezone: format.Timezone.GMT }),
            recType: nsItem.recordType,
        };
    }

};

export const ITEM_IMPORT = {

    getItems(maxEsModDate: string | undefined, esConfig: any) {
        const { ITEM_IMPORT_URL } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const response = https.get({
            url: maxEsModDate ? esConfig[ITEM_IMPORT_URL] + `&updated_at_min=${maxEsModDate}` : esConfig[ITEM_IMPORT_URL],
            headers: {
                "Content-Type": "application/json"
            }
        }).body;

        log.debug("shopify_wrapper.getItems => response", response);
        return JSON.parse(response).products;
    },

    parseItem(item: string) {
        const esItem = JSON.parse(item);
        return {
            ...esItem,
            esId: String(esItem.id),
            esModDate: new Date(esItem.updated_at),
            recType: record.Type.INVENTORY_ITEM,
        };
    },

    shouldReduce(context: EntryPoints.MapReduce.mapContext, esItem: { variants: any[], optionFieldMap: { [key: string]: string; }, nsId: string; }) {
        esItem.variants?.map((value, index) => esItem.nsId && context.write(String(index), {
            ...value,
            productNsId: esItem.nsId,
            optionFieldMap: esItem.optionFieldMap
        }));
    },

    setParentValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esField: string) {
        !this.esRecord.productNsId && functions.setValue.call(this, nsField, esField);
    },

    setChildValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esField: string) {
        this.esRecord.productNsId && functions.setValue.call(this, nsField, esField);
    },

    setParentRawValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, rawValue: string) {
        !this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setChildRawValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, rawValue: string) {
        this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setParentMatrixOptions(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, arrField: string, esField: string, esValueField: string) {
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


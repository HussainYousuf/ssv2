import format from 'N/format';
import search from 'N/search';
import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import runtime from "N/runtime";
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';
import { getFormattedDateTime, getProperty, functions, searchRecords } from './h3_common';
import { Shopify } from "./h3_types";

function parseResponse(response: https.ClientResponse) {
    try {
        const result = JSON.parse(response.body);
        if (result.errors) throw Error();
        else return result;
    } catch (error) {
        error = Error(response.code + " " + response.body);
        log.error(error);
        throw Error(error);
    }
}

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
            // filters.push(["parent", search.Operator.NONEOF, "@NONE@"]);
            // filters.push("AND");
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
    },

    init(this: { nsRecord: { record: record.Record, search: any; }, esRecord: any, esConfig: any; }) {
        this.nsRecord.search.isParent = this.nsRecord.record.getValue("matrixtype") == "PARENT";
        this.nsRecord.search.isChild = this.nsRecord.record.getValue("matrixtype") == "CHILD";
        this.nsRecord.search.isMatrix = this.nsRecord.search.isParent || this.nsRecord.search.isChild;
        this.nsRecord.search.parent = this.nsRecord.search.isParent ? this.nsRecord.search.nsId : this.nsRecord.record.getValue("parent");
    },

    setProductValue(this: { nsRecord: { record: record.Record, search: any; }, esRecord: any, esConfig: any; }, esField: string, nsFields: string) {
        if (this.nsRecord.search.isParent) {
            if (this.esRecord.product) {
                this.esRecord = this.esRecord.product;
                functions.setRecordValue.call(this, esField, nsFields);
            } else {
                this.esRecord.product = {};
                ITEM_EXPORT.setProductValue.call(this, esField, nsFields);
            }
        }
    },

    setVariantValue(this: { nsRecord: { record: record.Record, search: any; }, esRecord: any, esConfig: any; }, esField: string, nsFields: string) {
        if (this.nsRecord.search.isChild) {
            if (this.esRecord.variant) {
                this.esRecord = this.esRecord.variant;
                functions.setRecordValue.call(this, esField, nsFields);
            } else {
                this.esRecord.variant = {};
                ITEM_EXPORT.setVariantValue.call(this, esField, nsFields);
            }
        }
    },

    putItem(this: { nsRecord: { record: record.Record, search: any; }, esRecord: any, esConfig: any; }, esId: string) {
        const { ITEM_EXPORT_PUTURL, ITEM_EXPORT_PUTURL1 } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const response: Shopify.SingleProduct & Shopify.SingleVariant = parseResponse(https.put({
            url: (this.nsRecord.search.isParent ? this.esConfig[ITEM_EXPORT_PUTURL] : this.esConfig[ITEM_EXPORT_PUTURL1]) + esId + ".json",
            body: JSON.stringify(this.esRecord),
            headers: {
                "Content-Type": "application/json"
            }
        }));

        return {
            esId: String(response.product?.id || response.variant?.id),
            esModDate: new Date(response.product?.updated_at || response.variant?.updated_at)
        };
    },

    shouldReduce(context: EntryPoints.MapReduce.mapContext, nsItem: any) {
        nsItem.isMatrix && nsItem.esItem && context.write(String(nsItem.parent), nsItem);
    },

    reduce(context: EntryPoints.MapReduce.reduceContext) {
        const values = context.values.map(value => JSON.parse(value));
        const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;
        const { BASE_MR_ESCONFIG, BASE_MR_STORE_PERMISSIONS } = constants.SCRIPT_PARAMS;

        try {
            const key = context.key;
            const { store } = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_STORE_PERMISSIONS) as string)[0];
            const esConfig = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string);
            const sortedOptions: any[] = esConfig[""]?.reverse() || [];

            const sortFunction = (sortedOptions: any[]) => (
                (
                    { option1: a1 = null, option2: b1 = null, option3: c1 = null },
                    { option1: a2 = null, option2: b2 = null, option3: c2 = null }
                ) =>
                    sortedOptions.indexOf(a2) + sortedOptions.indexOf(b2) + sortedOptions.indexOf(c2) -
                    (sortedOptions.indexOf(a1) + sortedOptions.indexOf(b1) + sortedOptions.indexOf(c1))
            );

            const parentIndex = values.findIndex(value => value.nsId == key);
            const parent = parentIndex > -1 ? values.splice(parentIndex, 1)[0] : null;
            let response;

            const { ITEM_IMPORT_GETURL1, ITEM_EXPORT_POSTURL, ITEM_EXPORT_PUTURL } = EXTERNAL_STORES_CONFIG.KEYS;
            const existingVariantIds: any = [];

            if (parent) {
                // post
                const query = parent.esItem;
                query.product.variants = values.map(value => value.esItem.variant).sort(sortFunction(sortedOptions));
                if (!query.product.variants.length) throw Error(`Can't create product {nsId: ${key}} without atleast one variant`);
                response = JSON.parse(https.post({
                    url: esConfig[ITEM_EXPORT_POSTURL],
                    body: JSON.stringify(query),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }).body);
            } else {
                // put
                const productEsId = search.create({
                    type: RECORDS_SYNC.ID,
                    filters: [
                        [RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
                        "AND",
                        [RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, search.Operator.IS, RECORDS_SYNC.VALUES.RECORD_TYPES.ITEM],
                        "AND",
                        [RECORDS_SYNC.FIELDS.NETSUITE_ID, search.Operator.IS, key]
                    ],
                    columns: [RECORDS_SYNC.FIELDS.EXTERNAL_ID]
                }).run().getRange(0, 1)[0]?.getValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID);

                if (!productEsId) throw Error(`make sure product {nsId: ${key}} is exported`);

                response = https.get({
                    url: esConfig[ITEM_IMPORT_GETURL1] + productEsId + ".json",
                }).body;
                const query = JSON.parse(response);
                query.product.variants.map((variant: any) => existingVariantIds.push(variant.id));
                query.product.variants.push(...values.map(value => value.esItem.variant));
                query.product.variants.sort(sortFunction(sortedOptions));
                response = JSON.parse(https.post({
                    url: esConfig[ITEM_EXPORT_PUTURL] + productEsId + ".json",
                    body: JSON.stringify(query),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }).body);
            }
            if (response.errors) throw Error(response.errors);
            values.forEach((value, index, array) => {
                const { nsId, nsModDate, rsId, esItem: { option1 = null, option2 = null, option3 = null } } = value;
                array[index] = { nsId, nsModDate, rsId, option1, option2, option3 };
            });
            values.sort(sortFunction(sortedOptions));
            const rsData = [];
            if (parent) {
                const { id: esId, updated_at: esModDate } = response.product;
                const { nsId, nsModDate, rsId } = parent;
                rsData.push({ nsId, esId, esModDate, nsModDate, rsId });
            }
            (response.product.variants as any[]).filter((variant) => !existingVariantIds.includes(variant.id)).map((variant, index) => {
                const { id: esId, updated_at: esModDate } = variant;
                const { nsId, nsModDate, rsId } = values[index];
                rsData.push({ nsId, esId, esModDate, nsModDate, rsId });
            });
            rsData.map(rec => {
                record.submitFields({
                    id: rec.rsId,
                    type: RECORDS_SYNC.ID,
                    values: {
                        [RECORDS_SYNC.FIELDS.EXTERNAL_ID]: String(rec.esId),
                        [RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE]: rec.esModDate,
                        [RECORDS_SYNC.FIELDS.STATUS]: RECORDS_SYNC.VALUES.STATUSES.EXPORTED
                    }
                });
            });
        } catch (error) {
            values.map(value => {
                record.submitFields({
                    id: value.rsId,
                    type: RECORDS_SYNC.ID,
                    values: {
                        [RECORDS_SYNC.FIELDS.ERROR_LOG]: error.message
                    }
                });
            });
        }
    }

};

export const ITEM_IMPORT = {

    getItems(maxEsModDate: string | undefined, esConfig: any) {
        const { ITEM_IMPORT_GETURL } = constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS;
        const response = https.get({
            url: maxEsModDate ? esConfig[ITEM_IMPORT_GETURL] + `&updated_at_min=${maxEsModDate}` : esConfig[ITEM_IMPORT_GETURL],
        }).body;

        log.debug("shopify_wrapper.getItems => response", response);
        return JSON.parse(response).products;
    },

    parseItem(item: string) {
        const esItem: Shopify.Product | Shopify.Variant = JSON.parse(item);
        return {
            ...esItem,
            esId: String(esItem.id),
            esModDate: new Date(esItem.updated_at),
            recType: record.Type.INVENTORY_ITEM,
        };
    },

    shouldReduce(context: EntryPoints.MapReduce.mapContext, esItem: { variants: any[], optionFieldMap: any, nsId: string; }) {
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


import format from 'N/format';
import search from 'N/search';
import log from 'N/log';
import https from 'N/https';
import record from "N/record";
import runtime from "N/runtime";
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';
import { getFormattedDateTime, getProperty, functions, searchRecords, getPermission } from './h3_common';
import { Shopify } from "./h3_types";

const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;
const { BASE_MR_ESCONFIG, BASE_MR_STORE_PERMISSIONS } = constants.SCRIPT_PARAMS;

function parseResponse(response: https.ClientResponse) {
    try {
        const result = JSON.parse(response.body);
        if (result.errors) throw Error();
        else return result;
    } catch (error) {
        error = Error(response.code + " " + response.body);
        throw Error(error);
    }
}

export const ITEM_IMPORT = {
    
    getRecords(maxEsModDate: string | undefined, esConfig: Record<string, any>) {
        const { ITEM_IMPORT_GETURL } = EXTERNAL_STORES_CONFIG.KEYS;
        const response = parseResponse(https.get({
            url: maxEsModDate ? esConfig[ITEM_IMPORT_GETURL] + `&updated_at_min=${maxEsModDate}` : esConfig[ITEM_IMPORT_GETURL],
        }));

        log.debug("shopify_wrapper.getRecords => response", response);
        return JSON.parse(response).products;
    },

    parseRecord(item: string) {
        const esItem: Shopify.Product | Shopify.Variant = JSON.parse(item);
        return {
            ...esItem,
            esId: String(esItem.id),
            esModDate: new Date(esItem.updated_at),
            recType: record.Type.INVENTORY_ITEM,
        };
    },

    getNsModDate(nsId: string, rsRecType: string) {
        return search.create({
            type: rsRecType,
            id: nsId,
            columns: [search.createColumn({ name: "formulatext_modified", formula: "to_char({modified},'yyyy-mm-dd hh24:mi:ss')" })],
        }).run().getRange(0, 1)[0].getValue("formulatext_modified");
    },

    shouldReduce(context: EntryPoints.MapReduce.mapContext, esItem: { variants: Record<string, any>[], optionFieldMap: Record<string, any>, nsId: string; }) {
        esItem.variants?.map((value, index) => esItem.nsId && context.write(String(index), {
            ...value,
            productNsId: esItem.nsId,
            optionFieldMap: esItem.optionFieldMap
        }));
    },

    setParentValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, esField: string) {
        !this.esRecord.productNsId && functions.setValue.call(this, nsField, esField);
    },

    setChildValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, esField: string) {
        this.esRecord.productNsId && functions.setValue.call(this, nsField, esField);
    },

    setParentRawValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, rawValue: string) {
        !this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setChildRawValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, rawValue: string) {
        this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setParentMatrixOptions(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, arrField: string, esField: string, esValueField: string) {
        if (this.esRecord.productNsId) return;
        // when you don't know ns field
        const { ITEM_IMPORT_FIELDMAP, ITEM_IMPORT_OPTIONLIST, ITEM_IMPORT_OPTIONFIELD } = EXTERNAL_STORES_CONFIG.KEYS;
        const options: string[] = [];
        searchRecords((function (this: typeof options, result: search.Result) {
            const name = result.getValue(result.columns[0].name) as string;
            this.push(name);
        }).bind(options), this.esConfig[ITEM_IMPORT_OPTIONLIST], [], ["name"]);

        const fieldMap: Record<string, string> = {};
        (this.esConfig[ITEM_IMPORT_FIELDMAP] || []).map((value: string) => {
            const values = value.split(/\s+/);
            fieldMap[values[0]] = values[1];
        });
        const arr: [] = getProperty(this.esRecord, arrField);
        this.esRecord.optionFieldMap = {};
        arr.map((obj: any, index: number) => {
            const nsField: string = fieldMap[getProperty(obj, esField)] || this.esConfig[ITEM_IMPORT_OPTIONFIELD] + (index + 1);
            this.esRecord.optionFieldMap[`option${index + 1}`] = nsField;
            const values = getProperty(obj, esValueField);
            values.map((value: string) => {
                if (!options.includes(String(value))) {
                    record.create({ type: this.esConfig[ITEM_IMPORT_OPTIONLIST], isDynamic: true })
                        .setValue("name", value)
                        .setValue("abbreviation", value.substring(0, 15))
                        .save();
                }
            });
            this.nsRecord.setText(nsField, values);
        });
    },

    setChildMatrixOptions(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }) {
        if (!this.esRecord.productNsId) return;
        for (const [esField, nsField] of Object.entries(this.esRecord.optionFieldMap)) {
            this.nsRecord.setText("matrixoption" + nsField as string, this.esRecord[esField]);
        }
    },

    reduce(context: EntryPoints.MapReduce.reduceContext) {
        context.values.map(value => {
            const esItem = ITEM_IMPORT.parseRecord(value);
            getPermission().process(ITEM_IMPORT, esItem);
        });
    }

};

export const ITEM_EXPORT = {

    init(this: { nsRecord: { record: record.Record, search: Record<string, any>; }, esRecord: Record<string, any>, esConfig: Record<string, any>; }) {
        this.nsRecord.search.isParent = this.nsRecord.record.getValue("matrixtype") == "PARENT";
        this.nsRecord.search.isChild = this.nsRecord.record.getValue("matrixtype") == "CHILD";
        this.nsRecord.search.isMatrix = this.nsRecord.search.isParent || this.nsRecord.search.isChild;
        this.nsRecord.search.parent = this.nsRecord.search.isParent ? this.nsRecord.search.nsId : this.nsRecord.record.getValue("parent");
    },

    setProductValue(this: { nsRecord: { record: record.Record, search: Record<string, any>; }, esRecord: Record<string, any>, esConfig: Record<string, any>; }, esField: string, nsFields: string) {
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

    setVariantValue(this: { nsRecord: { record: record.Record, search: Record<string, any>; }, esRecord: Record<string, any>, esConfig: Record<string, any>; }, esField: string, nsFields: string) {
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

    putItem(this: { nsRecord: { record: record.Record, search: Record<string, any>; }, esRecord: Record<string, any>, esConfig: Record<string, any>; }, esId: string) {
        const { ITEM_EXPORT_PUTURL, ITEM_EXPORT_PUTURL1 } = EXTERNAL_STORES_CONFIG.KEYS;
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

    shouldReduce(context: EntryPoints.MapReduce.mapContext, nsItem: Record<string, any>) {
        nsItem.isMatrix && nsItem.esItem && context.write(String(nsItem.parent), nsItem);
    },

    reduce(context: EntryPoints.MapReduce.reduceContext) {

        try {
            const key = context.key;
            const values = context.values.map(value => JSON.parse(value));
            const { ITEM_EXPORT_GETURL, ITEM_EXPORT_POSTURL, ITEM_EXPORT_PUTURL, ITEM_EXPORT_SORTEDOPTIONS } = EXTERNAL_STORES_CONFIG.KEYS;
            const { store } = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_STORE_PERMISSIONS) as string)[0];
            const esConfig = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string);
            const sortedOptions: string[] = esConfig[ITEM_EXPORT_SORTEDOPTIONS]?.split(",").map((i: string) => i.trim()).filter((i: string) => i).reverse() || [];

            const sortFunction = (sortedOptions: string[]) => (
                (
                    { option1: a1 = "", option2: b1 = "", option3: c1 = "" },
                    { option1: a2 = "", option2: b2 = "", option3: c2 = "" }
                ) =>
                    sortedOptions.indexOf(a2) + sortedOptions.indexOf(b2) + sortedOptions.indexOf(c2) -
                    (sortedOptions.indexOf(a1) + sortedOptions.indexOf(b1) + sortedOptions.indexOf(c1))
            );

            const parentIndex = values.findIndex(value => value.nsId == key);
            const parent = parentIndex > -1 ? values.splice(parentIndex, 1)[0] : null;
            let response: Shopify.SingleProduct;

            const existingVariantIds: number[] = [];

            if (parent) {
                // post
                const query = parent.esItem;
                query.product.variants = values.map(value => value.esItem.variant).sort(sortFunction(sortedOptions));
                if (!query.product.variants.length) throw Error(`Can't create product {nsId: ${key}} without atleast one variant`);
                response = parseResponse(https.post({
                    url: esConfig[ITEM_EXPORT_POSTURL],
                    body: JSON.stringify(query),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }));
            } else {
                // put
                const productEsId = search.create({
                    type: RECORDS_SYNC.ID,
                    filters: [
                        [RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
                        "AND",
                        [RECORDS_SYNC.FIELDS.RECORD_TYPE, search.Operator.IS, RECORDS_SYNC.VALUES.RECORD_TYPES.ITEM],
                        "AND",
                        [RECORDS_SYNC.FIELDS.NETSUITE_ID, search.Operator.IS, key]
                    ],
                    columns: [RECORDS_SYNC.FIELDS.EXTERNAL_ID]
                }).run().getRange(0, 1)[0]?.getValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID);

                if (!productEsId) throw Error(`make sure product {nsId: ${key}} is exported`);

                response = parseResponse(https.get({
                    url: esConfig[ITEM_EXPORT_GETURL] + productEsId + ".json",
                }));
                const query = response;
                query.product.variants.map((variant: any) => existingVariantIds.push(variant.id));
                query.product.variants.push(...values.map(value => value.esItem.variant));
                query.product.variants.sort(sortFunction(sortedOptions));
                response = parseResponse(https.post({
                    url: esConfig[ITEM_EXPORT_PUTURL] + productEsId + ".json",
                    body: JSON.stringify(query),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }));
            }

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
            response.product.variants.filter((variant) => !existingVariantIds.includes(variant.id)).map((variant, index) => {
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
                        [RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE]: format.parse({ type: format.Type.DATETIMETZ, value: rec.nsModDate }),
                        [RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE]: new Date(rec.esModDate),
                        [RECORDS_SYNC.FIELDS.STATUS]: RECORDS_SYNC.VALUES.STATUSES.EXPORTED
                    }
                });
            });
        } catch (error) {
            context.values.map(value => {
                record.submitFields({
                    id: JSON.parse(value).rsId,
                    type: RECORDS_SYNC.ID,
                    values: {
                        [RECORDS_SYNC.FIELDS.ERROR_LOG]: error.message
                    }
                });
            });
        }

    }

};

export const CUSTOMER_IMPORT = {

    getCustomers(maxEsModDate: string | undefined, esConfig: Record<string, any>) {
        const { CUSTOMER_IMPORT_GETURL } = EXTERNAL_STORES_CONFIG.KEYS;
        const response = parseResponse(https.get({
            url: maxEsModDate ? esConfig[CUSTOMER_IMPORT_GETURL] + `&updated_at_min=${maxEsModDate}` : esConfig[CUSTOMER_IMPORT_GETURL],
        }));

        log.debug("shopify_wrapper.getCustomers => response", response);
        return JSON.parse(response).customers;
    },

    parseCustomer(customer: string) {
        const esCustomer: Shopify.Customer = JSON.parse(customer);
        return {
            ...esCustomer,
            esId: String(esCustomer.id),
            esModDate: new Date(esCustomer.updated_at),
            recType: record.Type.CUSTOMER,
        };
    },

};

export const CUSTOMER_EXPORT = {
    getCustomers(maxNsModDate: string | Date | undefined, esConfig: Record<string, any>) {
        const { CUSTOMER_EXPORT_SEARCHID } = EXTERNAL_STORES_CONFIG.KEYS;

        const { filterExpression: filters, columns } = search.load({
            id: esConfig[CUSTOMER_EXPORT_SEARCHID]
        });

        columns.push(
            search.createColumn({ name: "formulatext_modified", formula: "to_char({lastmodifieddate},'yyyy-mm-dd hh24:mi:ss')" }),
        );

        if (maxNsModDate) {
            maxNsModDate = getFormattedDateTime(maxNsModDate as Date);
            filters.length && filters.push("AND");
            filters.push([
                [`formulatext: CASE WHEN to_char({lastmodifieddate},'yyyy-mm-dd hh24:mi:ss') >= '${maxNsModDate}' THEN 'T' END`, search.Operator.IS, "T"],
            ]);
        }

        return search.create({
            type: search.Type.CUSTOMER,
            filters,
            columns
        });
    },

    parseCustomer(customer: string) {
        const nsCustomer = JSON.parse(customer);
        const { formulatext_modified } = nsCustomer.values;
        const maxNsModDate = new Date((formulatext_modified as string).replace(" ", "T") + "Z");
        return {
            ...nsCustomer.values,
            nsId: nsCustomer.id,
            nsModDate: format.format({ value: maxNsModDate, type: format.Type.DATETIMETZ, timezone: format.Timezone.GMT }),
            recType: nsCustomer.recordType,
        };
    },
};
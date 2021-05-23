import format from 'N/format';
import search from 'N/search';
import log, { debug } from 'N/log';
import https from 'N/https';
import record from "N/record";
import runtime from "N/runtime";
import constants from "./h3_constants";
import { EntryPoints } from 'N/types';
import { getProperty, searchRecords, scheduleScript, getOperation, init, getFailedRecords } from './h3_common';
import { Shopify } from "./h3_types";

const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;

function parseResponse(response: https.ClientResponse) {
    try {
        const result = JSON.parse(response.body);
        if (result.errors) throw Error();
        else return result;
    } catch (error) {
        throw Error(response.code + " " + response.body);
    }
}

function getRecords(maxEsModDate: Date | undefined) {
    const { permission, esConfig, filters } = init();
    const { _GETURL } = EXTERNAL_STORES_CONFIG.KEYS;
    const url = maxEsModDate ? esConfig[permission + _GETURL] + `&updated_at_min=${maxEsModDate.toISOString()}` : esConfig[permission + _GETURL];
    const records = [];
    let since_id = "&since_id=0";

    while (records.length <= 10000) {
        const response = parseResponse(https.get({
            url: url + since_id
        }));
        const tempRecords = Object.values(response as Record<string, any>)[0];
        if (tempRecords.length) {
            records.push(...tempRecords);
            since_id = `&since_id=${records[records.length - 1].id}`;
        } else {
            since_id = "";
            break;
        }
    }

    const storePermissions = JSON.parse(runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_MR_STORE_PERMISSIONS) as string);
    if (since_id) {
        scheduleScript(storePermissions);
    } else {
        scheduleScript(storePermissions.slice(1));
    }

    const ids = getFailedRecords(RECORDS_SYNC.FIELDS.EXTERNAL_ID, filters).join();
    if (ids) {
        const response = parseResponse(https.get({
            url: esConfig[permission + _GETURL] + `&ids=${ids}`,
        }));
        records.push(...Object.values(response as Record<string, any>)[0]);
    }

    log.debug("shopify_wrapper.getRecords => records", records);
    return records;
}

function parseRecord(record: string, nsRecType: string) {
    const esRecord = JSON.parse(record);
    return {
        ...esRecord,
        esId: String(esRecord.id),
        esModDate: new Date(esRecord.updated_at),
        nsRecType,
    };
}

export const ITEM_IMPORT = {

    getRecords,

    parseRecord(_record: string) {
        return parseRecord(_record, record.Type.INVENTORY_ITEM as unknown as string);
    },

    shouldReduce(context: EntryPoints.MapReduce.mapContext, esRecord: { variants: Record<string, any>[], optionFieldMap: Record<string, any>, nsId: string; }) {
        esRecord.variants?.map((value, index) => esRecord.nsId && context.write(String(index), {
            ...value,
            productNsId: esRecord.nsId,
            optionFieldMap: esRecord.optionFieldMap
        }));
    },

    setParentValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, esField: string) {
        !this.esRecord.productNsId && getOperation().functions.setValue.call(this, nsField, esField);
    },

    setChildValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, esField: string) {
        this.esRecord.productNsId && getOperation().functions.setValue.call(this, nsField, esField);
    },

    setParentRawValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, rawValue: string) {
        !this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setChildRawValue(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, nsField: string, rawValue: string) {
        this.esRecord.productNsId && this.nsRecord.setValue(nsField, rawValue);
    },

    setParentMatrixOptions(this: { nsRecord: record.Record, esRecord: Record<string, any>, esConfig: Record<string, any>; }, arrField: string, esField: string, esValueField: string) {
        // this.esRecord.productNsId is not available in map stage, this function shud be used in map stage
        if (this.esRecord.productNsId) return;
        // when you don't know ns field use field_map
        const { permission } = this.esConfig;
        const { _FIELDMAP, _OPTIONLIST, _OPTIONFIELD } = EXTERNAL_STORES_CONFIG.KEYS;
        // populating existing options
        const options: string[] = [];
        searchRecords((function (this: typeof options, result: search.Result) {
            const name = result.getValue(result.columns[0].name) as string;
            this.push(name);
        }).bind(options), this.esConfig[permission + _OPTIONLIST], [], ["name"]);

        const fieldMap: Record<string, string> = {};
        (this.esConfig[permission + _FIELDMAP] || []).map((value: string) => {
            const values = value.split(/\s+/);
            fieldMap[values[0]] = values[1];
        });
        const arr: [] = getProperty(this.esRecord, arrField);
        // mutating esRecord
        this.esRecord.optionFieldMap = {};
        arr.map((obj: any, index: number) => {
            // get field from fieldMap else from _optionfield (auto enumerate from 1)
            const nsField: string = fieldMap[getProperty(obj, esField)] || this.esConfig[permission + _OPTIONFIELD] + (index + 1);
            this.esRecord.optionFieldMap[`option${index + 1}`] = nsField;
            const values = getProperty(obj, esValueField);
            values.map((value: string) => {
                if (!options.includes(String(value))) {
                    record.create({ type: this.esConfig[permission + _OPTIONLIST], isDynamic: true })
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
            getOperation().process(ITEM_IMPORT, esItem);
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
                getOperation().functions.setValue.call(this, esField, nsFields);
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
                getOperation().functions.setValue.call(this, esField, nsFields);
            } else {
                this.esRecord.variant = {};
                ITEM_EXPORT.setVariantValue.call(this, esField, nsFields);
            }
        }
    },

    putRecord(this: { nsRecord: { record: record.Record, search: Record<string, any>; }, esRecord: Record<string, any>, esConfig: Record<string, any>; }, esId: string) {
        const { permission } = this.esConfig;
        const { _PUTURL, _PUTURL1 } = EXTERNAL_STORES_CONFIG.KEYS;
        // rare case of using conjuntion, not sure if it returned variant or product
        const response: Shopify.SingleProduct & Shopify.SingleVariant = parseResponse(https.put({
            url: (this.nsRecord.search.isParent ? this.esConfig[permission + _PUTURL] : this.esConfig[permission + _PUTURL1]) + esId + ".json",
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
        // nsItem.esRecord will be undefined in putRecord case (simple product, variant update)
        nsItem.isMatrix && nsItem.esRecord && context.write(String(nsItem.parent), nsItem);
    },

    reduce(context: EntryPoints.MapReduce.reduceContext) {

        try {
            const { store, permission, esConfig, rsStatus, rsRecType } = init();
            const key = context.key;
            const values = context.values.map(value => JSON.parse(value));
            const { _GETURL, _POSTURL, _PUTURL, _SORTEDOPTIONS } = EXTERNAL_STORES_CONFIG.KEYS;
            const sortedOptions: string[] = esConfig[permission + _SORTEDOPTIONS]?.split(",").map((i: string) => i.trim()).filter((i: string) => i).reverse() || [];

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
                // case when there's a new matrix product and its variants 
                const query = parent.esItem;
                query.product.variants = values.map(value => value.esItem.variant).sort(sortFunction(sortedOptions));
                if (!query.product.variants.length) throw Error(`Can't create product {nsId: ${key}} without atleast one variant`);
                response = parseResponse(https.post({
                    url: esConfig[permission + _POSTURL],
                    body: JSON.stringify(query),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }));
            } else {
                // case when only new variants are added
                // also later if u alter the sorting criteria and want to reorder on es, 
                // invoke this by deleting any item-variant entry of records sync and edit the same item again, 
                // this will skip the initial putRecord method and invoke this. 
                // not generalizing this behaviour as its rare
                const productEsId = search.create({
                    type: RECORDS_SYNC.ID,
                    filters: [
                        [RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
                        "AND",
                        [RECORDS_SYNC.FIELDS.RECORD_TYPE, search.Operator.IS, rsRecType],
                        "AND",
                        [RECORDS_SYNC.FIELDS.NETSUITE_ID, search.Operator.IS, key]
                    ],
                    columns: [RECORDS_SYNC.FIELDS.EXTERNAL_ID]
                }).run().getRange(0, 1)[0]?.getValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID);

                if (!productEsId) throw Error(`make sure product {nsId: ${key}} is exported`);

                response = parseResponse(https.get({
                    url: esConfig[permission + _GETURL] + productEsId + ".json",
                }));
                const query = response;
                query.product.variants.map((variant: any) => existingVariantIds.push(variant.id));
                query.product.variants.push(...values.map(value => value.esItem.variant)); // pushing new variants with existing ones
                query.product.variants.sort(sortFunction(sortedOptions)); // sorting em all
                response = parseResponse(https.put({
                    url: esConfig[permission + _PUTURL] + productEsId + ".json",
                    body: JSON.stringify(query),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }));
                // [feature], if partial fail of variant is allowed remove that variant from values else it will mess up esid assignment 
            }

            // this is for error logging, options are added because of sorting in next step
            values.forEach((value, index, array) => {
                const { nsId, nsModDate, rsId, esItem: { option1 = null, option2 = null, option3 = null } } = value;
                array[index] = { nsId, nsModDate, rsId, option1, option2, option3 };
            });
            // we need to sort as we are going to compare with response variants (newly created only) to get esId 
            // sorting is based on option fields only, and that is later used to associate esids to our nsids
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
                        [RECORDS_SYNC.FIELDS.STATUS]: rsStatus
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

    getRecords,

    parseRecord(_record: string) {
        return parseRecord(_record, record.Type.CUSTOMER as unknown as string);
    },

};

export const CUSTOMER_EXPORT = {

};
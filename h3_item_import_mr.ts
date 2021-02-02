/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import * as common from "./h3_common";


function init() {
    const storePermissions = JSON.parse(runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.ITEM_IMPORT_STORE_PERMISSIONS) as string);
    const { store } = storePermissions[0];
    const filters = [
        [constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
        "AND",
        [constants.RECORDS.RECORDS_SYNC.FIELDS.STATUS_NAME, search.Operator.IS, constants.LIST_RECORDS.STATUSES.IMPORTED],
        "AND",
        [constants.RECORDS.RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, search.Operator.IS, constants.LIST_RECORDS.RECORD_TYPES.ITEM]
    ];
    return { storePermissions, filters };
}


export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {

    const { storePermissions, filters } = init();

    const maxEsModDateCol = search.createColumn({
        name: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE_MODIFICATION_DATE,
        summary: search.Summary.MAX,
    });

    const maxEsModDate = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        filters,
        columns: [maxEsModDateCol]
    }).run().getRange(0, 1)[0]?.getValue(maxEsModDateCol) as string;

    log.debug("item_import.getInputData => maxEsModDate", maxEsModDate);

    return common.getWrapper(storePermissions[0])?.getItemsFromEs(maxEsModDate);

}

export function map(context: EntryPoints.MapReduce.mapContext) {

    const { storePermissions, filters } = init();
    const wrapper = common.getWrapper(storePermissions[0]);
    const esItem = wrapper?.parseEsItem(context.value);
    const esId = esItem.id;

    filters.push("AND", [constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_ID, search.Operator.IS, esId]);

    const rsSearch = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        filters,
        columns: [constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_ID]
    }).run().getRange(0, 1)[0];

    const rsId = rsSearch?.id;
    let nsId = rsSearch?.getValue(constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_ID) as string;

    const rsRecord = rsId ?
        record.load({ type: constants.RECORDS.RECORDS_SYNC.ID, id: rsId, isDynamic: true }) :
        record.create({ type: constants.RECORDS.RECORDS_SYNC.ID, isDynamic: true });

    const nsItem = nsId ?
        record.load({ type: record.Type.INVENTORY_ITEM, id: nsId, isDynamic: true }) :
        record.create({ type: record.Type.INVENTORY_ITEM, isDynamic: true });

    for (const [key, value] of Object.entries(common.esConfig)) {
        if (!key.startsWith("item_import.field_map.")) continue;
        const nsField = key.split(".")[2];
        const values = value.trim().split(" ");
        const arg1 = values[0];
        const args = values.splice(1);
        const thisArg = { record: nsItem, fieldId: nsField };
        if (args.length > 0) common.functions[arg1].apply(thisArg, args.map(arg => esItem[arg]));
        else common.functions["setValue"].call(thisArg, esItem[arg1]);
    }

    nsId = String(nsItem.save());
    rsRecord.setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE, value: storePermissions[0].store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_ID, value: storePermissions[0].store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_ID, value: storePermissions[0].store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, value: storePermissions[0].store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE, value: storePermissions[0].store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE_MODIFICATION_DATE, value: storePermissions[0].store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.STATUS_NAME, value: storePermissions[0].store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.ERROR_LOG, value: storePermissions[0].store })
        .save();

}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
}

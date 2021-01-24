/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import * as common from "./h3_common";

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const storePermissions = JSON.parse(runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.ITEM_IMPORT_STORE_PERMISSIONS) as string);
    const { store } = storePermissions[0];

    const maxEsModDateCol = search.createColumn({
        name: "formulatext",
        summary: search.Summary.MAX,
        formula: `to_char({${constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE_MODIFICATION_DATE}}, 'yyyy-mm-dd hh24:mi:ss')`
    });

    const maxEsModDate = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        filters: [
            [constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
            "AND",
            [constants.RECORDS.RECORDS_SYNC.FIELDS.STATUS_NAME, search.Operator.IS, constants.LIST_RECORDS.STATUSES.IMPORTED],
            "AND",
            [constants.RECORDS.RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, search.Operator.IS, constants.LIST_RECORDS.RECORD_TYPES.ITEM]
        ],
        columns: [maxEsModDateCol]
    }).run().getRange(0, 1)[0]?.getValue(maxEsModDateCol) as string;

    log.debug("item_import.getInputData => maxEsModDate", maxEsModDate);

    return common.getWrapper(storePermissions[0])?.getItemsFromEs(maxEsModDate);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
}
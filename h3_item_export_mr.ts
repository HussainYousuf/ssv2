/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import runtime from 'N/runtime';
import search from 'N/search';
import constants from './h3_constants';

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const columns = [
        search.createColumn({
            name: constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE,
            summary: search.Summary.MAX
        })
    ];
    const netsuiteModificationDate = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        columns
    }).run().getRange(0, 1)[0]?.getValue(columns[0]);
    
    return search.load({
        type: search.Type.ITEM,
        id: runtime.getCurrentScript().getParameter("searchId") as string
    });
}

export function map(context: EntryPoints.MapReduce.mapContext) {
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
}
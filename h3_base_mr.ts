/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import search from 'N/search';
import constants from './h3_constants';
import { getWrapper, getRecordType, areOtherDeploymentsRunning, searchRecords, scheduleScript, getOperation } from './h3_common';
import runtime from "N/runtime";

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const currentScript = runtime.getCurrentScript();
    if (currentScript.deploymentId == constants.SCRIPTS_DEPLOYMENTS.BASE_MR_SCH && !areOtherDeploymentsRunning(currentScript.id, currentScript.deploymentId)) {
        init();
        throw Error();
    }
    else
        return getWrapper().getInputData?.(context) || getRecordType().getInputData?.(context) || getOperation().getInputData(context);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    return getWrapper().map?.(context) || getRecordType()?.map(context) || getOperation().map(context);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    return getWrapper().reduce?.(context) || getRecordType()?.reduce(context) || getOperation().reduce(context);
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    return getWrapper().summarize?.(context) || getRecordType()?.summarize(context) || getOperation().summarize(context);
}



function init() {
    const { EXTERNAL_STORES_CONFIG } = constants.RECORDS;

    const storePermissions: { store: string, permission: string; }[] = [];

    searchRecords(
        (function (result: search.Result) {
            const store = result.getValue(result.columns[0].name) as string;
            const permissions = decrypt(result.getValue(result.columns[1].name) as string);
            permissions.map(permission => storePermissions.push({ store, permission }));
        }),
        EXTERNAL_STORES_CONFIG.ID,
        [EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, EXTERNAL_STORES_CONFIG.KEYS.KEY],
        [EXTERNAL_STORES_CONFIG.FIELDS.STORE, EXTERNAL_STORES_CONFIG.FIELDS.VALUE]
    );

    scheduleScript((storePermissions));
}

function decrypt(text: string): [string] {
    return JSON.parse(text).permissions;
}

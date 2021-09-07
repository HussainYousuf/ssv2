// /**
//  *@NApiVersion 2.1
//  *@NScriptType MapReduceScript
//  */
import { EntryPoints } from 'N/types';
// import search from 'N/search';
// import constants from './h3_constants';
// import { getWrapper, getRecordType, areOtherDeploymentsRunning, searchRecords, scheduleScript, getOperation } from './h3_common';
// import runtime from "N/runtime";

// const limit = 10000;

// function extendedFunction(functionName: string){
//     return getWrapper()[functionName] || getRecordType()[functionName] || getOperation()[functionName] || (self as any)[functionName];
// }

// const self = {
//     getInputData(context: EntryPoints.MapReduce.getInputDataContext){
//         const maxIdentifier = extendedFunction("getMaxIdentifier")();
//         return extendedFunction("getRecords")(maxIdentifier, limit); // getFailedRecords, upsertMaxIdentifier
//     },
//     extractRecord(data: string){

//     }
// }

// export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
//     const currentScript = runtime.getCurrentScript();
//     if (currentScript.deploymentId == constants.SCRIPTS_DEPLOYMENTS.BASE_MR_SCH && !areOtherDeploymentsRunning(currentScript.id, currentScript.deploymentId)) {
//         init();
//     }
//     else {
//         return extendedFunction("getInputData")(context);
//     }
// }

// export function map(context: EntryPoints.MapReduce.mapContext) {
//     let error;
//     const extractedRecord: {rsId: string, rsDate: string, id:string, otherId: string, date: string, other: any} = extendedFunction("extractRecord")(context);
//     if(rsDate === date) return;
//     try {
//         const loadedRecord = extendedFunction("loadRecord")(extractedRecord);
//         const environment = {};
//         extendedFunction("transformRecord")({extractedRecord, loadedRecord, environment, esConfig});
//         const upsertedRecord: {otherId: string, otherDate: string} = extendedFunction("upsertRecord")(loadedRecord);
//         extendedFunction?.("doReduce")({loadedRecord, otherId})
//     } catch (error) {
//         error = error.message;
//     }
//     extendedFunction("upsertRsRecord")({rsId, id, otherId, date, otherDate, error, extras: context.value})
// }

// export function reduce(context: EntryPoints.MapReduce.reduceContext) {
//     (getWrapper().reduce || getRecordType().reduce || getOperation().reduce)?.(context);
// }

export function summarize(context: EntryPoints.MapReduce.reduceContext) {
    // context.values
    // context.output.iterator
    // (getWrapper().summarize || getRecordType().summarize || getOperation().summarize)(context);
}



function init() {
    const { EXTERNAL_STORES_CONFIG } = constants.RECORDS;

    const storePermissions: { store: string, permission: string, deploymentId: string; }[] = [];

    searchRecords(
        (function (result: search.Result) {
            const store = result.getValue(EXTERNAL_STORES_CONFIG.FIELDS.STORE) as string;
            const { permissions, deploymentId } = decrypt(result.getValue(EXTERNAL_STORES_CONFIG.FIELDS.VALUE) as string);
            permissions.forEach(permission => storePermissions.push({ store, permission, deploymentId }));
        }),
        EXTERNAL_STORES_CONFIG.ID,
        [EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, EXTERNAL_STORES_CONFIG.KEYS.KEY],
        [EXTERNAL_STORES_CONFIG.FIELDS.STORE, EXTERNAL_STORES_CONFIG.FIELDS.VALUE]
    );

    scheduleScript(storePermissions);
}

// function decrypt(text: string) {
//     return JSON.parse(text) as { permissions: string[], deploymentId: string; };
// }

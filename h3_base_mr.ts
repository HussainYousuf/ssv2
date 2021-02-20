/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { getPermission } from './h3_common';

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    return getPermission()?.getInputData(context);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    getPermission()?.map(context);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    getPermission()?.reduce(context);
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    getPermission()?.summarize(context);
}

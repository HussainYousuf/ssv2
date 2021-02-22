/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { getWrapper, getPermission } from './h3_common';

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    return getWrapper().getInputData?.(context) || getPermission().getInputData(context);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    return getWrapper().map?.(context) || getPermission().map(context);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    return getWrapper().reduce?.(context) || getPermission().reduce(context);
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    return getWrapper().summarize?.(context) || getPermission().summarize(context);
}

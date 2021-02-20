/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { getWrapper } from './h3_common';

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    return getWrapper()?.getInputData(context);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    getWrapper()?.map(context);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    getWrapper()?.reduce(context);
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    getWrapper()?.summarize(context);
}

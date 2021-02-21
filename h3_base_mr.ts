/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { getCurrentWrapper, getPermission, getProperty } from './h3_common';

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const _super = getProperty(getCurrentWrapper(), "getInputData");
    if (_super) return _super(context);
    return getPermission().getInputData(context);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const _super = getProperty(getCurrentWrapper(), "map");
    if (_super) return _super(context);
    return getPermission().map(context);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    const _super = getProperty(getCurrentWrapper(), "reduce");
    if (_super) return _super(context);
    return getPermission().reduce(context);
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    const _super = getProperty(getCurrentWrapper(), "summarize");
    if (_super) return _super(context);
    return getPermission().summarize(context);
}

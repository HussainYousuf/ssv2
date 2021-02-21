/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { getCurrentWrapper, getPermission, getProperty } from './h3_common';
import runtime from 'N/runtime';
import constants from './h3_constants';

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const permission = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_PERMISSION) as string;
    const _super = getProperty(getCurrentWrapper(), `${permission}.getInputData`);
    if (_super) return _super(context);
    return getPermission(permission)?.getInputData(context);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const permission = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_PERMISSION) as string;
    const _super = getProperty(getCurrentWrapper(), `${permission}.map`);
    if (_super) return _super(context);
    return getPermission(permission)?.map(context);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    const permission = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_PERMISSION) as string;
    const _super = getProperty(getCurrentWrapper(), `${permission}.reduce`);
    if (_super) return _super(context);
    return getPermission(permission)?.reduce(context);
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    const permission = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_PERMISSION) as string;
    const _super = getProperty(getCurrentWrapper(), `${permission}.summarize`);
    if (_super) return _super(context);
    return getPermission(permission)?.summarize(context);
}

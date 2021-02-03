/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */

import { EntryPoints } from 'N/types';
import search from 'N/search';
import constants from './h3_constants';
import * as common from './h3_common';
import log from "N/log";

export function execute(context: EntryPoints.Scheduled.executeContext) {
    const callbackContext = { storePermissions: [] };
    function callback(this: any, result: search.Result) {
        try {
            const store = result.getValue(result.columns[0].name) as string;
            const permissions = decrypt(result.getValue(result.columns[1].name) as string);
            permissions.map(permission => this.storePermissions.push({ store, permission }));
        } catch (error) {
            log.error(error.name, error.message);
        }
    }
    common.searchRecords(
        callback.bind(callbackContext),
        constants.RECORDS.EXTERNAL_STORES_CONFIG.ID,
        [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS.KEY],
        [constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.STORE, constants.RECORDS.EXTERNAL_STORES_CONFIG.FIELDS.VALUE]
    );

    const { storePermissions } = callbackContext;
    common.scheduleScript((storePermissions as unknown as [{ store: string, permission: string; }])
        .sort((a, b) => constants.ORDERED_RECORD_TYPES.indexOf(a.permission) - constants.ORDERED_RECORD_TYPES.indexOf(b.permission)));
}

function decrypt(text: string): [string] {
    return JSON.parse(text).permissions;
}

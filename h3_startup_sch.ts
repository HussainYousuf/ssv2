/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */

import { EntryPoints } from 'N/types';
import search from 'N/search';
import constants from './h3_constants';
import { searchRecords, scheduleScript } from './h3_common';


export function execute(context: EntryPoints.Scheduled.executeContext) {
    const { EXTERNAL_STORES_CONFIG } = constants.RECORDS;
    
    const callbackContext: { storePermissions: { store: string, permission: string; }[]; } = { storePermissions: [] };
    function callback(this: typeof callbackContext, result: search.Result) {
        const store = result.getValue(result.columns[0].name) as string;
        const permissions = decrypt(result.getValue(result.columns[1].name) as string);
        permissions.map(permission => this.storePermissions.push({ store, permission }));
    }
    searchRecords(
        callback.bind(callbackContext),
        EXTERNAL_STORES_CONFIG.ID,
        [EXTERNAL_STORES_CONFIG.FIELDS.KEY, search.Operator.IS, EXTERNAL_STORES_CONFIG.KEYS.KEY],
        [EXTERNAL_STORES_CONFIG.FIELDS.STORE, EXTERNAL_STORES_CONFIG.FIELDS.VALUE]
    );

    const { storePermissions } = callbackContext;
    scheduleScript((storePermissions));
}

function decrypt(text: string): [string] {
    return JSON.parse(text).permissions;
}

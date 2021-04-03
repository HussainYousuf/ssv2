import { EntryPoints } from 'N/types';
import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import { getWrapper, functions } from './h3_common';
import format from 'N/format';

const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;
const { BASE_MR_ESCONFIG, BASE_MR_STORE_PERMISSIONS } = constants.SCRIPT_PARAMS;

function init() {
    const { store } = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_STORE_PERMISSIONS) as string)[0];
    const esConfig = JSON.parse(runtime.getCurrentScript().getParameter(BASE_MR_ESCONFIG) as string);
    const filters = [
        [RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
        "AND",
        [RECORDS_SYNC.FIELDS.RECORD_TYPE, search.Operator.IS, RECORDS_SYNC.VALUES.RECORD_TYPES.ITEM],
        "AND",
        [RECORDS_SYNC.FIELDS.STATUS, search.Operator.IS, RECORDS_SYNC.VALUES.STATUSES.IMPORTED],
    ];
    return { store, filters, esConfig };
}


export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const wrapper = getWrapper();
    const { filters, esConfig } = init();
    const maxEsModDateCol = search.createColumn({
        name: RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE,
        summary: search.Summary.MAX,
    });

    let maxEsModDate = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        filters,
        columns: [maxEsModDateCol]
    }).run().getRange(0, 1)[0]?.getValue(maxEsModDateCol) as string;

    if (maxEsModDate) maxEsModDate = (format.parse({ type: format.Type.DATETIMETZ, value: maxEsModDate }) as Date).toISOString();

    log.debug("item_import.getInputData => maxEsModDate", maxEsModDate);

    return wrapper.getItems(maxEsModDate, esConfig);
}

export function process(wrapper: any, esItem: any) {

    log.debug("process => esItem", esItem);

    const { store, filters, esConfig } = init();
    const { esId, esModDate, recType } = esItem;

    filters.pop();
    filters.push([RECORDS_SYNC.FIELDS.EXTERNAL_ID, search.Operator.IS, esId]);

    const rsSearch = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        filters,
        columns: [RECORDS_SYNC.FIELDS.NETSUITE_ID, RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE]
    }).run().getRange(0, 1)[0];

    const rsEsModDate = rsSearch?.getValue(RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE) as string;
    if (rsEsModDate && (format.parse({ type: format.Type.DATETIMETZ, value: rsEsModDate }) as Date).getTime() == (esModDate as Date).setMilliseconds(0)) return;

    const rsId = rsSearch?.id;
    let nsId = rsSearch?.getValue(RECORDS_SYNC.FIELDS.NETSUITE_ID) as string;

    const rsRecord = rsId ?
        record.load({ type: constants.RECORDS.RECORDS_SYNC.ID, id: rsId, isDynamic: true }) :
        record.create({ type: constants.RECORDS.RECORDS_SYNC.ID, isDynamic: true });

    rsRecord.setValue(RECORDS_SYNC.FIELDS.EXTERNAL_STORE, store)
        .setValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID, esId)
        .setValue(RECORDS_SYNC.FIELDS.RECORD_TYPE, RECORDS_SYNC.VALUES.RECORD_TYPES.ITEM);

    try {
        const nsItem = nsId ?
            record.load({ type: recType, id: nsId, isDynamic: true }) :
            record.create({ type: recType, isDynamic: true });

        for (const value of esConfig[EXTERNAL_STORES_CONFIG.KEYS.ITEM_IMPORT_FUNCTION] as string[]) {
            const values = value.split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || functions[functionName];
            _function && _function.apply({ nsRecord: nsItem, esRecord: esItem, esConfig }, args);
        }

        esItem.nsId = nsId = String(nsItem.save({
            ignoreMandatoryFields: true
        }));

        const formulatext_modified = search.create({
            type: search.Type.ITEM,
            id: nsId,
            columns: [search.createColumn({ name: "formulatext_modified", formula: "to_char({modified},'yyyy-mm-dd hh24:mi:ss')" })],
        }).run().getRange(0, 1)[0].getValue("formulatext_modified");

        const nsModDate = format.format({
            value: new Date((formulatext_modified as string).replace(" ", "T") + "Z"),
            type: format.Type.DATETIMETZ,
            timezone: format.Timezone.GMT
        });

        rsRecord.setValue(RECORDS_SYNC.FIELDS.NETSUITE_ID, nsId)
            .setValue(RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE, nsModDate)
            .setValue(RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE, esModDate)
            .setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.STATUSES.IMPORTED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, "");

        log.debug("Success", `${RECORDS_SYNC.VALUES.RECORD_TYPES.ITEM} with id ${nsId}, ${RECORDS_SYNC.VALUES.STATUSES.IMPORTED}`);

    } catch (error) {
        rsRecord.setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.STATUSES.FAILED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, error.message);
    }

    rsRecord.save({
        ignoreMandatoryFields: true
    });

}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const wrapper = getWrapper();
    const esItem = wrapper.parseItem(context.value);
    process(wrapper, esItem);
    wrapper.shouldReduce?.(context, esItem);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    throw Error();
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    throw Error();
}

import { EntryPoints } from 'N/types';
import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import { getWrapper, functions } from './h3_common';
import format from 'N/format';

function init() {
    const store = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_STORE);
    const esConfig = JSON.parse(runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_CONFIG) as string);
    const filters = [
        [constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
        "AND",
        [constants.RECORDS.RECORDS_SYNC.FIELDS.STATUS_NAME, search.Operator.IS, constants.LIST_RECORDS.STATUSES.IMPORTED],
        "AND",
        [constants.RECORDS.RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, search.Operator.IS, constants.LIST_RECORDS.RECORD_TYPES.ITEM]
    ];
    return { store, filters, esConfig };
}


export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const wrapper = getWrapper();
    const { filters, esConfig } = init();
    const maxEsModDateCol = search.createColumn({
        name: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE,
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

function process(wrapper: any, esItem: any) {

    const { store, filters, esConfig } = init();
    const { esId, esModDate, recType } = esItem;

    filters.push("AND", [constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_ID, search.Operator.IS, esId]);

    const rsSearch = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        filters,
        columns: [constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_ID]
    }).run().getRange(0, 1)[0];

    const rsId = rsSearch?.id;
    let nsId = rsSearch?.getValue(constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_ID) as string;

    const rsRecord = rsId ?
        record.load({ type: constants.RECORDS.RECORDS_SYNC.ID, id: rsId, isDynamic: true }) :
        record.create({ type: constants.RECORDS.RECORDS_SYNC.ID, isDynamic: true });

    rsRecord.setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_STORE, value: store })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_ID, value: esId })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, value: constants.LIST_RECORDS.RECORD_TYPES.ITEM })
        .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE, value: esModDate });

    try {
        const nsItem = nsId ?
            record.load({ type: recType, id: nsId, isDynamic: true }) :
            record.create({ type: recType, isDynamic: true });

        for (const value of esConfig[constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS.ITEM_IMPORT_FIELDMAP] as [string]) {
            const values = value.trim().split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || functions[functionName];
            _function && _function.apply({ nsRecord: nsItem, esRecord: esItem, esConfig }, args);
        }

        nsId = String(nsItem.save());
        esItem.nsId = nsId;

        rsRecord.setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.NETSUITE_ID, value: nsId })
            .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.STATUS_NAME, value: constants.LIST_RECORDS.STATUSES.IMPORTED })
            .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.ERROR_LOG, value: "" });
    } catch (error) {
        rsRecord.setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.STATUS_NAME, value: constants.LIST_RECORDS.STATUSES.FAILED })
            .setValue({ fieldId: constants.RECORDS.RECORDS_SYNC.FIELDS.ERROR_LOG, value: error.message });
    }

    rsRecord.save();
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const wrapper = getWrapper();
    const esItem = wrapper.parseItem(context.value);
    process(wrapper, esItem);
    wrapper.shouldReduce?.(context, esItem);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    context.values.map(value => {

    });
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
}

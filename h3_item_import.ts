import { EntryPoints } from 'N/types';
import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import { getWrapper, functions } from './h3_common';
import format from 'N/format';

const { EXTERNAL_STORE, RECORD_TYPE, RECORD_TYPE_NAME, NETSUITE_ID, EXTERNAL_ID, EXTERNAL_MODIFICATION_DATE, STATUS, STATUS_NAME, ERROR_LOG } = constants.RECORDS.RECORDS_SYNC.FIELDS;

function init() {
    const store = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_STORE);
    const esConfig = JSON.parse(runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_CONFIG) as string);
    const filters = [
        [EXTERNAL_STORE, search.Operator.IS, store],
        "AND",
        [RECORD_TYPE_NAME, search.Operator.IS, constants.LIST_RECORDS.RECORD_TYPES.ITEM],
        "AND",
        [STATUS_NAME, search.Operator.IS, constants.LIST_RECORDS.STATUSES.IMPORTED],
    ];
    return { store, filters, esConfig };
}


export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const wrapper = getWrapper();
    const { filters, esConfig } = init();
    const maxEsModDateCol = search.createColumn({
        name: EXTERNAL_MODIFICATION_DATE,
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

    log.debug("process => esItem", esItem);

    const { store, filters, esConfig } = init();
    const { esId, esModDate, recType } = esItem;

    filters.pop();
    filters.push([EXTERNAL_ID, search.Operator.IS, esId]);

    const rsSearch = search.create({
        type: constants.RECORDS.RECORDS_SYNC.ID,
        filters,
        columns: [NETSUITE_ID, EXTERNAL_MODIFICATION_DATE]
    }).run().getRange(0, 1)[0];

    const rsEsModDate = rsSearch?.getValue(EXTERNAL_MODIFICATION_DATE) as string;
    if (rsEsModDate && (format.parse({ type: format.Type.DATETIMETZ, value: rsEsModDate }) as Date).getTime() == (esModDate as Date).setMilliseconds(0)) return;

    const rsId = rsSearch?.id;
    let nsId = rsSearch?.getValue(NETSUITE_ID) as string;

    const rsRecord = rsId ?
        record.load({ type: constants.RECORDS.RECORDS_SYNC.ID, id: rsId, isDynamic: true }) :
        record.create({ type: constants.RECORDS.RECORDS_SYNC.ID, isDynamic: true });

    rsRecord.setValue(EXTERNAL_STORE, store)
        .setValue(EXTERNAL_ID, esId)
        .setText(RECORD_TYPE, constants.LIST_RECORDS.RECORD_TYPES.ITEM)
        .setValue(EXTERNAL_MODIFICATION_DATE, esModDate);

    try {
        const nsItem = nsId ?
            record.load({ type: recType, id: nsId, isDynamic: true }) :
            record.create({ type: recType, isDynamic: true });

        for (const value of esConfig[constants.RECORDS.EXTERNAL_STORES_CONFIG.KEYS.ITEM_IMPORT_FUNCTION] as [string]) {
            const values = value.trim().split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || functions[functionName];
            _function && _function.apply({ nsRecord: nsItem, esRecord: esItem, esConfig }, args);
        }

        esItem.nsId = nsId = String(nsItem.save({
            ignoreMandatoryFields: true
        }));

        rsRecord.setValue(NETSUITE_ID, nsId)
            .setText(STATUS, constants.LIST_RECORDS.STATUSES.IMPORTED)
            .setValue(ERROR_LOG, "");

        log.debug("Success", `${constants.LIST_RECORDS.RECORD_TYPES.ITEM} with id ${nsId}, ${constants.LIST_RECORDS.STATUSES.IMPORTED}`);
        
    } catch (error) {
        rsRecord.setText(STATUS, constants.LIST_RECORDS.STATUSES.FAILED)
            .setValue(ERROR_LOG, error.message);
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
    const wrapper = getWrapper();
    context.values.map(value => {
        const esItem = wrapper.parseItem(value);
        process(wrapper, esItem);
    });
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
}

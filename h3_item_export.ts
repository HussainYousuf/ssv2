import { EntryPoints } from 'N/types';
import record from 'N/record';
import runtime from 'N/runtime';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import { getWrapper, functions } from './h3_common';
import format from 'N/format';

const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;

function init() {
    const store = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_STORE);
    const esConfig = JSON.parse(runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.BASE_CONFIG) as string);
    const filters = [
        [RECORDS_SYNC.FIELDS.EXTERNAL_STORE, search.Operator.IS, store],
        "AND",
        [RECORDS_SYNC.FIELDS.RECORD_TYPE_NAME, search.Operator.IS, constants.LIST_RECORDS.RECORD_TYPES.ITEM],
        "AND",
        [RECORDS_SYNC.FIELDS.STATUS_NAME, search.Operator.IS, constants.LIST_RECORDS.STATUSES.EXPORTED],
    ];
    return { store, filters, esConfig };
}


export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const wrapper = getWrapper();
    const { filters, esConfig } = init();
    const maxNsModDateCol = search.createColumn({
        name: RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE,
        summary: search.Summary.MAX,
    });

    let maxNsModDate: string | Date = search.create({
        type: RECORDS_SYNC.ID,
        filters,
        columns: [maxNsModDateCol]
    }).run().getRange(0, 1)[0]?.getValue(maxNsModDateCol) as string;

    if (maxNsModDate) maxNsModDate = format.parse({ type: format.Type.DATETIMETZ, value: maxNsModDate }) as Date;

    log.debug("item_export.getInputData => maxNsModDate", maxNsModDate);

    return wrapper.getItems(maxNsModDate, esConfig);
}

function process(wrapper: any, nsItem: any) {

    log.debug("process => nsItem", nsItem);

    const { store, filters, esConfig } = init();
    const { nsId, nsModDate, recType } = nsItem;

    filters.pop();
    filters.push([RECORDS_SYNC.FIELDS.NETSUITE_ID, search.Operator.IS, nsId]);

    const rsSearch = search.create({
        type: RECORDS_SYNC.ID,
        filters,
        columns: [RECORDS_SYNC.FIELDS.EXTERNAL_ID, RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE]
    }).run().getRange(0, 1)[0];

    const rsNsModDate = rsSearch?.getValue(RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE) as string;
    if (rsNsModDate && rsNsModDate == nsModDate) return;

    const rsId = rsSearch?.id;
    let esId = rsSearch?.getValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID) as string;

    const rsRecord = rsId ?
        record.load({ type: RECORDS_SYNC.ID, id: rsId, isDynamic: true }) :
        record.create({ type: RECORDS_SYNC.ID, isDynamic: true });

    rsRecord.setValue(RECORDS_SYNC.FIELDS.EXTERNAL_STORE, store)
        .setValue(RECORDS_SYNC.FIELDS.NETSUITE_ID, nsId)
        .setText(RECORDS_SYNC.FIELDS.RECORD_TYPE, constants.LIST_RECORDS.RECORD_TYPES.ITEM)
        .setValue(RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE, nsModDate);

    try {
        const esItem = {};

        for (const value of esConfig[EXTERNAL_STORES_CONFIG.KEYS.ITEM_EXPORT_FUNCTION] as [string]) {
            const values = value.trim().split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || functions[functionName];
            _function && _function.apply({
                nsRecord: { record: record.load({ type: recType, id: nsId, isDynamic: true }), search: nsItem },
                esRecord: esItem,
                esConfig
            }, args);
        }

        nsItem.esItem = esItem;
        esId = esId ? wrapper.putItem?.(esItem, esId) : wrapper.postItem?.(esItem);

        if (!esId) return;

        rsRecord.setValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID, esId)
            .setText(RECORDS_SYNC.FIELDS.STATUS, constants.LIST_RECORDS.STATUSES.EXPORTED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, "");

        log.debug("Success", `${constants.LIST_RECORDS.RECORD_TYPES.ITEM} with id ${nsId}, ${constants.LIST_RECORDS.STATUSES.EXPORTED}`);

    } catch (error) {
        rsRecord.setText(RECORDS_SYNC.FIELDS.STATUS, constants.LIST_RECORDS.STATUSES.FAILED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, error.message);
    }

    rsRecord.save({
        ignoreMandatoryFields: true
    });

}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const wrapper = getWrapper();
    const nsItem = wrapper.parseItem(context.value);
    process(wrapper, nsItem);
    wrapper.shouldReduce?.(context, nsItem);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    const wrapper = getWrapper();
    context.values.map(value => {
        const nsItem = wrapper.parseItem(value);
        process(wrapper, nsItem);
    });
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
}

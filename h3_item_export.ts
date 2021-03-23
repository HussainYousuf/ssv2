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
        [RECORDS_SYNC.FIELDS.STATUS, search.Operator.IS, RECORDS_SYNC.VALUES.STATUSES.EXPORTED],
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
        .setValue(RECORDS_SYNC.FIELDS.RECORD_TYPE, RECORDS_SYNC.VALUES.RECORD_TYPES.ITEM)
        .setValue(RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE, nsModDate);

    try {
        const esItem = {};
        const nsRecord = record.load({ type: recType, id: nsId, isDynamic: true });

        wrapper.init?.call({
            nsRecord: { record: nsRecord, search: nsItem },
            esRecord: esItem,
            esConfig
        });

        for (const value of esConfig[EXTERNAL_STORES_CONFIG.KEYS.ITEM_EXPORT_FUNCTION] as [string]) {
            const values = value.trim().split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || functions[functionName];
            _function && _function.apply({
                nsRecord: { record: nsRecord, search: nsItem },
                esRecord: esItem,
                esConfig
            }, args);
        }

        const result = esId ?
            wrapper.putItem?.call({
                nsRecord: { record: nsRecord, search: nsItem },
                esRecord: esItem,
                esConfig
            }, esId) :
            wrapper.postItem?.call({
                nsRecord: { record: nsRecord, search: nsItem },
                esRecord: esItem,
                esConfig
            });

        if (!result) {
            nsItem.esItem = esItem;
            throw Error("");
        }

        rsRecord.setValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID, result.esId)
            .setValue(RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE, result.esModDate)
            .setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.STATUSES.EXPORTED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, "");

        log.debug("Success", `${RECORDS_SYNC.VALUES.RECORD_TYPES.ITEM} with id ${nsId}, ${RECORDS_SYNC.VALUES.STATUSES.EXPORTED}`);

    } catch (error) {
        rsRecord.setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.STATUSES.FAILED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, error.message);
    }

    nsItem.rsId = rsRecord.save({
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
    context.values.map(nsItem => {
        process(wrapper, nsItem);
    });
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
}

import { EntryPoints } from 'N/types';
import record from 'N/record';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import { getWrapper, functions, init, getRecordType } from './h3_common';
import format from 'N/format';

const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
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
    log.debug("export.getInputData => maxNsModDate", maxNsModDate);

    return getRecordType().getRecords(maxNsModDate, esConfig);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const wrapper = getWrapper();
    const nsSearch = wrapper.parseSearch(context.value);
    process(wrapper, nsSearch);
    wrapper.shouldReduce?.(context, nsSearch);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    throw Error();
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    throw Error();
}

export function process(wrapper: Record<string, any>, nsSearch: Record<string, any>) {

    log.debug("process => nsSearch", nsSearch);

    const { store, permission, rsRecType, rsStatus, filters, esConfig } = init();
    const { nsId, nsModDate, recType } = nsSearch;

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
        .setValue(RECORDS_SYNC.FIELDS.RECORD_TYPE, rsRecType);

    try {
        const esRecord = {};
        const nsRecord = record.load({ type: recType, id: nsId, isDynamic: true });

        wrapper.init?.call({
            nsRecord: { record: nsRecord, search: nsSearch },
            esRecord,
            esConfig
        });

        for (const value of esConfig[permission + EXTERNAL_STORES_CONFIG.KEYS._FUNCTIONS] as string[]) {
            const values = value.split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || functions[functionName];
            _function && _function.apply({
                nsRecord: { record: nsRecord, search: nsSearch },
                esRecord,
                esConfig
            }, args);
        }

        const result = esId ?
            wrapper.putRecord?.call({
                nsRecord: { record: nsRecord, search: nsSearch },
                esRecord,
                esConfig
            }, esId) :
            wrapper.postRecord?.call({
                nsRecord: { record: nsRecord, search: nsSearch },
                esRecord,
                esConfig
            });

        if (!result) {
            nsSearch.esRecord = esRecord;
            throw Error("");
        }

        rsRecord.setValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID, result.esId)
            .setValue(RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE, format.parse({ type: format.Type.DATETIMETZ, value: nsModDate }))
            .setValue(RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE, result.esModDate)
            .setValue(RECORDS_SYNC.FIELDS.STATUS, rsStatus)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, "");

        log.debug("Success", `${rsRecType} with id ${nsId}, ${rsStatus}`);

    } catch (error) {
        rsRecord.setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.FAILED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, error.message);
    }

    nsSearch.rsId = rsRecord.save({
        ignoreMandatoryFields: true
    });

}

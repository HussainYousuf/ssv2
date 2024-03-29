import { EntryPoints } from 'N/types';
import record from 'N/record';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import { getWrapper, init, getRecordType, getFormattedDateTimeString, getMaxDate, upsertMaxDate, getFailedRecords } from './h3_common';
import format from 'N/format';

const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const maxDate = getMaxDate(true);
    return (getRecordType().getRecords || functions.getRecords)(maxDate);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const wrapper = getWrapper();
    const nsSearch = (getRecordType().parseRecord || functions.parseRecord)(context.value);
    process(wrapper, nsSearch);
    wrapper.shouldReduce?.(context, nsSearch);
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    upsertMaxDate(true);
}

export const functions = {

    setRecordValue(this: { nsRecord: { record: record.Record, search: Record<string, any>; }, esRecord: Record<string, any>, esConfig: Record<string, any>; }, esField: string, nsFields: string) {
        for (const nsField of nsFields.split("|")) {
            const value = this.nsRecord.record.getValue(nsField);
            if (value) {
                this.esRecord[esField] = value;
                break;
            }
        }
    },

    setRecordText(this: { nsRecord: { record: record.Record, search: Record<string, any>; }, esRecord: Record<string, any>, esConfig: Record<string, any>; }, esField: string, nsFields: string) {
        for (const nsField of nsFields.split("|")) {
            const value = this.nsRecord.record.getText(nsField);
            if (value) {
                this.esRecord[esField] = value;
                break;
            }
        }
    },

    getRecords(maxNsModDate: string | Date | undefined) {

        const { permission, esConfig, filters: _filters } = init();
        _filters.pop();
        _filters.push([RECORDS_SYNC.FIELDS.STATUS, search.Operator.IS, ""]);
        const ids = getFailedRecords(RECORDS_SYNC.FIELDS.NETSUITE_ID, _filters);

        const { filterExpression: filters, columns, searchType } = search.load({
            id: esConfig[permission + EXTERNAL_STORES_CONFIG.KEYS._SEARCHID]
        });

        columns.push(
            search.createColumn({ name: "formulatext_modified", formula: "to_char({lastmodifieddate},'yyyy-mm-dd hh24:mi:ss')" }),
        );

        if (maxNsModDate) {
            maxNsModDate = getFormattedDateTimeString(maxNsModDate as Date);
            filters.length && filters.push("AND");
            filters.push([
                ["internalid", search.Operator.ANYOF, ids],
                "OR",
                [`formulatext: CASE WHEN to_char({lastmodifieddate},'yyyy-mm-dd hh24:mi:ss') >= '${maxNsModDate}' THEN 'T' END`, search.Operator.IS, "T"],
            ]);
        }

        return search.create({
            type: searchType,
            filters,
            columns
        });
    },

    parseRecord(search: string) {
        const nsSearch = JSON.parse(search);
        const { formulatext_modified } = nsSearch.values;
        const maxNsModDate = new Date((formulatext_modified as string).replace(" ", "T") + "Z");
        return {
            ...nsSearch.values,
            nsId: nsSearch.id,
            nsModDate: format.format({ value: maxNsModDate, type: format.Type.DATETIMETZ, timezone: format.Timezone.GMT }),
            nsRecType: nsSearch.recordType,
        };
    }
};

export function process(wrapper: Record<string, any>, nsSearch: Record<string, any>) {

    const recordType = getRecordType();

    log.debug("process => nsSearch", nsSearch);

    const { store, permission, rsRecType, rsStatus, filters, esConfig } = init();
    const { nsId, nsModDate, nsRecType } = nsSearch;

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
        const nsRecord = record.load({ type: nsRecType, id: nsId, isDynamic: true });

        wrapper.init?.call({
            nsRecord: { record: nsRecord, search: nsSearch },
            esRecord,
            esConfig
        });

        for (const value of esConfig[permission + EXTERNAL_STORES_CONFIG.KEYS._FUNCTIONS] as string[]) {
            const values = value.split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = (wrapper[functionName] || recordType[functionName] || (functions as any))[functionName];
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
            // mutate nsSearch to pass info to reduce stage
            nsSearch.esRecord = esRecord;
            // intentional, rest steps are to be done in reduce stage (wrapper)
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

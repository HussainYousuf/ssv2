import { EntryPoints } from 'N/types';
import record from 'N/record';
import search from 'N/search';
import log from 'N/log';
import constants from './h3_constants';
import { getWrapper, init, getRecordType, getProperty } from './h3_common';
import format from 'N/format';

const { RECORDS_SYNC, EXTERNAL_STORES_CONFIG } = constants.RECORDS;

export function getInputData(context: EntryPoints.MapReduce.getInputDataContext) {
    const { filters } = init();

    const maxEsModDateCol = search.createColumn({
        name: RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE,
        summary: search.Summary.MAX,
    });

    let maxEsModDate: string | Date = search.create({
        type: RECORDS_SYNC.ID,
        filters,
        columns: [maxEsModDateCol]
    }).run().getRange(0, 1)[0]?.getValue(maxEsModDateCol) as string;

    if (maxEsModDate) maxEsModDate = (format.parse({ type: format.Type.DATETIMETZ, value: maxEsModDate }) as Date);

    log.debug("import.getInputData => maxEsModDate", maxEsModDate);

    return getWrapper().getRecords(maxEsModDate);
}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const wrapper = getWrapper();
    const esRecord = wrapper.parseRecord(context.value);
    process(wrapper, esRecord);
    wrapper.shouldReduce?.(context, esRecord);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    throw Error();
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    throw Error();
}

export const functions: any = {
    setValue(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esFields: string) {
        for (const esField of esFields.split("|")) {
            const value = getProperty(this.esRecord, esField);
            if (value) {
                this.nsRecord.setValue(nsField, value);
                break;
            }
        }
    },
    setText(this: { nsRecord: record.Record, esRecord: any, esConfig: any; }, nsField: string, esFields: string) {
        for (const esField of esFields.split("|")) {
            const value = getProperty(this.esRecord, esField);
            if (value) {
                this.nsRecord.setText(nsField, value);
                break;
            }
        }
    },
    getNsModDate(nsId: string, rsRecType: string) {
        return search.create({
            type: rsRecType,
            filters: ["internalid", search.Operator.IS, nsId],
            columns: [search.createColumn({ name: "formulatext_modified", formula: "to_char({lastmodifieddate},'yyyy-mm-dd hh24:mi:ss')" })],
        }).run().getRange(0, 1)[0].getValue("formulatext_modified");
    }
};

export function process(wrapper: any, esRecord: any) {

    const recordType = getRecordType();

    log.debug("process => esRecord", esRecord);

    const { store, permission, rsRecType, rsStatus, filters, esConfig } = init();
    const { esId, esModDate, recType } = esRecord;

    filters.pop();
    filters.push([RECORDS_SYNC.FIELDS.EXTERNAL_ID, search.Operator.IS, esId]);

    const rsSearch = search.create({
        type: RECORDS_SYNC.ID,
        filters,
        columns: [RECORDS_SYNC.FIELDS.NETSUITE_ID, RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE]
    }).run().getRange(0, 1)[0];

    const rsEsModDate = rsSearch?.getValue(RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE) as string;
    if (rsEsModDate && (format.parse({ type: format.Type.DATETIMETZ, value: rsEsModDate }) as Date).getTime() >= (esModDate as Date).setMilliseconds(0)) return;

    const rsId = rsSearch?.id;
    let nsId = rsSearch?.getValue(RECORDS_SYNC.FIELDS.NETSUITE_ID) as string;

    const rsRecord = rsId ?
        record.load({ type: RECORDS_SYNC.ID, id: rsId, isDynamic: true }) :
        record.create({ type: RECORDS_SYNC.ID, isDynamic: true });

    rsRecord.setValue(RECORDS_SYNC.FIELDS.EXTERNAL_STORE, store)
        .setValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID, esId)
        .setValue(RECORDS_SYNC.FIELDS.RECORD_TYPE, rsRecType);

    try {
        const nsRecord = nsId ?
            record.load({ type: recType, id: nsId, isDynamic: true }) :
            record.create({ type: recType, isDynamic: true });

        for (const value of esConfig[permission + EXTERNAL_STORES_CONFIG.KEYS._FUNCTIONS] as string[]) {
            const values = value.split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || recordType[functionName] || functions[functionName];
            _function && _function.apply({ nsRecord, esRecord, esConfig }, args);
        }

        esRecord.nsId = nsId = String(nsRecord.save({
            ignoreMandatoryFields: true
        }));

        const formulatext_modified = recordType.getNsModDate?.(nsId) || functions.getNsModDate(nsId, rsRecType);

        const nsModDate = format.format({
            value: new Date((formulatext_modified as string).replace(" ", "T") + "Z"),
            type: format.Type.DATETIMETZ,
            timezone: format.Timezone.GMT
        });

        rsRecord.setValue(RECORDS_SYNC.FIELDS.NETSUITE_ID, nsId)
            .setValue(RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE, nsModDate)
            .setValue(RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE, esModDate)
            .setValue(RECORDS_SYNC.FIELDS.STATUS, rsStatus)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, "");

        log.debug("Success", `${rsRecType} with id ${nsId}, ${rsStatus}`);

    } catch (error) {
        rsRecord.setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.FAILED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, error.message);
    }

    rsRecord.save({
        ignoreMandatoryFields: true
    });

}

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
        [RECORDS_SYNC.FIELDS.RECORD_TYPE, search.Operator.IS, RECORDS_SYNC.VALUES.RECORD_TYPES.CUSTOMER],
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

    log.debug("customer_export.getInputData => maxNsModDate", maxNsModDate);

    return wrapper.getCustomers(maxNsModDate, esConfig);
}

export function process(wrapper: any, nsCustomer: any) {

    log.debug("process => nsCustomer", nsCustomer);

    const { store, filters, esConfig } = init();
    const { nsId, nsModDate, recType } = nsCustomer;

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
        .setValue(RECORDS_SYNC.FIELDS.RECORD_TYPE, RECORDS_SYNC.VALUES.RECORD_TYPES.CUSTOMER);

    try {
        const esCustomer = {};
        const nsRecord = record.load({ type: recType, id: nsId, isDynamic: true });

        wrapper.init?.call({
            nsRecord: { record: nsRecord, search: nsCustomer },
            esRecord: esCustomer,
            esConfig
        });

        for (const value of esConfig[EXTERNAL_STORES_CONFIG.KEYS.CUSTOMER_EXPORT_FUNCTION] as string[]) {
            const values = value.split(/\s+/);
            const functionName = values[0];
            const args = values.slice(1);
            const _function = wrapper[functionName] || functions[functionName];
            _function && _function.apply({
                nsRecord: { record: nsRecord, search: nsCustomer },
                esRecord: esCustomer,
                esConfig
            }, args);
        }

        const result = esId ?
            wrapper.putCustomer?.call({
                nsRecord: { record: nsRecord, search: nsCustomer },
                esRecord: esCustomer,
                esConfig
            }, esId) :
            wrapper.postCustomer?.call({
                nsRecord: { record: nsRecord, search: nsCustomer },
                esRecord: esCustomer,
                esConfig
            });

        if (!result) {
            nsCustomer.esCustomer = esCustomer;
            throw Error("");
        }

        rsRecord.setValue(RECORDS_SYNC.FIELDS.EXTERNAL_ID, result.esId)
            .setValue(RECORDS_SYNC.FIELDS.NETSUITE_MODIFICATION_DATE, format.parse({ type: format.Type.DATETIMETZ, value: nsModDate }))
            .setValue(RECORDS_SYNC.FIELDS.EXTERNAL_MODIFICATION_DATE, result.esModDate)
            .setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.STATUSES.EXPORTED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, "");

        log.debug("Success", `${RECORDS_SYNC.VALUES.RECORD_TYPES.CUSTOMER} with id ${nsId}, ${RECORDS_SYNC.VALUES.STATUSES.EXPORTED}`);

    } catch (error) {
        rsRecord.setValue(RECORDS_SYNC.FIELDS.STATUS, RECORDS_SYNC.VALUES.STATUSES.FAILED)
            .setValue(RECORDS_SYNC.FIELDS.ERROR_LOG, error.message);
    }

    nsCustomer.rsId = rsRecord.save({
        ignoreMandatoryFields: true
    });

}

export function map(context: EntryPoints.MapReduce.mapContext) {
    const wrapper = getWrapper();
    const nsCustomer = wrapper.parseCustomer(context.value);
    process(wrapper, nsCustomer);
    wrapper.shouldReduce?.(context, nsCustomer);
}

export function reduce(context: EntryPoints.MapReduce.reduceContext) {
    throw Error();
}

export function summarize(context: EntryPoints.MapReduce.summarizeContext) {
    throw Error();
}

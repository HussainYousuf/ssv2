import search from 'N/search';
import constants from './h3_constants';
import format from 'N/format';
import { getFormattedDateTimeString, init } from './h3_common';


const { EXTERNAL_STORES_CONFIG } = constants.RECORDS;

export const IMPORT = {

    getNsModDate(nsId: string) {
        return search.create({
            type: search.Type.ITEM,
            filters: ["internalid", search.Operator.IS, nsId],
            columns: [search.createColumn({ name: "formulatext_modified", formula: "to_char({modified},'yyyy-mm-dd hh24:mi:ss')" })],
        }).run().getRange(0, 1)[0].getValue("formulatext_modified");
    },

};

export const EXPORT = {

    getRecords(maxNsModDate: string | Date | undefined) {

        const { permission, esConfig } = init();
        const { filterExpression: filters, columns } = search.load({
            id: esConfig[permission + EXTERNAL_STORES_CONFIG.KEYS._SEARCHID]
        });

        columns.push(
            search.createColumn({ name: "formulatext_modified", formula: "to_char({modified},'yyyy-mm-dd hh24:mi:ss')" }),
            search.createColumn({ name: "formulatext_lastquantityavailablechange", formula: "to_char({lastquantityavailablechange},'yyyy-mm-dd hh24:mi:ss')" })
        );

        if (maxNsModDate) {
            maxNsModDate = getFormattedDateTimeString(maxNsModDate as Date);
            filters.length && filters.push("AND");
            filters.push([
                [`formulatext: CASE WHEN to_char({modified},'yyyy-mm-dd hh24:mi:ss') >= '${maxNsModDate}' THEN 'T' END`, search.Operator.IS, "T"],
                "OR",
                [`formulatext: CASE WHEN to_char({lastquantityavailablechange},'yyyy-mm-dd hh24:mi:ss') >= '${maxNsModDate}' THEN 'T' END`, search.Operator.IS, "T"],
            ]);
        }

        return search.create({
            type: search.Type.ITEM,
            filters,
            columns
        });
    },

    parseRecord(search: string) {
        const nsSearch = JSON.parse(search);
        const { formulatext_modified, formulatext_lastquantityavailablechange } = nsSearch.values;
        const modified = new Date((formulatext_modified as string).replace(" ", "T") + "Z");
        const lastquantityavailablechange = formulatext_lastquantityavailablechange ? new Date((formulatext_lastquantityavailablechange as string).replace(" ", "T") + "Z") : new Date(0);
        const maxNsModDate = modified >= lastquantityavailablechange ? modified : lastquantityavailablechange;
        return {
            ...nsSearch.values,
            nsId: nsSearch.id,
            nsModDate: format.format({ value: maxNsModDate, type: format.Type.DATETIMETZ, timezone: format.Timezone.GMT }),
            nsRecType: nsSearch.recordType,
        };
    },

};
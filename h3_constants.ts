
// values length must not be > 38
// values must be unique

export default {
    SCRIPT_PARAMS: {
        DASHBOARD_SL_FOLDER: "custscript_h3_dashboard_sl_folder",
        DASHBOARD_SL_PARENT: "custscript_h3_dashboard_sl_parent",
        SYNC_SL_KEY: "custscript_h3_sync_sl_key"
    },
    SCRIPTS: {
        DASHBOARD_SL: "customscript_h3_dashboard_sl",
        SYNC_SL: "customscript_h3_sync_sl"
    },
    SCRIPTS_DEPLOYMENTS: {
        DASHBOARD_SL: "customdeploy_h3_dashboard_sl",
        SYNC_SL: "customdeploy_h3_sync_sl	"
    },
    RECORDS: {
        RECORDS_SYNC: {
            ID: "customrecord_h3_records_sync",
            FIELDS: {
                EXTERNAL_STORE: "custrecord_h3_rs_external_store",
                NETSUITE_ID: "custrecord_h3_rs_netsuite_id",
                EXTERNAL_ID: "custrecord_h3_rs_external_id",
                RECORD_TYPE: "custrecord_h3_rs_record_type",
                SYNC_FLOW: "custrecord_h3_rs_sync_flow",
                NETSUITE_MODIFICATION_DATE: "custrecord_h3_rs_ns_mod_date",
                EXTERNAL_MODIFICATION_DATE: "custrecord_h3_rs_es_mod_date",
                TAGS: "custrecord_h3_rs_tags",
                ERROR_LOG: "custrecord_h3_rs_error_log"
            }
        },
        EXTERNAL_STORES_CONFIG: {
            ID: "customrecord_h3_external_stores_config",
            FIELDS: {
                STORE: "custrecord_h3_esc_store",
                KEY: "custrecord_h3_esc_key",
                VALUE: "custrecord_h3_esc_value",
            }
        }
    },
    LISTS: {
        RECORD_TYPES: {
            ITEM: "Item",
            SALESORDER: "Salesorder"
        },
        SYNC_FLOWS: {
            IMPORT: "Import",
            EXPORT: "Export",
            IMPORT_EXPORT: "Import&Export"
        },
        TAGS: {
            FAILED: "Failed",
            MANUAL: "Manual"
        }
    },
    ORDERED_RECORD_TYPES: [
        "ITEM_IMPORT",
        "ITEM_EXPORT",
        "SALES_ORDER_IMPORT"
    ]
};


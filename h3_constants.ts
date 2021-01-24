
// values length must not be > 40
// values must be unique

export default {
    SCRIPT_PARAMS: {
        DASHBOARD_SL_FOLDER: "custscript_h3_dashboard_sl_folder",
        DASHBOARD_SL_PARENT: "custscript_h3_dashboard_sl_parent",
        SYNC_SL_KEY: "custscript_h3_sync_sl_key",
        ITEM_IMPORT_STORE_PERMISSIONS: "custscript_h3_item_import_mr_sps"
    },
    SCRIPTS: {
        DASHBOARD_SL: "customscript_h3_dashboard_sl",
        SYNC_SL: "customscript_h3_sync_sl",
        STARTUP: "customscript_h3_startup_sch",
        ITEM_IMPORT: "customscript_h3_item_import_mr"
    },
    SCRIPTS_DEPLOYMENTS: {
        DASHBOARD_SL: "customdeploy_h3_dashboard_sl",
        SYNC_SL: "customdeploy_h3_sync_sl",
        STARTUP: "customdeploy_h3_startup_sch",
        ITEM_IMPORT: "customdeploy_h3_item_import_mr"
    },
    RECORDS: {
        RECORDS_SYNC: {
            ID: "customrecord_h3_records_sync",
            FIELDS: {
                EXTERNAL_STORE: "custrecord_h3_rs_external_store",
                NETSUITE_ID: "custrecord_h3_rs_netsuite_id",
                EXTERNAL_ID: "custrecord_h3_rs_external_id",
                RECORD_TYPE_NAME: "custrecord_h3_rs_record_type.name",
                NETSUITE_MODIFICATION_DATE: "custrecord_h3_rs_ns_mod_date",
                EXTERNAL_STORE_MODIFICATION_DATE: "custrecord_h3_rs_es_mod_date",
                STATUS_NAME: "custrecord_h3_rs_status.name",
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
    LIST_RECORDS: {
        RECORD_TYPES: {
            ITEM: "Item",
            SALESORDER: "Salesorder"
        },
        STATUSES: {
            IMPORTED: "Imported",
            EXPORTED: "Exported",
            FAILED: "Failed",
        }
    },
    ORDERED_RECORD_TYPES: [
        "ITEM_IMPORT",
        "ITEM_EXPORT",
        "SALESORDER_IMPORT",
        "SALESORDER_EXPORT"
    ]
};


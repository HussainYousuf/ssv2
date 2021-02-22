
// values length must not be > 40
// values must be unique

export default {
    SCRIPT_PARAMS: {
        DASHBOARD_SL_FOLDER: "custscript_h3_dashboard_sl_folder",
        DASHBOARD_SL_PARENT: "custscript_h3_dashboard_sl_parent",
        SYNC_SL_KEY: "custscript_h3_sync_sl_key",
        BASE_STORE_PERMISSIONS: "custscript_h3_base_mr_sps",
        BASE_CONFIG: "custscript_h3_base_mr_config",
        BASE_TYPE: "custscript_h3_base_mr_type",
        BASE_STORE: "custscript_h3_base_mr_store",
        BASE_PERMISSION: "custscript_h3_base_mr_permission",
    },
    SCRIPTS: {
        DASHBOARD_SL: "customscript_h3_dashboard_sl",
        SYNC_SL: "customscript_h3_sync_sl",
        STARTUP: "customscript_h3_startup_sch",
        BASE: "customscript_h3_base_mr"
    },
    SCRIPTS_DEPLOYMENTS: {
        DASHBOARD_SL: "customdeploy_h3_dashboard_sl",
        SYNC_SL: "customdeploy_h3_sync_sl",
        STARTUP: "customdeploy_h3_startup_sch",
        BASE: "customdeploy_h3_base_mr"
    },
    RECORDS: {
        RECORDS_SYNC: {
            ID: "customrecord_h3_records_sync",
            FIELDS: {
                EXTERNAL_STORE: "custrecord_h3_rs_external_store",
                NETSUITE_ID: "custrecord_h3_rs_netsuite_id",
                EXTERNAL_ID: "custrecord_h3_rs_external_id",
                RECORD_TYPE_NAME: "custrecord_h3_rs_record_type.name",
                RECORD_TYPE: "custrecord_h3_rs_record_type",
                NETSUITE_MODIFICATION_DATE: "custrecord_h3_rs_netsuite_mod_date",
                EXTERNAL_MODIFICATION_DATE: "custrecord_h3_rs_external_mod_date",
                STATUS_NAME: "custrecord_h3_rs_status.name",
                STATUS: "custrecord_h3_rs_status",
                ERROR_LOG: "custrecord_h3_rs_error_log"
            }
        },
        EXTERNAL_STORES_CONFIG: {
            ID: "customrecord_h3_external_stores_config",
            FIELDS: {
                STORE: "custrecord_h3_esc_store",
                KEY: "custrecord_h3_esc_key",
                VALUE: "custrecord_h3_esc_value",
            },
            KEYS: {
                TYPE: "type",
                URL: "url",
                KEY: "key",
                ACCESSTOKEN: "accesstoken",
                ITEM_IMPORT_QUERY: "item_import_query",
                ITEM_IMPORT_FILTERS: "item_import_filters",
                ITEM_IMPORT_FIELDMAP: "item_import_fieldmap",
                ITEM_IMPORT_FUNCTION: "item_import_function",
                ITEM_IMPORT_URL: "item_import_url"
            },
            PERMISSIONS: {
                ITEM_IMPORT: "ITEM_IMPORT",
                ITEM_EXPORT: "ITEM_EXPORT",
                SALESORDER_IMPORT: "SALESORDER_IMPORT",
                SALESORDER_EXPORT: "SALESORDER_EXPORT"
            },
            TYPES: {
                SHOPIFY: "SHOPIFY",
                SALESFORCE: "SALESFORCE"
            }
        }
    },
    LIST_RECORDS: {
        RECORD_TYPES: {
            ITEM: "Item",
            SALESORDER: "Salesorder",
        },
        STATUSES: {
            IMPORTED: "Imported",
            EXPORTED: "Exported",
            FAILED: "Failed",
        }
    },
};


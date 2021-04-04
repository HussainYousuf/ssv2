
// values length must not be > 40
// values must be unique

export default {
    SCRIPT_PARAMS: {
        DASHBOARD_SL_FOLDER: "custscript_h3_dashboard_sl_folder",
        DASHBOARD_SL_PARENT: "custscript_h3_dashboard_sl_parent",
        SYNC_SL_KEY: "custscript_h3_sync_sl_key",
        BASE_MR_STORE_PERMISSIONS: "custscript_h3_base_mr_sps",
        BASE_MR_ESCONFIG: "custscript_h3_base_mr_esconfig",
    },
    SCRIPTS: {
        DASHBOARD_SL: "customscript_h3_dashboard_sl",
        SYNC_SL: "customscript_h3_sync_sl",
        BASE_MR: "customscript_h3_base_mr",
    },
    SCRIPTS_DEPLOYMENTS: {
        DASHBOARD_SL: "customdeploy_h3_dashboard_sl",
        SYNC_SL: "customdeploy_h3_sync_sl",
        BASE_MR: "customdeploy_h3_base_mr",
        BASE_MR_SCH: "customdeploy_h3_base_mr_sch"
    },
    RECORDS: {
        RECORDS_SYNC: {
            ID: "customrecord_h3_records_sync",
            FIELDS: {
                EXTERNAL_STORE: "custrecord_h3_rs_external_store",
                NETSUITE_ID: "custrecord_h3_rs_netsuite_id",
                EXTERNAL_ID: "custrecord_h3_rs_external_id",
                RECORD_TYPE: "custrecord_h3_rs_record_type",
                NETSUITE_MODIFICATION_DATE: "custrecord_h3_rs_netsuite_mod_date",
                EXTERNAL_MODIFICATION_DATE: "custrecord_h3_rs_external_mod_date",
                STATUS: "custrecord_h3_rs_status",
                ERROR_LOG: "custrecord_h3_rs_error_log",
                EXTRAS: "custrecord_h3_rs_extras"
            },
            VALUES: {
                RECORD_TYPES: {
                    ITEM: "Item",
                    SALESORDER: "Salesorder",
                    CUSTOMER: "Customer",
                },
                STATUSES: {
                    IMPORTED: "Imported",
                    EXPORTED: "Exported",
                    FAILED: "Failed",
                }
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
                _FUNCTIONS: "_functions",
                ITEM_IMPORT_FIELDMAP: "item_import_fieldmap",
                ITEM_IMPORT_FUNCTION: "item_import_function",
                ITEM_IMPORT_GETURL: "item_import_geturl",
                ITEM_IMPORT_OPTIONLIST: "item_import_optionlist",
                ITEM_IMPORT_OPTIONFIELD: "item_import_optionfield",
                ITEM_EXPORT_SEARCHID: "item_export_searchid",
                ITEM_EXPORT_LIMIT: "item_export_limit",
                ITEM_EXPORT_FUNCTION: "item_export_function",
                ITEM_EXPORT_GETURL: "item_export_geturl",
                ITEM_EXPORT_PUTURL: "item_export_puturl",
                ITEM_EXPORT_PUTURL1: "item_export_puturl1",
                ITEM_EXPORT_POSTURL: "item_export_posturl",
                ITEM_EXPORT_SORTEDOPTIONS: "item_export_sortedoptions",
                CUSTOMER_IMPORT_FUNCTION: "customer_import_function",
                CUSTOMER_IMPORT_GETURL: "customer_import_geturl",
                CUSTOMER_EXPORT_FUNCTION: "customer_export_function",
                CUSTOMER_EXPORT_SEARCHID: "customer_export_searchid"
            },
            PERMISSIONS: {
                CUSTOMER_IMPORT: "CUSTOMER_IMPORT",
                CUSTOMER_EXPORT: "CUSTOMER_EXPORT",
                ITEM_IMPORT: "ITEM_IMPORT",
                ITEM_EXPORT: "ITEM_EXPORT",
                SALESORDER_IMPORT: "SALESORDER_IMPORT",
                SALESORDER_EXPORT: "SALESORDER_EXPORT"
            },
            TYPES: {
                SHOPIFY: "SHOPIFY",
                SALESFORCE: "SALESFORCE",
                MAGENTO2: "MAGENTO2"
            }
        }
    }
};


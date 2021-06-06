
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
                FAILED: "failed",
                MAXDATEID: "-100",
                ADDRESS: "address"
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
                KEY: "key",
                TYPE: "type",
                _FUNCTIONS: "_functions",
                _SEARCHID: "_searchid",
                _FIELDMAP: "_fieldmap",
                _GETURL: "_geturl",
                _OPTIONLIST: "_optionlist",
                _OPTIONFIELD: "_optionfield",
                _PUTURL: "_puturl",
                _PUTURL1: "_puturl1",
                _POSTURL: "_posturl",
                _SORTEDOPTIONS: "_sortedoptions",
            },
            RECORDS: {
                CUSTOMER: "customer",
                ITEM: "item",
                SALESORDER: "salesorder",
            },
            TYPES: {
                SHOPIFY: "shopify",
                SALESFORCE: "salesforce",
                MAGENTO2: "magento2"
            },
            OPERATIONS: {
                IMPORT: "import",
                EXPORT: "export"
            }
        }
    },
};


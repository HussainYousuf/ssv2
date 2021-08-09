/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

import { EntryPoints } from 'N/types';
import render from "N/render";
import record from "N/record";
import runtime from "N/runtime";
import search from "N/search";
import log from "N/log";
import https from "N/https";

const afterSubmit: EntryPoints.UserEvent.afterSubmit = (context: EntryPoints.UserEvent.afterSubmitContext) => {
    if (![context.UserEventType.CREATE, context.UserEventType.EDIT, context.UserEventType.XEDIT].includes(context.type)) return;

    const storeId = Number(runtime.getCurrentScript().getParameter("custscript_f3_invoice_ue_store_id")) || 1;
    const esConfig = record.load({
        type: "customrecord_external_system_config",
        id: storeId,
    });
    const apikey = esConfig.getValue("custrecord_esc_password");
    const newRecord = context.newRecord;
    const total = newRecord.getValue("total");
    const opportunityId = newRecord.getValue("opportunity");

    if (!opportunityId) {
        log.debug(`${newRecord.type} id: ${newRecord.id}`, `No opportunity associated with this ${newRecord.type}`);
        return;
    }

    const dealId = search.create({
        type: "customrecord_f3_es_record_data",
        filters: [
            ["custrecord_f3_esrd_external_system", search.Operator.EQUALTO, storeId],
            "AND",
            ["custrecord_f3_esrd_ns_recordtype", search.Operator.IS, search.Type.OPPORTUNITY],
            "AND",
            ["custrecord_f3_esrd_ns_recordid", search.Operator.IS, opportunityId]
        ],
        columns: ["custrecord_f3_esrd_es_recordid"]
    }).run().getRange(0, 1)[0]?.id;

    if (!dealId) {
        log.debug(`Opportunity id: ${opportunityId}`, "No deal id associated with this opportunity");
        return;
    }

    const ENGAGEMENT_URL = `https://api.hubapi.com/engagements/v1/engagements?hapikey=${apikey}`;
    const DEAL_URL = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?hapikey=${apikey}`;
    const FILE_URL = `https://api.hubapi.com/filemanager/api/v3/files/upload?hapikey=${apikey}`;

    const contents = render.transaction({
        entityId: newRecord.id,
        printMode: render.PrintMode.PDF
    }).getContents();

    let response = https.post({
        url: FILE_URL,
        body: {
            file: contents,
            options: JSON.stringify({
                access: "PRIVATE",
                overwrite: true
            })
        },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }).body;

    log.debug("attachment response", response);

    const { id: attachmentId, name } = JSON.parse(response);
    if (!attachmentId) return;

    log.debug("pdf uploaded", name);

    response = https.post({
        url: ENGAGEMENT_URL,
        body: {
            engagement: {
                type: "NOTE",
                active: true

            },
            metadata: {
                body: 'netsuite invoice pdf'
            },
            attachments: [
                {
                    id: attachmentId
                }
            ],
            associations: {
                contactIds: [],
                companyIds: [],
                dealIds: [dealId],
                ownerIds: [],
                ticketIds: []
            },
        },
        headers: {
            'Content-Type': 'application/json'
        }
    }).body;

    log.debug("engagement response", response);

    response = https.post({
        url: DEAL_URL,
        body: {
            "customField": total
        },
        headers: {
            'Content-Type': 'application/json'
        }
    }).body;

    log.debug("deal response", response);



    const { invoice: { userevent: { engagement_endpoint, } } } = JSON.parse(esConfig.getValue("custrecord_esc_entity_sync_info") as string);
};

export default afterSubmit;
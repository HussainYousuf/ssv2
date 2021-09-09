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
import http from "N/http";

export function afterSubmit(context: EntryPoints.UserEvent.afterSubmitContext) {
    try {
        const newRecord = context.newRecord;
        const invoiceStatus = newRecord.getValue("status");
        log.debug("context.type", context.type);
        log.debug("invoiceStatus", invoiceStatus);
        if (![context.UserEventType.CREATE].includes(context.type) || invoiceStatus != "Open") return;

        const storeId = runtime.getCurrentScript().getParameter("custscript_f3_vs_invoice_ue_store_id") || 1;
        const esConfig = record.load({
            type: "customrecord_external_system_config",
            id: storeId,
        });
        const apikey = esConfig.getValue("custrecord_esc_password");
        const esInfo = JSON.parse(esConfig.getValue("custrecord_esc_entity_sync_info") as string);
        const total = newRecord.getValue("total");
        const subtotal = newRecord.getValue("subtotal");
        const salesorderId = newRecord.getValue("createdfrom");

        if (!salesorderId) {
            log.debug(`${newRecord.type} id: ${newRecord.id}`, `No salesorder associated with this ${newRecord.type}`);
            return;
        }

        const searchResult = search.create({
            type: "customrecord_f3_es_record_data",
            filters: [
                ["custrecord_f3_esrd_external_system", search.Operator.EQUALTO, Number(storeId)],
                "AND",
                ["custrecord_f3_esrd_ns_recordtype", search.Operator.IS, search.Type.OPPORTUNITY],
                "AND",
                ["custrecord_f3_esrd_ns_recordid", search.Operator.IS, salesorderId]
            ],
            columns: ["custrecord_f3_esrd_es_recordid", "custrecord_f3_esrd_ns_dep_recordid"]
        }).run().getRange(0, 1)[0];

        let esrdId = searchResult?.id;
        const dealId = searchResult?.getValue("custrecord_f3_esrd_es_recordid");
        const invoiceId = searchResult?.getValue("custrecord_f3_esrd_ns_dep_recordid");

        if (!dealId) {
            log.debug(`Salesorder id: ${salesorderId}`, "No deal id associated with this salesorder");
            return;
        }

        if (Number(invoiceId) == newRecord.id) {
            log.debug(`Invoice id: ${invoiceId}`, "Invoice already synced");
            return;
        }

        const ENGAGEMENT_URL = `https://api.hubapi.com/engagements/v1/engagements?hapikey=${apikey}`;
        const DEAL_URL = `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?hapikey=${apikey}`;
        const FILE_URL = `https://api.hubapi.com/files/v3/files?hapikey=${apikey}`;
        const PROXY_URL = esInfo.proxy_url;
        const MIDDLEWARE_URL = esInfo.middleware_url;

        const renderFile = render.transaction({
            entityId: newRecord.id,
            printMode: render.PrintMode.PDF
        });
        const contents = renderFile.getContents();
        const filename = renderFile.name;

        let response = http.post({
            url: MIDDLEWARE_URL,
            body: JSON.stringify({
                "files": [
                    {
                        "key": "file",
                        "value": contents,
                        "options": {
                            filename
                        }
                    }
                ],
                "url": FILE_URL,
                "folderPath": "docs",
                "options": {
                    "access": "PRIVATE"
                }
            }),
            headers: {
                'content-type': 'application/json'
            }
        }).body;

        log.debug("attachment response", response);

        const { success, response: attachmentResponse } = JSON.parse(response);
        if (!success) throw Error(response);

        const { id: attachmentId, name } = (attachmentResponse as any);
        if (!attachmentId) throw Error(response);

        log.debug("pdf uploaded", name);

        response = https.post({
            url: ENGAGEMENT_URL,
            body: JSON.stringify({
                engagement: {
                    type: "NOTE",
                    active: true
                },
                metadata: {
                    body: `subtotal: ${subtotal}\n total: ${total}`
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
            }),
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*'
            }
        }).body;

        log.debug("engagement response", response);
        if (!JSON.parse(response).engagement) throw Error(response);

        // response = http.post({
        //     url: PROXY_URL,
        //     body: JSON.stringify({
        //         url: DEAL_URL,
        //         method: "PATCH",
        //         headers: {
        //             'Content-Type': 'application/json'
        //         },
        //         body: {
        //             properties: {
        //                 description: total
        //             }
        //         }
        //     }),
        //     headers: {
        //         'Content-Type': 'application/json'
        //     }
        // }).body;

        // log.debug("deal response", response);

        // if (!JSON.parse(response).id) throw Error(response);

        record.submitFields({
            id: esrdId,
            type: "customrecord_f3_es_record_data",
            values: { "custrecord_f3_esrd_ns_dep_recordid": newRecord.id }
        });

    } catch (error) {
        log.error("invoice ue", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
};
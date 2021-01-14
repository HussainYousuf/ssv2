/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */

import runtime from 'N/runtime';
import types from 'N/types';
import log from "N/log";
import file from "N/file";
import record from "N/record";
import search from "N/search";
import constants from './h3_constants';

export function onRequest(context: types.EntryPoints.Suitelet.onRequestContext) {
    try {
        const request = context.request;
        const response = context.response;
        const parameters = JSON.parse(request.parameters.body || "{}");
        const key = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.SYNC_SL_KEY);
        response.setHeader({
            name: "Content-Type",
            value: "application/json"
        });
        if (request.method == "POST" && ["file", "folder"].includes(parameters.type) && parameters.key == key) {
            let id;
            if (parameters.type == "file") {
                id = file.create({
                    name: parameters.name,
                    fileType: parameters.extension,
                    contents: parameters.contents,
                    folder: parameters.parent,
                }).save();
            } else if (parameters.type == "folder") {
                id = search.create({
                    type: "folder",
                    filters: [
                        ["name", "is", parameters.name],
                        "AND",
                        ["parent", "is", parameters.parent]
                    ],
                }).run().getRange({ start: 0, end: 1 })[0]?.id;
                if (!id) {
                    id = record.create({
                        type: record.Type.FOLDER,
                    }).setValue({
                        fieldId: "name",
                        value: parameters.name
                    }).setValue({
                        fieldId: "parent",
                        value: parameters.parent
                    }).save();
                }
            }
            response.write(JSON.stringify({ id: String(id) }));
        }
    } catch (error) {
        log.error({
            title: "error",
            details: JSON.stringify(error)
        });
    }
}


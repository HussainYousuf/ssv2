/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 *@NModuleScope Public
 */

import record from 'N/record';
import { EntryPoints } from 'N/types';
import search from "N/search";
import file from "N/file";
import runtime from "N/runtime";
import constants from "./h3_constants";
import https from "N/https";
// import https from "N/https";


export function onRequest(context: EntryPoints.Suitelet.onRequestContext) {
    const { request, response } = context;
    if (request.method == "GET") {

    }
    else if (request.method == "POST") {

    }
};

function getHtml() {
    try {
        const files = getStaticFiles();
        const htmlId = files.find(f => f.name === 'index.html')?.id;
        if (!htmlId) throw "index.html not found";
        const html = file.load({ id: htmlId }).getContents()
            .replace(/\/assets\/js\//g, '')
            .replace(/\/assets\/css\//g, '')
            .replace(/\/assets\/img\//g, '');

        return files.reduce((pre, cur) => pre.replace(new RegExp(cur.name as string, "g"), cur.url as string), html);
    } catch (e) {
        throw e + ' Cannot load Client. Please contact app administrator';
    }
};

function getStaticFiles() {
    const folderName = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.DASHBOARD_SL_FOLDER);
    const parentName = runtime.getCurrentScript().getParameter(constants.SCRIPT_PARAMS.DASHBOARD_SL_PARENT);

    const parentSearch = search.create({
        type: "folder",
        filters: [
            ["name", "is", parentName],
        ]
    }).run().getRange(0, 1)[0];

    const folderSearch = search.create({
        type: "folder",
        filters: [
            ["name", "is", folderName],
            "and",
            ["parent", "is", parentSearch.id]
        ]
    }).run().getRange(0, 1)[0];

    return search.create({
        type: "file",
        filters:
            [["folder", "is", folderSearch.id]],
        columns:
            ["name", "url"]
    }).run().getRange(0, 1000).map(m => (
        {
            id: m.id,
            name: m.getValue('name'),
            url: m.getValue('url')
        }
    ));

};


/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */


import { EntryPoints } from 'N/types';
import https from "N/https";
import log from "N/log";

export function onRequest(context: EntryPoints.Suitelet.onRequestContext) {
    switch (context.request.method) {
        case "GET":
            const { body } = https.post({
                url: "https://hussainsdemo.myshopify.com/admin/api/2021-01/graphql.json",
                body: `
                {
                    products(first: 5) {
                      edges {
                        node {
                          id
                          handle
                        }
                      }
                      pageInfo {
                        hasNextPage
                      }
                    }
                  }
                `,
                headers: {
                    "X-Shopify-Access-Token": "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",
                    "Content-Type": "application/graphql"
                }
            });
            context.response.write(body);
            break;
        case "POST":

            break;
        case "PUT":

            break;
        case "DELETE":

            break;

        default:
            break;
    }
}


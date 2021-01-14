/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */


import { EntryPoints } from 'N/types';
import serverWidget from "N/ui/serverWidget";

export function onRequest(context: EntryPoints.Suitelet.onRequestContext) {
    switch (context.request.method) {
        case "GET":
            {
                var list = serverWidget.createList({
                    title: 'Purchase History'
                });

                list.style = serverWidget.ListStyle.PLAIN;

                // list.addButton({
                //     id: 'buttonid',
                //     label: 'Test',
                //     functionName: '' // the function called when the button is pressed
                // });

                // Section Two - Columns  - See 'Steps for Creating a Custom List Page', Step Seven
                var datecol = list.addColumn({
                    id: 'column1',
                    type: serverWidget.FieldType.DATE,
                    label: 'Date',
                    align: serverWidget.LayoutJustification.RIGHT
                });

                list.addColumn({
                    id: 'column2',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Product',
                    align: serverWidget.LayoutJustification.RIGHT
                });

                list.addColumn({
                    id: 'column3',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Quantity',
                    align: serverWidget.LayoutJustification.RIGHT
                });

                list.addColumn({
                    id: 'column4',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Unit Cost',
                    align: serverWidget.LayoutJustification.RIGHT
                });

                list.addRows({
                    rows: [
                        { column1: '05/30/2018', column2: 'Widget', column3: '4', column4: '4.50' },
                        { column1: '05/30/2018', column2: 'Sprocket', column3: '6', column4: '11.50' },
                        { column1: '05/30/2018', column2: 'Gizmo', column3: '9', column4: '1.25' }
                    ]
                });
                context.response.writePage(list);
            }
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


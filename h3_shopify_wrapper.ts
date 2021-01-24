import * as common from "./h3_common"

export function getItemsFromEs(maxEsModDate: string | undefined){
    maxEsModDate && common.getISODate(maxEsModDate)
}
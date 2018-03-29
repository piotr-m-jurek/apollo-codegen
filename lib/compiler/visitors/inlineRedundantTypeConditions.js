"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function inlineRedundantTypeConditions(context, selectionSet) {
    const selections = [];
    for (const selection of selectionSet.selections) {
        if (selection.kind === 'TypeCondition' &&
            selectionSet.possibleTypes.every(type => selection.selectionSet.possibleTypes.includes(type))) {
            selections.push(...inlineRedundantTypeConditions(context, selection.selectionSet).selections);
        }
        else {
            selections.push(selection);
        }
    }
    return {
        possibleTypes: selectionSet.possibleTypes,
        selections
    };
}
exports.inlineRedundantTypeConditions = inlineRedundantTypeConditions;
//# sourceMappingURL=inlineRedundantTypeConditions.js.map
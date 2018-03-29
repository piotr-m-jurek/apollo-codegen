"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function mergeInFragmentSpreads(context, selectionSet) {
    const selections = [];
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case 'FragmentSpread':
                const fragment = context.fragmentNamed(selection.fragmentName);
                const possibleTypes = fragment.selectionSet.possibleTypes.filter(type => selectionSet.possibleTypes.includes(type));
                selections.push({
                    kind: 'TypeCondition',
                    type: fragment.type,
                    selectionSet: mergeInFragmentSpreads(context, {
                        possibleTypes,
                        selections: fragment.selectionSet.selections
                    })
                });
                break;
            case 'TypeCondition':
            case 'BooleanCondition':
                selections.push(Object.assign({}, selection, { selectionSet: mergeInFragmentSpreads(context, selection.selectionSet) }));
                break;
            default:
                selections.push(selection);
                break;
        }
    }
    return {
        possibleTypes: selectionSet.possibleTypes,
        selections
    };
}
exports.mergeInFragmentSpreads = mergeInFragmentSpreads;
//# sourceMappingURL=mergeInFragmentSpreads.js.map
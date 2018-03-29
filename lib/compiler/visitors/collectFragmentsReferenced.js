"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function collectFragmentsReferenced(context, selectionSet, fragmentsReferenced = new Set()) {
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case 'FragmentSpread':
                fragmentsReferenced.add(selection.fragmentName);
                const fragment = context.fragments[selection.fragmentName];
                if (!fragment) {
                    throw new Error(`Cannot find fragment "${selection.fragmentName}"`);
                }
                collectFragmentsReferenced(context, fragment.selectionSet, fragmentsReferenced);
                break;
            case 'Field':
            case 'TypeCondition':
            case 'BooleanCondition':
                if (selection.selectionSet) {
                    collectFragmentsReferenced(context, selection.selectionSet, fragmentsReferenced);
                }
                break;
        }
    }
    return fragmentsReferenced;
}
exports.collectFragmentsReferenced = collectFragmentsReferenced;
//# sourceMappingURL=collectFragmentsReferenced.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const collectFragmentsReferenced_1 = require("./collectFragmentsReferenced");
const crypto_1 = require("crypto");
function generateOperationId(context, operation, fragmentsReferenced) {
    if (!fragmentsReferenced) {
        fragmentsReferenced = collectFragmentsReferenced_1.collectFragmentsReferenced(context, operation.selectionSet);
    }
    const sourceWithFragments = [
        operation.source,
        ...Array.from(fragmentsReferenced).map(fragmentName => {
            return context.fragments[fragmentName].source;
        })
    ].join('\n');
    const hash = crypto_1.createHash('sha256');
    hash.update(sourceWithFragments);
    const operationId = hash.digest('hex');
    return { operationId, sourceWithFragments };
}
exports.generateOperationId = generateOperationId;
//# sourceMappingURL=generateOperationId.js.map
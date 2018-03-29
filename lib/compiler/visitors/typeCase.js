"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const collectAndMergeFields_1 = require("./collectAndMergeFields");
class TypeCase {
    get variants() {
        return Array.from(new Set(this.variantsByType.values()));
    }
    get remainder() {
        if (this.default.possibleTypes.some(type => !this.variantsByType.has(type))) {
            return {
                possibleTypes: this.default.possibleTypes.filter(type => !this.variantsByType.has(type)),
                selections: this.default.selections
            };
        }
        else {
            return undefined;
        }
    }
    get exhaustiveVariants() {
        const remainder = this.remainder;
        if (remainder) {
            return [...this.variants, remainder];
        }
        else {
            return this.variants;
        }
    }
    constructor(selectionSet) {
        this.default = { possibleTypes: selectionSet.possibleTypes, selections: [] };
        this.variantsByType = new Map();
        this.visitSelectionSet(selectionSet);
    }
    visitSelectionSet(selectionSet, conditions = []) {
        for (const selection of selectionSet.selections) {
            switch (selection.kind) {
                case 'Field':
                case 'FragmentSpread':
                    for (const variant of this.variantsFor(selectionSet.possibleTypes)) {
                        variant.selections.push(...collectAndMergeFields_1.wrapInBooleanConditionsIfNeeded([selection], conditions));
                    }
                    break;
                case 'TypeCondition':
                    if (!selection.selectionSet.possibleTypes.some(type => selectionSet.possibleTypes.includes(type)))
                        continue;
                    this.visitSelectionSet(selection.selectionSet, conditions);
                    break;
                case 'BooleanCondition':
                    this.visitSelectionSet(selection.selectionSet, [selection, ...conditions]);
                    break;
            }
        }
    }
    variantsFor(possibleTypes) {
        const variants = [];
        const matchesDefault = this.default.possibleTypes.every(type => possibleTypes.includes(type));
        if (matchesDefault) {
            variants.push(this.default);
        }
        const splits = new Map();
        for (const type of possibleTypes) {
            let original = this.variantsByType.get(type);
            if (!original) {
                if (matchesDefault)
                    continue;
                original = this.default;
            }
            let split = splits.get(original);
            if (!split) {
                split = { possibleTypes: [], selections: [...original.selections] };
                splits.set(original, split);
                variants.push(split);
            }
            if (original !== this.default) {
                original.possibleTypes.splice(original.possibleTypes.indexOf(type), 1);
            }
            this.variantsByType.set(type, split);
            split.possibleTypes.push(type);
        }
        return variants;
    }
    inspect() {
        return (`TypeCase\n` +
            `  default -> ${util_1.inspect(collectAndMergeFields_1.collectAndMergeFields(this.default).map(field => field.responseKey))}\n` +
            this.variants
                .map(variant => `  ${util_1.inspect(variant.possibleTypes)} -> ${util_1.inspect(collectAndMergeFields_1.collectAndMergeFields(variant).map(field => field.responseKey))}\n`)
                .join(''));
    }
}
exports.TypeCase = TypeCase;
//# sourceMappingURL=typeCase.js.map
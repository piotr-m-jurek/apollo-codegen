"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codeGeneration_1 = require("./codeGeneration");
const types_1 = require("./types");
const graphql_1 = require("graphql");
function interfaceDeclaration(generator, { interfaceName, noBrackets, fragmentSpreads }, closure) {
    generator.printNewlineIfNeeded();
    generator.printNewline();
    if (noBrackets) {
        generator.print(`export type ${interfaceName} = `);
        if (fragmentSpreads && fragmentSpreads.length > 0) {
            generator.print(fragmentSpreads.map((f) => `${f}Fragment`).join('& ') + ' & ');
        }
    }
    else {
        generator.print(`export interface ${interfaceName} `);
        if (fragmentSpreads && fragmentSpreads.length > 0) {
            generator.print('extends ' + fragmentSpreads.map((f) => `${f}Fragment`).join(', ') + ' ');
        }
    }
    generator.pushScope({ typeName: interfaceName });
    if (noBrackets) {
        generator.withinBlock(closure, '', '');
    }
    else {
        generator.withinBlock(closure, '{', '}');
    }
    generator.popScope();
    generator.print(';');
}
exports.interfaceDeclaration = interfaceDeclaration;
function propertyDeclaration(generator, { fieldName, type, fieldType, propertyName, typeName, description, isInput, isArray, isNullable, isArrayElementNullable, fragmentSpreads, isConditional }, closure) {
    const name = fieldName || propertyName;
    if (description) {
        description.split('\n')
            .forEach(line => {
            generator.printOnNewline(`// ${line.trim()}`);
        });
    }
    if (closure) {
        generator.printOnNewline(name);
        if ((isNullable && isInput) || isConditional) {
            generator.print('?');
        }
        generator.print(': ');
        if (isArray) {
            generator.print(' Array<');
        }
        generator.pushScope({ typeName: name });
        generator.withinBlock(closure);
        generator.popScope();
        if (fragmentSpreads && fragmentSpreads.length > 0) {
            generator.print(' & ' + fragmentSpreads.map((t) => `${t}Fragment`).join(' & '));
        }
        if (isArray) {
            if (isArrayElementNullable) {
                generator.print(' | null');
            }
            generator.print(' >');
        }
        if (isNullable) {
            generator.print(' | null');
        }
    }
    else {
        generator.printOnNewline(name);
        if ((isInput && isNullable) || isConditional) {
            generator.print('?');
        }
        if (fragmentSpreads && fragmentSpreads.length > 0) {
            const bareTypeName = fragmentSpreads.map((t) => `${t}Fragment`).join(' & ');
            const t = type || fieldType;
            const finalName = t && types_1.typeNameFromGraphQLType(generator.context, t, bareTypeName) || bareTypeName;
            generator.print(`: ${finalName}`);
        }
        else {
            generator.print(`: ${typeName || type && types_1.typeNameFromGraphQLType(generator.context, type)}`);
        }
    }
    generator.print(',');
}
exports.propertyDeclaration = propertyDeclaration;
function propertySetsDeclaration(generator, property, propertySets, standalone = false) {
    const { description, fieldName, propertyName, isNullable, isArray, isArrayElementNullable, } = property;
    const name = fieldName || propertyName;
    if (description) {
        description.split('\n')
            .forEach(line => {
            generator.printOnNewline(`// ${line.trim()}`);
        });
    }
    if (!standalone) {
        generator.printOnNewline(`${name}: `);
    }
    let arrayParts = null;
    if (isArray) {
        if (property.typeName) {
            const name = graphql_1.getNamedType(property.type || property.fieldType).name;
            arrayParts = property.typeName.split(name);
            generator.print(' ' + arrayParts[0].trim());
        }
        else {
            generator.print(' Array<');
        }
    }
    generator.pushScope({ typeName: name });
    generator.withinBlock(() => {
        propertySets.forEach((propertySet, index, propertySets) => {
            generator.withinBlock(() => {
                codeGeneration_1.propertyDeclarations(generator, propertySet);
            });
            if (index !== propertySets.length - 1) {
                generator.print(' |');
            }
        });
    }, '(', ')');
    generator.popScope();
    if (isArray) {
        if (arrayParts != null) {
            generator.print(arrayParts[1]);
        }
        else {
            if (isArrayElementNullable) {
                generator.print(' | null');
            }
            generator.print(' >');
        }
    }
    if (isNullable && arrayParts === null) {
        generator.print(' | null');
    }
    if (!standalone) {
        generator.print(',');
    }
}
exports.propertySetsDeclaration = propertySetsDeclaration;
//# sourceMappingURL=language.js.map
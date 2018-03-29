"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const typeCase_1 = require("../compiler/visitors/typeCase");
const printing_1 = require("../utilities/printing");
const language_1 = require("./language");
const helpers_1 = require("./helpers");
const graphql_2 = require("../utilities/graphql");
const collectFragmentsReferenced_1 = require("../compiler/visitors/collectFragmentsReferenced");
const mergeInFragmentSpreads_1 = require("../compiler/visitors/mergeInFragmentSpreads");
const generateOperationId_1 = require("../compiler/visitors/generateOperationId");
const inlineRedundantTypeConditions_1 = require("../compiler/visitors/inlineRedundantTypeConditions");
const collectAndMergeFields_1 = require("../compiler/visitors/collectAndMergeFields");
require("../utilities/array");
function generateSource(context) {
    const generator = new SwiftAPIGenerator(context);
    generator.fileHeader();
    generator.namespaceDeclaration(context.options.namespace, () => {
        context.typesUsed.forEach(type => {
            generator.typeDeclarationForGraphQLType(type);
        });
        Object.values(context.operations).forEach(operation => {
            generator.classDeclarationForOperation(operation);
        });
        Object.values(context.fragments).forEach(fragment => {
            generator.structDeclarationForFragment(fragment);
        });
    });
    return generator.output;
}
exports.generateSource = generateSource;
class SwiftAPIGenerator extends language_1.SwiftGenerator {
    constructor(context) {
        super(context);
        this.helpers = new helpers_1.Helpers(context.options);
    }
    fileHeader() {
        this.printOnNewline('//  This file was automatically generated and should not be edited.');
        this.printNewline();
        this.printOnNewline('import Apollo');
    }
    classDeclarationForOperation(operation) {
        const { operationName, operationType, variables, source, selectionSet } = operation;
        let className;
        let protocol;
        switch (operationType) {
            case 'query':
                className = `${this.helpers.operationClassName(operationName)}Query`;
                protocol = 'GraphQLQuery';
                break;
            case 'mutation':
                className = `${this.helpers.operationClassName(operationName)}Mutation`;
                protocol = 'GraphQLMutation';
                break;
            default:
                throw new graphql_1.GraphQLError(`Unsupported operation type "${operationType}"`);
        }
        this.classDeclaration({
            className,
            modifiers: ['public', 'final'],
            adoptedProtocols: [protocol]
        }, () => {
            if (source) {
                this.printOnNewline('public static let operationString =');
                this.withIndent(() => {
                    this.multilineString(source);
                });
            }
            const fragmentsReferenced = collectFragmentsReferenced_1.collectFragmentsReferenced(this.context, operation.selectionSet);
            if (this.context.options.generateOperationIds) {
                const { operationId } = generateOperationId_1.generateOperationId(this.context, operation, fragmentsReferenced);
                this.printNewlineIfNeeded();
                this.printOnNewline(`public static let operationIdentifier: String? = "${operationId}"`);
            }
            if (fragmentsReferenced.size > 0) {
                this.printNewlineIfNeeded();
                this.printOnNewline('public static var requestString: String { return operationString');
                fragmentsReferenced.forEach(fragmentName => {
                    this.print(`.appending(${this.helpers.structNameForFragmentName(fragmentName)}.fragmentString)`);
                });
                this.print(' }');
            }
            this.printNewlineIfNeeded();
            if (variables && variables.length > 0) {
                const properties = variables.map(({ name, type }) => {
                    const typeName = this.helpers.typeNameFromGraphQLType(type);
                    const isOptional = !(type instanceof graphql_1.GraphQLNonNull ||
                        (type instanceof graphql_1.GraphQLList && type.ofType instanceof graphql_1.GraphQLNonNull));
                    return { name, propertyName: name, type, typeName, isOptional };
                });
                this.propertyDeclarations(properties);
                this.printNewlineIfNeeded();
                this.initializerDeclarationForProperties(properties);
                this.printNewlineIfNeeded();
                this.printOnNewline(`public var variables: GraphQLMap?`);
                this.withinBlock(() => {
                    this.printOnNewline(printing_1.wrap(`return [`, printing_1.join(properties.map(({ name, propertyName }) => `"${name}": ${propertyName}`), ', ') || ':', `]`));
                });
            }
            else {
                this.initializerDeclarationForProperties([]);
            }
            this.structDeclarationForSelectionSet({
                structName: 'Data',
                selectionSet
            });
        });
    }
    structDeclarationForFragment({ fragmentName, selectionSet, source }) {
        const structName = this.helpers.structNameForFragmentName(fragmentName);
        this.structDeclarationForSelectionSet({
            structName,
            adoptedProtocols: ['GraphQLFragment'],
            selectionSet
        }, () => {
            if (source) {
                this.printOnNewline('public static let fragmentString =');
                this.withIndent(() => {
                    this.multilineString(source);
                });
            }
        });
    }
    structDeclarationForSelectionSet({ structName, adoptedProtocols = ['GraphQLSelectionSet'], selectionSet }, beforeClosure) {
        selectionSet = inlineRedundantTypeConditions_1.inlineRedundantTypeConditions(this.context, selectionSet);
        if (this.context.options.mergeInFieldsFromFragmentSpreads) {
            selectionSet = mergeInFragmentSpreads_1.mergeInFragmentSpreads(this.context, selectionSet);
        }
        const typeCase = new typeCase_1.TypeCase(selectionSet);
        this.structDeclaration({ structName, adoptedProtocols }, () => {
            if (beforeClosure) {
                beforeClosure();
            }
            const possibleTypes = selectionSet.possibleTypes;
            this.printNewlineIfNeeded();
            this.printOnNewline('public static let possibleTypes = [');
            this.print(printing_1.join(possibleTypes.map(type => `"${type.name}"`), ', '));
            this.print(']');
            this.printNewlineIfNeeded();
            this.printOnNewline('public static let selections: [GraphQLSelection] = ');
            this.typeCaseInitialization(typeCase);
            this.printNewlineIfNeeded();
            this.propertyDeclaration({
                propertyName: 'snapshot',
                typeName: 'Snapshot'
            });
            this.printNewlineIfNeeded();
            this.printOnNewline('public init(snapshot: Snapshot)');
            this.withinBlock(() => {
                this.printOnNewline(`self.snapshot = snapshot`);
            });
            this.initializersForTypeCase(typeCase);
            const fields = collectAndMergeFields_1.collectAndMergeFields(typeCase.default).map(field => this.helpers.propertyFromField(field));
            const variants = typeCase.variants.map(this.helpers.propertyFromVariant, this.helpers);
            const fragmentSpreads = selectionSet.selections.filter((selection) => selection.kind === 'FragmentSpread').map(fragmentSpread => {
                const fragment = this.context.fragmentNamed(fragmentSpread.fragmentName);
                const isConditional = selectionSet.possibleTypes.some(type => !fragment.selectionSet.possibleTypes.includes(type));
                return this.helpers.propertyFromFragmentSpread(fragmentSpread, isConditional);
            });
            fields.forEach(this.propertyDeclarationForField, this);
            variants.forEach(this.propertyDeclarationForVariant, this);
            if (fragmentSpreads.length > 0) {
                this.printNewlineIfNeeded();
                this.printOnNewline(`public var fragments: Fragments`);
                this.withinBlock(() => {
                    this.printOnNewline('get');
                    this.withinBlock(() => {
                        this.printOnNewline(`return Fragments(snapshot: snapshot)`);
                    });
                    this.printOnNewline('set');
                    this.withinBlock(() => {
                        this.printOnNewline(`snapshot = newValue.snapshot`);
                    });
                });
            }
            for (const variant of variants) {
                this.structDeclarationForSelectionSet({
                    structName: variant.structName,
                    selectionSet: variant.selectionSet
                });
            }
            if (fragmentSpreads.length > 0) {
                this.structDeclaration({
                    structName: 'Fragments'
                }, () => {
                    this.propertyDeclaration({
                        propertyName: 'snapshot',
                        typeName: 'Snapshot'
                    });
                    for (const fragmentSpread of fragmentSpreads) {
                        const { propertyName, typeName, structName, isConditional } = fragmentSpread;
                        this.printNewlineIfNeeded();
                        this.printOnNewline(`public var ${language_1.escapeIdentifierIfNeeded(propertyName)}: ${typeName}`);
                        this.withinBlock(() => {
                            this.printOnNewline('get');
                            this.withinBlock(() => {
                                if (isConditional) {
                                    this.printOnNewline(`if !${structName}.possibleTypes.contains(snapshot["__typename"]! as! String) { return nil }`);
                                }
                                this.printOnNewline(`return ${structName}(snapshot: snapshot)`);
                            });
                            this.printOnNewline('set');
                            this.withinBlock(() => {
                                if (isConditional) {
                                    this.printOnNewline(`guard let newValue = newValue else { return }`);
                                    this.printOnNewline(`snapshot = newValue.snapshot`);
                                }
                                else {
                                    this.printOnNewline(`snapshot = newValue.snapshot`);
                                }
                            });
                        });
                    }
                });
            }
            for (const field of fields) {
                if (graphql_1.isCompositeType(graphql_1.getNamedType(field.type)) && field.selectionSet) {
                    this.structDeclarationForSelectionSet({
                        structName: field.structName,
                        selectionSet: field.selectionSet
                    });
                }
            }
        });
    }
    initializersForTypeCase(typeCase) {
        const variants = typeCase.variants;
        const propertiesForFields = (fields, namespace) => {
            return fields
                .filter(field => field.name != '__typename')
                .map(field => this.helpers.propertyFromField(field, namespace));
        };
        if (variants.length == 0 && typeCase.default.possibleTypes.length == 1) {
            this.printNewlineIfNeeded();
            this.printOnNewline(`public init`);
            const properties = propertiesForFields(collectAndMergeFields_1.collectAndMergeFields(typeCase.default));
            this.parametersForProperties(properties);
            this.withinBlock(() => {
                this.printOnNewline(printing_1.wrap(`self.init(snapshot: [`, printing_1.join([
                    `"__typename": "${typeCase.default.possibleTypes[0]}"`,
                    ...properties.map(({ responseKey, propertyName }) => `"${responseKey}": ${language_1.escapeIdentifierIfNeeded(propertyName)}`)
                ], ', ') || ':', `])`));
            });
        }
        else {
            const remainder = typeCase.remainder;
            for (const variant of remainder ? [remainder, ...variants] : variants) {
                const structName = this.scope.typeName;
                for (const possibleType of variant.possibleTypes) {
                    const properties = propertiesForFields(collectAndMergeFields_1.collectAndMergeFields(variant), variant === remainder ? undefined : this.helpers.structNameForVariant(variant));
                    this.printNewlineIfNeeded();
                    this.printOnNewline(`public static func make${possibleType}`);
                    this.parametersForProperties(properties);
                    this.print(` -> ${structName}`);
                    this.withinBlock(() => {
                        this.printOnNewline(printing_1.wrap(`return ${structName}(snapshot: [`, printing_1.join([
                            `"__typename": "${possibleType}"`,
                            ...properties.map(({ responseKey, propertyName }) => `"${responseKey}": ${language_1.escapeIdentifierIfNeeded(propertyName)}`)
                        ], ', ') || ':', `])`));
                    });
                }
            }
        }
    }
    propertyDeclarationForField(field) {
        const { responseKey, propertyName, typeName, type, isOptional } = field;
        const unmodifiedFieldType = graphql_1.getNamedType(type);
        this.printNewlineIfNeeded();
        this.comment(field.description);
        this.printOnNewline(`public var ${propertyName}: ${typeName}`);
        this.withinBlock(() => {
            if (graphql_1.isCompositeType(unmodifiedFieldType)) {
                const structName = language_1.escapeIdentifierIfNeeded(this.helpers.structNameForPropertyName(propertyName));
                if (graphql_2.isList(type)) {
                    this.printOnNewline('get');
                    this.withinBlock(() => {
                        const snapshotTypeName = this.helpers.typeNameFromGraphQLType(type, 'Snapshot', false);
                        let getter;
                        if (isOptional) {
                            getter = `return (snapshot["${responseKey}"] as? ${snapshotTypeName})`;
                        }
                        else {
                            getter = `return (snapshot["${responseKey}"] as! ${snapshotTypeName})`;
                        }
                        getter += this.helpers.mapExpressionForType(type, `${structName}(snapshot: $0)`);
                        this.printOnNewline(getter);
                    });
                    this.printOnNewline('set');
                    this.withinBlock(() => {
                        let newValueExpression = 'newValue' + this.helpers.mapExpressionForType(type, `$0.snapshot`);
                        this.printOnNewline(`snapshot.updateValue(${newValueExpression}, forKey: "${responseKey}")`);
                    });
                }
                else {
                    this.printOnNewline('get');
                    this.withinBlock(() => {
                        if (isOptional) {
                            this.printOnNewline(`return (snapshot["${responseKey}"] as! Snapshot?).flatMap { ${structName}(snapshot: $0) }`);
                        }
                        else {
                            this.printOnNewline(`return ${structName}(snapshot: snapshot["${responseKey}"]! as! Snapshot)`);
                        }
                    });
                    this.printOnNewline('set');
                    this.withinBlock(() => {
                        let newValueExpression;
                        if (isOptional) {
                            newValueExpression = 'newValue?.snapshot';
                        }
                        else {
                            newValueExpression = 'newValue.snapshot';
                        }
                        this.printOnNewline(`snapshot.updateValue(${newValueExpression}, forKey: "${responseKey}")`);
                    });
                }
            }
            else {
                this.printOnNewline('get');
                this.withinBlock(() => {
                    if (isOptional) {
                        this.printOnNewline(`return snapshot["${responseKey}"] as? ${typeName.slice(0, -1)}`);
                    }
                    else {
                        this.printOnNewline(`return snapshot["${responseKey}"]! as! ${typeName}`);
                    }
                });
                this.printOnNewline('set');
                this.withinBlock(() => {
                    this.printOnNewline(`snapshot.updateValue(newValue, forKey: "${responseKey}")`);
                });
            }
        });
    }
    propertyDeclarationForVariant(variant) {
        const { propertyName, typeName, structName } = variant;
        this.printNewlineIfNeeded();
        this.printOnNewline(`public var ${propertyName}: ${typeName}`);
        this.withinBlock(() => {
            this.printOnNewline('get');
            this.withinBlock(() => {
                this.printOnNewline(`if !${structName}.possibleTypes.contains(__typename) { return nil }`);
                this.printOnNewline(`return ${structName}(snapshot: snapshot)`);
            });
            this.printOnNewline('set');
            this.withinBlock(() => {
                this.printOnNewline(`guard let newValue = newValue else { return }`);
                this.printOnNewline(`snapshot = newValue.snapshot`);
            });
        });
    }
    initializerDeclarationForProperties(properties) {
        this.printOnNewline(`public init`);
        this.parametersForProperties(properties);
        this.withinBlock(() => {
            properties.forEach(({ propertyName }) => {
                this.printOnNewline(`self.${propertyName} = ${propertyName}`);
            });
        });
    }
    parametersForProperties(properties) {
        this.print('(');
        this.print(printing_1.join(properties.map(({ propertyName, typeName, isOptional }) => printing_1.join([`${language_1.escapeIdentifierIfNeeded(propertyName)}: ${typeName}`, isOptional && ' = nil'])), ', '));
        this.print(')');
    }
    typeCaseInitialization(typeCase) {
        if (typeCase.variants.length < 1) {
            this.selectionSetInitialization(typeCase.default);
            return;
        }
        this.print('[');
        this.withIndent(() => {
            this.printOnNewline(`GraphQLTypeCase(`);
            this.withIndent(() => {
                this.printOnNewline(`variants: [`);
                this.print(typeCase.variants
                    .flatMap(variant => {
                    const structName = this.helpers.structNameForVariant(variant);
                    return variant.possibleTypes.map(type => `"${type}": ${structName}.selections`);
                })
                    .join(', '));
                this.print('],');
                this.printOnNewline(`default: `);
                this.selectionSetInitialization(typeCase.default);
            });
            this.printOnNewline(')');
        });
        this.printOnNewline(']');
    }
    selectionSetInitialization(selectionSet) {
        this.print('[');
        this.withIndent(() => {
            for (const selection of selectionSet.selections) {
                switch (selection.kind) {
                    case 'Field': {
                        const { name, alias, args, type } = selection;
                        const responseKey = selection.alias || selection.name;
                        const structName = this.helpers.structNameForPropertyName(responseKey);
                        this.printOnNewline(`GraphQLField(`);
                        this.print(printing_1.join([
                            `"${name}"`,
                            alias ? `alias: "${alias}"` : null,
                            args &&
                                args.length &&
                                `arguments: ${this.helpers.dictionaryLiteralForFieldArguments(args)}`,
                            `type: ${this.helpers.fieldTypeEnum(type, structName)}`
                        ], ', '));
                        this.print('),');
                        break;
                    }
                    case 'BooleanCondition':
                        this.printOnNewline(`GraphQLBooleanCondition(`);
                        this.print(printing_1.join([
                            `variableName: "${selection.variableName}"`,
                            `inverted: ${selection.inverted}`,
                            'selections: '
                        ], ', '));
                        this.selectionSetInitialization(selection.selectionSet);
                        this.print('),');
                        break;
                    case 'TypeCondition': {
                        this.printOnNewline(`GraphQLTypeCondition(`);
                        this.print(printing_1.join([
                            `possibleTypes: [${printing_1.join(selection.selectionSet.possibleTypes.map(type => `"${type.name}"`), ', ')}]`,
                            'selections: '
                        ], ', '));
                        this.selectionSetInitialization(selection.selectionSet);
                        this.print('),');
                        break;
                    }
                    case 'FragmentSpread': {
                        const structName = this.helpers.structNameForFragmentName(selection.fragmentName);
                        this.printOnNewline(`GraphQLFragmentSpread(${structName}.self),`);
                        break;
                    }
                }
            }
        });
        this.printOnNewline(']');
    }
    typeDeclarationForGraphQLType(type) {
        if (type instanceof graphql_1.GraphQLEnumType) {
            this.enumerationDeclaration(type);
        }
        else if (type instanceof graphql_1.GraphQLInputObjectType) {
            this.structDeclarationForInputObjectType(type);
        }
    }
    enumerationDeclaration(type) {
        const { name, description } = type;
        const values = type.getValues();
        this.printNewlineIfNeeded();
        this.comment(description);
        this.printOnNewline(`public enum ${name}: String`);
        this.withinBlock(() => {
            values.forEach(value => {
                this.comment(value.description);
                this.printOnNewline(`case ${language_1.escapeIdentifierIfNeeded(this.helpers.enumCaseName(value.name))} = "${value.value}"`);
            });
        });
        this.printNewline();
        this.printOnNewline(`extension ${name}: Apollo.JSONDecodable, Apollo.JSONEncodable {}`);
    }
    structDeclarationForInputObjectType(type) {
        const { name: structName, description } = type;
        const adoptedProtocols = ['GraphQLMapConvertible'];
        const fields = Object.values(type.getFields());
        const properties = fields.map(this.helpers.propertyFromInputField, this.helpers);
        properties.forEach(property => {
            if (property.isOptional) {
                property.typeName = `Optional<${property.typeName}>`;
            }
        });
        this.structDeclaration({ structName, description, adoptedProtocols }, () => {
            this.printOnNewline(`public var graphQLMap: GraphQLMap`);
            this.printNewlineIfNeeded();
            this.printOnNewline(`public init`);
            this.print('(');
            this.print(printing_1.join(properties.map(({ propertyName, typeName, isOptional }) => printing_1.join([`${propertyName}: ${typeName}`, isOptional && ' = nil'])), ', '));
            this.print(')');
            this.withinBlock(() => {
                this.printOnNewline(printing_1.wrap(`graphQLMap = [`, printing_1.join(properties.map(({ name, propertyName }) => `"${name}": ${propertyName}`), ', ') || ':', `]`));
            });
            for (const { propertyName, typeName, description } of properties) {
                this.printNewlineIfNeeded();
                this.comment(description);
                this.printOnNewline(`public var ${propertyName}: ${typeName}`);
                this.withinBlock(() => {
                    this.printOnNewline('get');
                    this.withinBlock(() => {
                        this.printOnNewline(`return graphQLMap["${propertyName}"] as! ${typeName}`);
                    });
                    this.printOnNewline('set');
                    this.withinBlock(() => {
                        this.printOnNewline(`graphQLMap.updateValue(newValue, forKey: "${propertyName}")`);
                    });
                });
            }
        });
    }
}
exports.SwiftAPIGenerator = SwiftAPIGenerator;
//# sourceMappingURL=codeGeneration.js.map
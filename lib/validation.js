"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const errors_1 = require("./errors");
function validateQueryDocument(schema, document, target) {
    const specifiedRulesToBeRemoved = [graphql_1.NoUnusedFragments];
    const rules = [
        NoAnonymousQueries,
        NoTypenameAlias,
        ...(target === 'swift' ? [NoExplicitTypename] : []),
        ...graphql_1.specifiedRules.filter(rule => specifiedRulesToBeRemoved.includes(rule))
    ];
    const validationErrors = graphql_1.validate(schema, document, rules);
    if (validationErrors && validationErrors.length > 0) {
        for (const error of validationErrors) {
            errors_1.logError(error);
        }
        throw new errors_1.ToolError('Validation of GraphQL query document failed');
    }
}
exports.validateQueryDocument = validateQueryDocument;
function NoAnonymousQueries(context) {
    return {
        OperationDefinition(node) {
            if (!node.name) {
                context.reportError(new graphql_1.GraphQLError('Apollo does not support anonymous operations', [node]));
            }
            return false;
        }
    };
}
exports.NoAnonymousQueries = NoAnonymousQueries;
function NoExplicitTypename(context) {
    return {
        Field(node) {
            const fieldName = node.name.value;
            if (fieldName == '__typename') {
                context.reportError(new graphql_1.GraphQLError('Apollo inserts __typename automatically when needed, please do not include it explicitly', [node]));
            }
        }
    };
}
exports.NoExplicitTypename = NoExplicitTypename;
function NoTypenameAlias(context) {
    return {
        Field(node) {
            const aliasName = node.alias && node.alias.value;
            if (aliasName == '__typename') {
                context.reportError(new graphql_1.GraphQLError('Apollo needs to be able to insert __typename when needed, please do not use it as an alias', [node]));
            }
        }
    };
}
exports.NoTypenameAlias = NoTypenameAlias;
//# sourceMappingURL=validation.js.map
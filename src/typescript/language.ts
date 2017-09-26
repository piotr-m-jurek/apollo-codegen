import { LegacyInlineFragment } from '../compiler/legacyIR';

import { propertyDeclarations } from './codeGeneration';
import { typeNameFromGraphQLType } from './types';

import CodeGenerator from "../utilities/CodeGenerator";
import { GraphQLType } from "graphql";
import { getNamedType } from 'graphql';

export interface Property {
  fieldName?: string,
  fieldType?: GraphQLType,
  propertyName?: string,
  type?: GraphQLType,
  description?: string,
  typeName?: string,
  isComposite?: boolean,
  isNullable?: boolean,
  fields?: any[],
  inlineFragments?: LegacyInlineFragment[],
  fragmentSpreads?: any,
  isInput?: boolean,
  isArray?: boolean,
  isArrayElementNullable?: boolean | null,
}

export function interfaceDeclaration(generator: CodeGenerator, {
  interfaceName,
  noBrackets
}: { interfaceName: string, noBrackets?: boolean },
  closure: () => void) {
  generator.printNewlineIfNeeded();
  generator.printNewline();
  generator.print(`export type ${interfaceName} = `);
  generator.pushScope({ typeName: interfaceName });
  if (noBrackets) {
    generator.withinBlock(closure, '', '');
  } else {
    generator.withinBlock(closure, '{', '}');
  }
  generator.popScope();
  generator.print(';');
}

export function propertyDeclaration(generator: CodeGenerator, {
  fieldName,
  type,
  propertyName,
  typeName,
  description,
  isInput,
  isArray,
  isNullable,
  isArrayElementNullable,
  fragmentSpreads
}: Property, closure?: () => void) {
  const name = fieldName || propertyName;

  if (description) {
    description.split('\n')
      .forEach(line => {
        generator.printOnNewline(`// ${line.trim()}`);
      })
  }

  if (closure) {
    generator.printOnNewline(name);

    if (isNullable && isInput) {
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
      generator.print(' & ' + fragmentSpreads.map((t: string) => `${t}Fragment`).join(' & '))
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

  } else {
    generator.printOnNewline(name);
    if (isInput && isNullable) {
      generator.print('?')
    }

    if (fragmentSpreads && fragmentSpreads.length > 0) {
      generator.print(': ' + fragmentSpreads.map((t: string) => `${t}Fragment`).join(' & '))
    }
    else {
      generator.print(`: ${typeName || type && typeNameFromGraphQLType(generator.context, type)}`);
    }
  }

  generator.print(',');
}

export function propertySetsDeclaration(generator: CodeGenerator, property: Property, propertySets: Property[][], standalone = false) {
  const {
    description, fieldName, propertyName,
    isNullable, isArray, isArrayElementNullable,
  } = property;
  const name = fieldName || propertyName;

  if (description) {
    description.split('\n')
      .forEach(line => {
        generator.printOnNewline(`// ${line.trim()}`);
      })
  }

  if (!standalone) {
    generator.printOnNewline(`${name}: `);
  }

  let arrayParts = null as string[] | null
  if (isArray) {
    if (property.typeName) {
      const name = getNamedType(property.type || property.fieldType!).name
      arrayParts = property.typeName.split(name) as string[]
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
        propertyDeclarations(generator, propertySet);
      });
      if (index !== propertySets.length - 1) {
        generator.print(' |');
      }
    })
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

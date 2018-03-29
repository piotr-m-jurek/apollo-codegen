"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CodeGenerator {
    constructor(context) {
        this.context = context;
        this.scopeStack = [];
        this.indentWidth = 2;
        this.indentLevel = 0;
        this.startOfIndentLevel = false;
        this.output = '';
    }
    pushScope(scope) {
        this.scopeStack.push(scope);
    }
    popScope() {
        return this.scopeStack.pop();
    }
    get scope() {
        if (this.scopeStack.length < 1)
            throw Error('No active scope');
        return this.scopeStack[this.scopeStack.length - 1];
    }
    print(maybeString) {
        if (maybeString) {
            this.output += maybeString;
        }
    }
    printNewline() {
        if (this.output) {
            this.print('\n');
            this.startOfIndentLevel = false;
        }
    }
    printNewlineIfNeeded() {
        if (!this.startOfIndentLevel) {
            this.printNewline();
        }
    }
    printOnNewline(maybeString) {
        if (maybeString) {
            this.printNewline();
            this.printIndent();
            this.print(maybeString);
        }
    }
    printIndent() {
        const indentation = ' '.repeat(this.indentLevel * this.indentWidth);
        this.output += indentation;
    }
    withIndent(closure) {
        if (!closure)
            return;
        this.indentLevel++;
        this.startOfIndentLevel = true;
        closure();
        this.indentLevel--;
    }
    withinBlock(closure, open = ' {', close = '}') {
        this.print(open);
        this.withIndent(closure);
        this.printOnNewline(close);
    }
}
exports.default = CodeGenerator;
//# sourceMappingURL=CodeGenerator.js.map
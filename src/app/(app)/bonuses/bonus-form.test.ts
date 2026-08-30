import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourcePath = path.resolve(process.cwd(), "src/app/(app)/bonuses/bonus-form.tsx");
const sourceText = readFileSync(sourcePath, "utf8");
const sourceFile = ts.createSourceFile(
  sourcePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function descendants<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const matches: T[] = [];
  function visit(node: ts.Node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
  return matches;
}

describe("BonusForm rejected saveBonusAction contract (closes 02-REVIEW.md WR-02)", () => {
  it("catches the awaited action, reports a generic retry message, and renders it", () => {
    const bonusForm = descendants(
      sourceFile,
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === "BonusForm",
    )[0];
    expect(bonusForm).toBeDefined();

    const onSubmit = descendants(
      bonusForm,
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === "onSubmit",
    )[0];
    expect(onSubmit).toBeDefined();

    const guardedAction = descendants(onSubmit, ts.isTryStatement).find((tryStatement) =>
      descendants(tryStatement.tryBlock, ts.isAwaitExpression).some((awaitExpression) => {
        const expression = awaitExpression.expression;
        return (
          ts.isCallExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          expression.expression.text === "saveBonusAction"
        );
      }),
    );
    expect(guardedAction).toBeDefined();
    expect(guardedAction?.catchClause).toBeDefined();

    const catchClause = guardedAction?.catchClause;
    const catchCalls = catchClause ? descendants(catchClause.block, ts.isCallExpression) : [];
    const setServerErrorCall = catchCalls.find(
      (call) => ts.isIdentifier(call.expression) && call.expression.text === "setServerError",
    );
    expect(setServerErrorCall).toBeDefined();

    const errorArgument = setServerErrorCall?.arguments[0];
    expect(errorArgument && ts.isStringLiteral(errorArgument)).toBe(true);
    if (errorArgument && ts.isStringLiteral(errorArgument)) {
      expect(errorArgument.text).toMatch(/[А-Яа-яЁё]/);
      expect(errorArgument.text).toMatch(/попробуйте|повторите/i);
      expect(errorArgument.text.length).toBeGreaterThan(0);
    }

    const catchText = catchClause?.block.getText(sourceFile) ?? "";
    expect(catchText).not.toMatch(/console\s*\./);
    expect(catchText).not.toMatch(/\.message\b/);
    expect(catchText).not.toContain("${");

    const visibleErrorBranch = descendants(bonusForm, ts.isJsxExpression).some((expression) => {
      const condition = expression.expression;
      return (
        condition !== undefined &&
        ts.isBinaryExpression(condition) &&
        condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        ts.isIdentifier(condition.left) &&
        condition.left.text === "serverError" &&
        condition.right.getText(sourceFile).includes("{serverError}")
      );
    });
    expect(visibleErrorBranch).toBe(true);
  });
});

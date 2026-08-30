import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourcePath = path.resolve(process.cwd(), "src/app/(app)/bonuses/bonus-row.tsx");
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

describe("BonusRow rejected saveBonusAction contract (closes 02-REVIEW.md WR-02)", () => {
  it("catches the awaited action in onEdit, reports the generic retry message, and renders it while still editing", () => {
    const bonusRow = descendants(
      sourceFile,
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === "BonusRow",
    )[0];
    expect(bonusRow).toBeDefined();

    const onEdit = descendants(
      bonusRow,
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === "onEdit",
    )[0];
    expect(onEdit).toBeDefined();

    const guardedAction = descendants(onEdit, ts.isTryStatement).find((tryStatement) =>
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
    const setErrorMessageCall = catchCalls.find(
      (call) => ts.isIdentifier(call.expression) && call.expression.text === "setErrorMessage",
    );
    expect(setErrorMessageCall).toBeDefined();

    const errorArgument = setErrorMessageCall?.arguments[0];
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

    // The editing-mode branch is the `if (mode === "editing") { return (...) }`
    // early return — an edit-time failure must be visible there, not only in
    // the trailing "display" return.
    const editingIf = descendants(bonusRow, ts.isIfStatement).find((ifStatement) => {
      const condition = ifStatement.expression;
      return (
        ts.isBinaryExpression(condition) &&
        condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isIdentifier(condition.left) &&
        condition.left.text === "mode" &&
        ts.isStringLiteral(condition.right) &&
        condition.right.text === "editing"
      );
    });
    expect(editingIf).toBeDefined();

    const visibleErrorInEditingMode = editingIf
      ? descendants(editingIf.thenStatement, ts.isJsxExpression).some((expression) => {
          const condition = expression.expression;
          return (
            condition !== undefined &&
            ts.isBinaryExpression(condition) &&
            condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
            ts.isIdentifier(condition.left) &&
            condition.left.text === "error" &&
            condition.right.getText(sourceFile).includes("{error}")
          );
        })
      : false;
    expect(visibleErrorInEditingMode).toBe(true);
  });
});

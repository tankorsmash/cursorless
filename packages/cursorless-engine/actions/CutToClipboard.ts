import {
  FlashDescriptor,
  FlashStyle,
  Range,
  toCharacterRange,
  toLineRange,
} from "@cursorless/common";
import { ide } from "../singletons/ide.singleton";
import { Target } from "../typings/target.types";
import { Graph } from "../typings/Graph";
import { Action, ActionReturnValue } from "./actions.types";

export class CutToClipboard implements Action {
  constructor(private graph: Graph) {
    this.run = this.run.bind(this);
  }

  async run([targets]: [Target[]]): Promise<ActionReturnValue> {
    await ide().flashRanges(
      targets.flatMap((target) => {
        const { editor, contentRange } = target;
        const removalHighlightRange = target.getRemovalHighlightRange();

        if (target.isLine) {
          return [
            {
              editor,
              range: toCharacterRange(contentRange),
              style: FlashStyle.referenced,
            },
            {
              editor,
              range: toLineRange(removalHighlightRange),
              style: FlashStyle.pendingDelete,
            },
          ];
        }

        return [
          {
            editor,
            range: toCharacterRange(contentRange),
            style: FlashStyle.referenced,
          },
          ...getOutsideOverflow(contentRange, removalHighlightRange).map(
            (overflow): FlashDescriptor => ({
              editor,
              range: toCharacterRange(overflow),
              style: FlashStyle.pendingDelete,
            }),
          ),
        ];
      }),
    );

    const options = { showDecorations: false };

    await this.graph.actions.copyToClipboard.run([targets], options);

    const { thatTargets } = await this.graph.actions.remove.run(
      [targets],
      options,
    );

    return { thatTargets };
  }
}

/** Get the possible leading and trailing overflow ranges of the outside range compared to the inside range */
function getOutsideOverflow(insideRange: Range, outsideRange: Range): Range[] {
  const { start: insideStart, end: insideEnd } = insideRange;
  const { start: outsideStart, end: outsideEnd } = outsideRange;
  const result = [];
  if (outsideStart.isBefore(insideStart)) {
    result.push(new Range(outsideStart, insideStart));
  }
  if (outsideEnd.isAfter(insideEnd)) {
    result.push(new Range(insideEnd, outsideEnd));
  }
  return result;
}
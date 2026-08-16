import * as React from "react";
import { GameScoringParameters, Deck, ScoreSegment } from "./gen-types";
import { WebsocketContext } from "./WebsocketProvider";
import { useEngine } from "./useEngine";
import { explainScoringCache, getExplainScoringKey } from "./util/cachePrefill";

import type { JSX } from "react";

interface IProps {
  params: GameScoringParameters;
  decks: Deck[];
}

export const GameScoringSettings = (props: IProps): JSX.Element => {
  const { send } = React.useContext(WebsocketContext);
  const engine = useEngine();
  const [highlighted, setHighlighted] = React.useState<number | null>(null);
  const [scoreTransitions, setScoreTransitions] = React.useState<any[]>([]);
  const [bonusScoreTransitions, setBonusScoreTransitions] = React.useState<
    any[]
  >([]);
  const [stepSize, setStepSize] = React.useState<number>(10);
  const [totalPoints, setTotalPoints] = React.useState<number>(100);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const updateSettings = (updates: Partial<GameScoringParameters>): void => {
    send({
      Action: {
        SetGameScoringParameters: { ...props.params, ...updates },
      },
    });
  };

  const bonusEnabled =
    props.params.bonus_level_policy === "BonusLevelForSmallerLandlordTeam";

  React.useEffect(() => {
    setIsLoading(true);

    const loadScoring = async () => {
      try {
        const regularKey = getExplainScoringKey(
          props.params,
          false,
          props.decks,
        );
        let regular = explainScoringCache[regularKey];

        if (!regular) {
          regular = await engine.explainScoring({
            params: props.params,
            smaller_landlord_team_size: false,
            decks: props.decks,
          });
          explainScoringCache[regularKey] = regular;
        }

        setScoreTransitions(regular.results);
        setStepSize(regular.step_size);
        setTotalPoints(regular.total_points);

        if (bonusEnabled) {
          const bonusKey = getExplainScoringKey(
            props.params,
            true,
            props.decks,
          );
          let bonus = explainScoringCache[bonusKey];

          if (!bonus) {
            bonus = await engine.explainScoring({
              params: props.params,
              smaller_landlord_team_size: true,
              decks: props.decks,
            });
            explainScoringCache[bonusKey] = bonus;
          }
          setBonusScoreTransitions(bonus.results);
        } else {
          setBonusScoreTransitions(regular.results);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error explaining scoring:", error);
        setScoreTransitions([]);
        setBonusScoreTransitions([]);
        setStepSize(10);
        setTotalPoints(100);
        setIsLoading(false);
      }
    };

    loadScoring();
  }, [props.params, props.decks, bonusEnabled, engine]);

  if (isLoading) {
    return (
      <>
        <div>正在加载计分设置……</div>
      </>
    );
  }

  const scoreSegments: Array<{
    span: number;
    segment: ScoreSegment;
    bonusSegment: ScoreSegment | null;
  }> = [];
  let maxPts = 0;
  let maxLandlordDelta = 0;
  let maxNonLandlordDelta = 0;

  if (scoreTransitions.length > 0) {
    for (let i = 1; i < scoreTransitions.length; i++) {
      const span = Math.max(
        scoreTransitions[i].point_threshold -
          scoreTransitions[i - 1].point_threshold,
        10,
      );
      const segment = scoreTransitions[i - 1];
      maxLandlordDelta = Math.max(
        segment.results.landlord_delta,
        maxLandlordDelta,
      );
      maxNonLandlordDelta = Math.max(
        segment.results.non_landlord_delta,
        maxNonLandlordDelta,
      );
      scoreSegments.push({
        span,
        segment,
        bonusSegment:
          bonusScoreTransitions.length > i - 1 &&
          bonusScoreTransitions[i - 1].results.landlord_bonus
            ? bonusScoreTransitions[i - 1]
            : null,
      });
      maxPts += span;
    }
    const last = scoreTransitions.length - 1;
    scoreSegments.push({
      span: 5 * props.decks.length,
      segment: scoreTransitions[last],
      bonusSegment:
        bonusScoreTransitions.length > last &&
        bonusScoreTransitions[last].results.landlord_bonus
          ? bonusScoreTransitions[last]
          : null,
    });
    maxPts += 5 * props.decks.length;
    maxNonLandlordDelta = Math.max(
      scoreTransitions[last].results.non_landlord_delta,
      maxNonLandlordDelta,
    );
    maxLandlordDelta = Math.max(
      scoreTransitions[last].results.landlord_delta,
      maxLandlordDelta,
    );
  }

  const text = (idx: number): JSX.Element => {
    let txt = "闲家获胜，但不升级。";
    const segment = scoreSegments[idx];
    if (segment.segment.results.landlord_won) {
      txt = `庄家方获胜，升 ${segment.segment.results.landlord_delta} 级。`;
      if (segment.bonusSegment !== null) {
        txt += ` 如果庄家方人数少于正常人数，则升 ${segment.bonusSegment.results.landlord_delta} 级。`;
      }
    } else if (segment.segment.results.non_landlord_delta > 0) {
      txt = `闲家方获胜，升 ${segment.segment.results.non_landlord_delta} 级。`;
    }
    return <>{txt}</>;
  };

  const validStepSizes = [];
  for (
    let curStepSize = 0;
    curStepSize <= totalPoints / 3;
    curStepSize += 5 * props.decks.length
  ) {
    if (curStepSize === 0) {
      continue;
    }
    if (totalPoints % curStepSize === 0) {
      validStepSizes.push(`${curStepSize}`);
    }
  }
  const maxSteps = Math.floor(totalPoints / stepSize);

  return (
    <>
      <div>
        <div style={{ width: "95%", padding: "5px 0 5px 0" }}>
          {scoreSegments.map((segment, idx) => {
            const frac = segment.span / maxPts;
            let bg = "rgb(255, 255, 0)";
            if (segment.segment.results.landlord_won) {
              const f =
                segment.segment.results.landlord_delta / maxLandlordDelta;
              bg = `rgba(0, 255, 0, ${f})`;
            } else if (segment.segment.results.non_landlord_delta > 0) {
              const f =
                segment.segment.results.non_landlord_delta /
                maxNonLandlordDelta;
              bg = `rgba(255, 0, 0, ${f})`;
            }
            return (
              <div
                key={idx}
                onMouseEnter={(_) => {
                  setHighlighted(idx);
                }}
                onMouseLeave={(_) => {
                  setHighlighted(null);
                }}
                style={{
                  width: `${100 * frac}%`,
                  background: bg,
                  padding: "5px 0 5px 0",
                  display: "inline-block",
                  cursor: "pointer",
                }}
              >
                {segment.segment.point_threshold}
              </div>
            );
          })}
          {highlighted !== null ? (
            <p> {text(highlighted)}</p>
          ) : (
            <p>把鼠标移到上方分数区间，可查看详细结果。</p>
          )}
        </div>
        <div>
          <label>当前每档：{stepSize} 分</label>
        </div>
        <div>
          <label>基础每档分数：</label>
          <select
            value={`${props.params.step_size_per_deck * props.decks.length}`}
            onChange={(evt) => {
              evt.preventDefault();
              const perDeck =
                parseInt(evt.target.value, 10) / props.decks.length;

              updateSettings({
                step_size_per_deck: perDeck,
              });
            }}
          >
            {validStepSizes.map((ss, idx) => (
              <option key={idx}>{ss}</option>
            ))}
          </select>{" "}
          （默认：{20 * props.decks.length}）
        </div>
        <div>
          <label>使用 {props.decks.length} 副牌时的每档调整：</label>
          <select
            value={
              props.params.step_adjustments[props.decks.length] !== undefined
                ? props.params.step_adjustments[props.decks.length]
                : "none"
            }
            onChange={(evt) => {
              evt.preventDefault();
              if (evt.target.value === "none") {
                const { [props.decks.length]: _, ...adjustments } =
                  props.params.step_adjustments;
                updateSettings({ step_adjustments: adjustments });
              } else {
                const adjustments = {
                  ...props.params.step_adjustments,
                  [props.decks.length]: parseInt(evt.target.value, 10),
                };
                updateSettings({ step_adjustments: adjustments });
              }
            }}
          >
            <option value="none">无</option>
            {Array((props.params.step_size_per_deck * props.decks.length) / 5)
              .fill(undefined)
              .map((_, idx) => (
                <option key={idx} value={(idx + 1) * 5}>
                  {(idx + 1) * 5}
                </option>
              ))}
          </select>{" "}
          （默认：无）
        </div>
        <div>
          <label>双方都不升级的档数：</label>
          <select
            value={`${props.params.deadzone_size}`}
            onChange={(evt) => {
              evt.preventDefault();
              const deadzoneSize = parseInt(evt.target.value, 10);

              updateSettings({
                deadzone_size: deadzoneSize,
              });
            }}
          >
            {Array(Math.max(maxSteps, props.params.deadzone_size))
              .fill(undefined)
              .map((_, idx) => (
                <option key={idx}>{idx}</option>
              ))}
          </select>{" "}
          （默认：1）
        </div>
        <div>
          <label>闲家获胜所需档数：</label>
          <select
            value={`${props.params.num_steps_to_non_landlord_turnover}`}
            onChange={(evt) => {
              evt.preventDefault();
              const steps = parseInt(evt.target.value, 10);

              updateSettings({
                num_steps_to_non_landlord_turnover: steps,
              });
            }}
          >
            {Array(
              Math.max(
                maxSteps,
                props.params.num_steps_to_non_landlord_turnover,
              ),
            )
              .fill(undefined)
              .map((_, idx) => (
                <option key={idx + 1}>{idx + 1}</option>
              ))}
          </select>{" "}
          （默认：2）
        </div>
        <div>
          <label>庄家方人数意外较少时额外升一级</label>{" "}
          <input
            id="small-team-bonus"
            type="checkbox"
            onChange={(evt) => {
              evt.preventDefault();
              updateSettings({
                bonus_level_policy: evt.target.checked
                  ? "BonusLevelForSmallerLandlordTeam"
                  : "NoBonusLevel",
              });
            }}
            checked={bonusEnabled}
          />
        </div>
      </div>
    </>
  );
};

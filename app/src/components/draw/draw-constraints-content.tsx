import { AlertCircle, CheckCircle2, Copy, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import type {
  DrawConstraint,
  DrawPreflight,
  EditionParticipant,
} from "@/api/generated/models";
import { ScreenState } from "@/components/common/screen-state";
import { Button, Card, Text } from "@/components/ui";
import { apiErrorMessage } from "@/features/shared/presentation";
import { palette } from "@/theme/tokens";

import { DrawConstraintCard } from "./draw-constraint-card";
import { ParticipantChoice } from "./participant-choice";

export interface ReadinessResult {
  preflight?: DrawPreflight;
  error?: unknown;
}

export type ConstraintMutation = "creating" | "copying" | number;

interface ConstraintEditorProps {
  participants: EditionParticipant[];
  firstParticipantId?: number;
  secondParticipantId?: number;
  selectedPairExists: boolean;
  mutation?: ConstraintMutation;
  participantName(participantId: number): string;
  onSelectFirst(participantId: number): void;
  onSelectSecond(participantId: number): void;
  onAdd(): void;
}

export function ConstraintEditor({
  participants,
  firstParticipantId,
  secondParticipantId,
  selectedPairExists,
  mutation,
  participantName,
  onSelectFirst,
  onSelectSecond,
  onAdd,
}: ConstraintEditorProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-4 border border-hairline p-5">
      <View className="gap-1">
        <Text variant="section">{t("draw.constraints.newTitle")}</Text>
        <Text variant="caption">{t("draw.constraints.newHint")}</Text>
      </View>
      <ParticipantSelector
        label={t("draw.constraints.firstPerson")}
        participants={participants}
        selectedId={firstParticipantId}
        disabled={Boolean(mutation)}
        participantName={participantName}
        onSelect={onSelectFirst}
      />
      <ParticipantSelector
        label={t("draw.constraints.secondPerson")}
        participants={participants}
        selectedId={secondParticipantId}
        disabled={Boolean(mutation)}
        disabledId={firstParticipantId}
        participantName={participantName}
        onSelect={onSelectSecond}
      />
      {selectedPairExists ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {t("draw.constraints.duplicate")}
        </Text>
      ) : null}
      <Button
        label={
          mutation === "creating"
            ? t("draw.constraints.adding")
            : t("draw.constraints.add")
        }
        leftIcon={
          mutation === "creating" ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Plus color={palette.white} size={18} />
          )
        }
        disabled={
          Boolean(mutation) ||
          !firstParticipantId ||
          !secondParticipantId ||
          selectedPairExists
        }
        onPress={onAdd}
      />
    </Card>
  );
}

export function CopyConstraintsCard({
  copying,
  disabled,
  onCopy,
}: {
  copying: boolean;
  disabled: boolean;
  onCopy(): void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3 border border-hairline p-5">
      <View className="gap-1">
        <Text variant="cardTitle">{t("draw.constraints.copyTitle")}</Text>
        <Text variant="caption">{t("draw.constraints.copyHint")}</Text>
      </View>
      <Button
        label={
          copying ? t("draw.constraints.copying") : t("draw.constraints.copy")
        }
        variant="light"
        leftIcon={
          copying ? (
            <ActivityIndicator color={palette.mintDeep} />
          ) : (
            <Copy color={palette.mintDeep} size={18} />
          )
        }
        disabled={disabled}
        onPress={onCopy}
      />
    </Card>
  );
}

export function LockedConstraintsNotice() {
  const { t } = useTranslation();

  return (
    <Card className="gap-2 border border-hairline p-5">
      <Text variant="cardTitle">{t("draw.constraints.lockedTitle")}</Text>
      <Text variant="caption">{t("draw.constraints.lockedBody")}</Text>
    </Card>
  );
}

export function ConstraintList({
  constraints,
  editable,
  mutation,
  participantName,
  onRemove,
}: {
  constraints: DrawConstraint[];
  editable: boolean;
  mutation?: ConstraintMutation;
  participantName(participantId: number): string;
  onRemove(constraint: DrawConstraint): void;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text variant="section">{t("draw.constraints.currentTitle")}</Text>
        <Text variant="caption">
          {t("draw.constraints.currentCount", { count: constraints.length })}
        </Text>
      </View>
      {constraints.length === 0 ? (
        <ScreenState
          kind="empty"
          title={t("draw.constraints.empty")}
          message={t("draw.constraints.emptyHint")}
        />
      ) : (
        constraints.map((constraint) => {
          const firstName = participantName(constraint.giverParticipantId);
          const secondName = participantName(constraint.receiverParticipantId);

          return (
            <DrawConstraintCard
              key={constraint.id}
              firstName={firstName}
              secondName={secondName}
              removeLabel={t("draw.constraints.removeLabel", {
                first: firstName,
                second: secondName,
              })}
              disabled={!editable || Boolean(mutation)}
              onRemove={() => onRemove(constraint)}
            />
          );
        })
      )}
    </View>
  );
}

export function ReadinessCard({ readiness }: { readiness: ReadinessResult }) {
  const { t } = useTranslation();
  const isReady = Boolean(readiness.preflight?.ready);

  return (
    <Card
      className={
        isReady
          ? "flex-row items-start gap-3 border border-mint p-4"
          : "flex-row items-start gap-3 border border-pink p-4"
      }
      accessibilityLiveRegion="polite"
    >
      {isReady ? (
        <CheckCircle2 color={palette.mint} size={22} />
      ) : (
        <AlertCircle color={palette.pink} size={22} />
      )}
      <View className="flex-1 gap-1">
        <Text variant="cardTitle">
          {t(
            isReady
              ? "draw.constraints.readyTitle"
              : "draw.constraints.blockedTitle",
          )}
        </Text>
        <Text variant="caption">
          {isReady
            ? t("draw.constraints.readyBody", {
                count: readiness.preflight?.participantCount,
              })
            : apiErrorMessage(readiness.error, t)}
        </Text>
      </View>
    </Card>
  );
}

function ParticipantSelector({
  label,
  participants,
  selectedId,
  disabled,
  disabledId,
  participantName,
  onSelect,
}: {
  label: string;
  participants: EditionParticipant[];
  selectedId?: number;
  disabled: boolean;
  disabledId?: number;
  participantName(participantId: number): string;
  onSelect(participantId: number): void;
}) {
  return (
    <View className="gap-2">
      <Text variant="bodyBold">{label}</Text>
      <View className="gap-2">
        {participants.map((participant) => (
          <ParticipantChoice
            key={participant.id}
            label={participantName(participant.id)}
            selected={selectedId === participant.id}
            disabled={disabled || disabledId === participant.id}
            onPress={() => onSelect(participant.id)}
          />
        ))}
      </View>
    </View>
  );
}

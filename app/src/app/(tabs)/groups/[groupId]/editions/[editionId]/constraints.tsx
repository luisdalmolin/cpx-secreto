import { AlertCircle, CheckCircle2, Copy, Plus } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, View } from "react-native";

import {
  copyDrawConstraintsFromPreviousEdition,
  createDrawConstraint,
  deleteDrawConstraint,
  listDrawConstraints,
} from "@/api/generated/draw-constraints/draw-constraints";
import { preflightDraw } from "@/api/generated/draw/draw";
import { listEditionParticipants } from "@/api/generated/edition-participants/edition-participants";
import { getEdition } from "@/api/generated/editions/editions";
import type {
  DrawConstraint,
  DrawPreflight,
  EditionParticipant,
} from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { DrawConstraintCard, ParticipantChoice } from "@/components/draw";
import { Button, Card, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

interface ReadinessResult {
  preflight?: DrawPreflight;
  error?: unknown;
}

async function checkReadiness(
  groupId: number,
  editionId: number,
  signal?: AbortSignal,
): Promise<ReadinessResult> {
  try {
    return { preflight: await preflightDraw(groupId, editionId, { signal }) };
  } catch (error) {
    return { error };
  }
}

export default function DrawConstraintsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const [firstParticipantId, setFirstParticipantId] = useState<number>();
  const [secondParticipantId, setSecondParticipantId] = useState<number>();
  const [mutation, setMutation] = useState<"creating" | "copying" | number>();
  const [mutationError, setMutationError] = useState<unknown>();
  const mounted = useMountedRef();

  const load = async (signal: AbortSignal) => {
    if (!groupId || !editionId) {
      throw new Error(t("common.errors.notFound"));
    }

    const [edition, participants, constraints, readiness] = await Promise.all([
      getEdition(groupId, editionId, { signal }),
      listEditionParticipants(groupId, editionId, { signal }),
      listDrawConstraints(groupId, editionId, { signal }),
      checkReadiness(groupId, editionId, signal),
    ]);

    return {
      edition,
      participants: participants.data,
      constraints: constraints.data,
      readiness,
    };
  };
  const resource = useFocusResource(load);

  const isEditable =
    resource.data?.edition.status === "draft" ||
    resource.data?.edition.status === "open";
  const exclusions =
    resource.data?.constraints.filter(
      (constraint) => constraint.type === "must_not_pair",
    ) ?? [];
  const selectedPairExists = exclusions.some(
    (constraint) =>
      (constraint.giverParticipantId === firstParticipantId &&
        constraint.receiverParticipantId === secondParticipantId) ||
      (constraint.giverParticipantId === secondParticipantId &&
        constraint.receiverParticipantId === firstParticipantId),
  );

  function participantName(participantId: number): string {
    return (
      resource.data?.participants.find(
        (participant) => participant.id === participantId,
      )?.groupMember.displayName ?? t("draw.constraints.unknownParticipant")
    );
  }

  function selectFirst(participantId: number): void {
    setFirstParticipantId(participantId);
    if (secondParticipantId === participantId) {
      setSecondParticipantId(undefined);
    }
  }

  async function refreshReadiness(
    constraints: DrawConstraint[],
  ): Promise<void> {
    if (!groupId || !editionId) return;
    const readiness = await checkReadiness(groupId, editionId);
    if (!mounted.current) return;
    resource.setData((current) =>
      current ? { ...current, constraints, readiness } : current,
    );
  }

  async function addExclusion(): Promise<void> {
    if (
      !groupId ||
      !editionId ||
      !firstParticipantId ||
      !secondParticipantId ||
      firstParticipantId === secondParticipantId ||
      selectedPairExists ||
      mutation
    ) {
      return;
    }

    setMutation("creating");
    setMutationError(undefined);
    try {
      const created = await createDrawConstraint(groupId, editionId, {
        type: "must_not_pair",
        giverParticipantId: firstParticipantId,
        receiverParticipantId: secondParticipantId,
      });
      if (!mounted.current) return;
      const constraints = [created, ...(resource.data?.constraints ?? [])];
      setFirstParticipantId(undefined);
      setSecondParticipantId(undefined);
      await refreshReadiness(constraints);
    } catch (error) {
      if (mounted.current) setMutationError(error);
    }
    if (mounted.current) setMutation(undefined);
  }

  async function copyPreviousExclusions(): Promise<void> {
    if (!groupId || !editionId || mutation) return;
    setMutation("copying");
    setMutationError(undefined);
    try {
      const result = await copyDrawConstraintsFromPreviousEdition(
        groupId,
        editionId,
      );
      if (!mounted.current) return;
      const constraints = [
        ...result.data,
        ...(resource.data?.constraints ?? []),
      ];
      await refreshReadiness(constraints);
      if (!mounted.current) return;
      Alert.alert(
        t("draw.constraints.copyResultTitle"),
        result.sourceEditionId === null
          ? t("draw.constraints.copyNoPrevious")
          : t("draw.constraints.copyResultBody", {
              copied: result.copiedCount,
              skipped:
                result.skippedMissingParticipants +
                result.skippedDuplicates +
                result.skippedConflicts,
            }),
      );
    } catch (error) {
      if (mounted.current) setMutationError(error);
    }
    if (mounted.current) setMutation(undefined);
  }

  function confirmRemoval(constraint: DrawConstraint): void {
    Alert.alert(
      t("draw.constraints.removeConfirmTitle"),
      t("draw.constraints.removeConfirmBody", {
        first: participantName(constraint.giverParticipantId),
        second: participantName(constraint.receiverParticipantId),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("draw.constraints.remove"),
          style: "destructive",
          onPress: () => void removeExclusion(constraint),
        },
      ],
    );
  }

  async function removeExclusion(constraint: DrawConstraint): Promise<void> {
    if (!groupId || !editionId || mutation) return;
    setMutation(constraint.id);
    setMutationError(undefined);
    try {
      await deleteDrawConstraint(groupId, editionId, constraint.id);
      if (!mounted.current) return;
      const constraints =
        resource.data?.constraints.filter(
          (item) => item.id !== constraint.id,
        ) ?? [];
      await refreshReadiness(constraints);
    } catch (error) {
      if (mounted.current) setMutationError(error);
    }
    if (mounted.current) setMutation(undefined);
  }

  if (!resource.data) {
    return (
      <AppScreen title={t("draw.constraints.title")} back>
        <ScreenState
          kind={resource.isLoading ? "loading" : "error"}
          title={
            resource.isLoading
              ? t("draw.constraints.loading")
              : t("draw.constraints.loadError")
          }
          message={
            resource.error ? apiErrorMessage(resource.error, t) : undefined
          }
          retryLabel={t("common.retry")}
          onRetry={resource.refresh}
        />
      </AppScreen>
    );
  }

  const participants = resource.data.participants;
  return (
    <AppScreen
      title={t("draw.constraints.title")}
      subtitle={t("draw.constraints.subtitle")}
      back
      refreshing={resource.isRefreshing}
      onRefresh={resource.refresh}
    >
      {!isEditable ? (
        <Card className="gap-2 border border-hairline p-5">
          <Text variant="cardTitle">{t("draw.constraints.lockedTitle")}</Text>
          <Text variant="caption">{t("draw.constraints.lockedBody")}</Text>
        </Card>
      ) : (
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
            onSelect={selectFirst}
          />
          <ParticipantSelector
            label={t("draw.constraints.secondPerson")}
            participants={participants}
            selectedId={secondParticipantId}
            disabled={Boolean(mutation)}
            disabledId={firstParticipantId}
            participantName={participantName}
            onSelect={setSecondParticipantId}
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
            onPress={() => void addExclusion()}
          />
        </Card>
      )}

      {isEditable ? (
        <Card className="gap-3 border border-hairline p-5">
          <View className="gap-1">
            <Text variant="cardTitle">{t("draw.constraints.copyTitle")}</Text>
            <Text variant="caption">{t("draw.constraints.copyHint")}</Text>
          </View>
          <Button
            label={
              mutation === "copying"
                ? t("draw.constraints.copying")
                : t("draw.constraints.copy")
            }
            variant="light"
            leftIcon={
              mutation === "copying" ? (
                <ActivityIndicator color={palette.mintDeep} />
              ) : (
                <Copy color={palette.mintDeep} size={18} />
              )
            }
            disabled={Boolean(mutation)}
            onPress={() => void copyPreviousExclusions()}
          />
        </Card>
      ) : null}

      {isEditable ? (
        <ReadinessCard readiness={resource.data.readiness} />
      ) : null}

      <View className="gap-3">
        <View className="gap-1">
          <Text variant="section">{t("draw.constraints.currentTitle")}</Text>
          <Text variant="caption">
            {t("draw.constraints.currentCount", { count: exclusions.length })}
          </Text>
        </View>
        {exclusions.length === 0 ? (
          <ScreenState
            kind="empty"
            title={t("draw.constraints.empty")}
            message={t("draw.constraints.emptyHint")}
          />
        ) : (
          exclusions.map((constraint) => (
            <DrawConstraintCard
              key={constraint.id}
              firstName={participantName(constraint.giverParticipantId)}
              secondName={participantName(constraint.receiverParticipantId)}
              removeLabel={t("draw.constraints.removeLabel", {
                first: participantName(constraint.giverParticipantId),
                second: participantName(constraint.receiverParticipantId),
              })}
              disabled={!isEditable || Boolean(mutation)}
              onRemove={() => confirmRemoval(constraint)}
            />
          ))
        )}
      </View>

      {mutationError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {apiErrorMessage(mutationError, t)}
        </Text>
      ) : null}
      {resource.error ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {apiErrorMessage(resource.error, t)}
        </Text>
      ) : null}
    </AppScreen>
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
  participantName: (participantId: number) => string;
  onSelect: (participantId: number) => void;
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

function ReadinessCard({ readiness }: { readiness: ReadinessResult }) {
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

import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import {
  copyDrawConstraintsFromPreviousEdition,
  createDrawConstraint,
  deleteDrawConstraint,
  listDrawConstraints,
} from "@/api/generated/draw-constraints/draw-constraints";
import { preflightDraw } from "@/api/generated/draw/draw";
import { listEditionParticipants } from "@/api/generated/edition-participants/edition-participants";
import { getEdition } from "@/api/generated/editions/editions";
import type { DrawConstraint } from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import {
  ConstraintEditor,
  ConstraintList,
  type ConstraintMutation,
  CopyConstraintsCard,
  LockedConstraintsNotice,
  ReadinessCard,
  type ReadinessResult,
} from "@/components/draw/draw-constraints-content";
import { Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";

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
  const [mutation, setMutation] = useState<ConstraintMutation>();
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
        <LockedConstraintsNotice />
      ) : (
        <ConstraintEditor
          participants={participants}
          firstParticipantId={firstParticipantId}
          secondParticipantId={secondParticipantId}
          selectedPairExists={selectedPairExists}
          mutation={mutation}
          participantName={participantName}
          onSelectFirst={selectFirst}
          onSelectSecond={setSecondParticipantId}
          onAdd={() => void addExclusion()}
        />
      )}

      {isEditable ? (
        <CopyConstraintsCard
          copying={mutation === "copying"}
          disabled={Boolean(mutation)}
          onCopy={() => void copyPreviousExclusions()}
        />
      ) : null}

      {isEditable ? (
        <ReadinessCard readiness={resource.data.readiness} />
      ) : null}

      <ConstraintList
        constraints={exclusions}
        editable={isEditable}
        mutation={mutation}
        participantName={participantName}
        onRemove={confirmRemoval}
      />

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

import { router, useLocalSearchParams } from "expo-router";
import { Pencil } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useAuthSession } from "@/auth/auth-session";
import { getEdition } from "@/api/generated/editions/editions";
import { listEditionParticipants } from "@/api/generated/edition-participants/edition-participants";
import {
  archiveEdition,
  openEdition,
  revealEdition,
} from "@/api/generated/edition-lifecycle/edition-lifecycle";
import { getGroup } from "@/api/generated/groups/groups";
import { listGroupMembers } from "@/api/generated/group-members/group-members";
import type { Edition } from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { EditionDetailContent } from "@/components/editions/edition-detail-content";
import { IconButton, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

export default function EditionDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuthSession();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const [mutationError, setMutationError] = useState<unknown>();
  const [mutating, setMutating] = useState(false);
  const mounted = useMountedRef();
  const load = async (signal: AbortSignal) => {
    if (!groupId || !editionId) throw new Error(t("common.errors.notFound"));
    const [group, edition, participants, members] = await Promise.all([
      getGroup(groupId, { signal }),
      getEdition(groupId, editionId, { signal }),
      listEditionParticipants(groupId, editionId, { signal }),
      listGroupMembers(groupId, { signal }),
    ]);
    return {
      group,
      edition,
      participants,
      members: members.data,
    };
  };
  const resource = useFocusResource(load);
  const isAdmin = Boolean(
    resource.data &&
    user &&
    resource.data.members.some(
      (member) =>
        member.userId === user.id &&
        member.role === "admin" &&
        member.status === "active",
    ),
  );
  const isParticipant = Boolean(
    resource.data?.participants.currentParticipantId,
  );

  async function run(action: () => Promise<Edition>): Promise<void> {
    setMutationError(undefined);
    setMutating(true);
    try {
      const edition = await action();
      if (!mounted.current) return;
      resource.setData((current) =>
        current ? { ...current, edition } : current,
      );
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
      resource.refresh();
    }
    if (mounted.current) setMutating(false);
  }

  function confirm(
    title: string,
    body: string,
    action: () => Promise<Edition>,
  ): void {
    Alert.alert(title, body, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => void run(action),
      },
    ]);
  }

  if (!resource.data) {
    return (
      <AppScreen title={t("groups.editions")} back>
        <ScreenState
          kind={resource.isLoading ? "loading" : "error"}
          title={
            resource.isLoading
              ? t("common.loading")
              : t("common.errors.notFound")
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

  const { edition, participants } = resource.data;
  const routeParams = {
    groupId: String(groupId),
    editionId: String(editionId),
  };
  const canEditEdition =
    (edition.status === "draft" || edition.status === "open") && isAdmin;
  return (
    <AppScreen
      title={edition.name}
      subtitle={t("editions.statusLabel", {
        value: t(`editions.status.${edition.status}`),
      })}
      back
      action={
        canEditEdition ? (
          <IconButton
            accessibilityLabel={t("editions.edit")}
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]/editions/[editionId]/edit",
                params: routeParams,
              })
            }
          >
            <Pencil color={palette.mintDeep} size={20} />
          </IconButton>
        ) : undefined
      }
      refreshing={resource.isRefreshing}
      onRefresh={resource.refresh}
    >
      <EditionDetailContent
        edition={edition}
        participantCount={participants.meta.total}
        isAdmin={isAdmin}
        isParticipant={isParticipant}
        mutating={mutating}
        routeParams={routeParams}
        onOpen={() =>
          confirm(
            t("editions.openConfirmTitle"),
            t("editions.openConfirmBody"),
            () => openEdition(groupId!, editionId!),
          )
        }
        onReveal={() =>
          confirm(
            t("editions.revealConfirmTitle"),
            t("editions.revealConfirmBody"),
            () => revealEdition(groupId!, editionId!),
          )
        }
        onArchive={() =>
          confirm(
            t("editions.archiveConfirmTitle"),
            t("editions.archiveConfirmBody"),
            () => archiveEdition(groupId!, editionId!),
          )
        }
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

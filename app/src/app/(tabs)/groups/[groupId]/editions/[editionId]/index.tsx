import { router, useLocalSearchParams } from "expo-router";
import {
  Ban,
  CreditCard,
  Eye,
  Gift,
  Heart,
  List,
  MessageCircle,
  Pencil,
  Shuffle,
  Users,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

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
import { Badge, Button, Card, IconButton, Text } from "@/components/ui";
import {
  apiErrorMessage,
  formatCurrency,
  formatDate,
  parseRouteId,
} from "@/features/shared/presentation";
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
  const load = useCallback(
    async (signal: AbortSignal) => {
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
    },
    [editionId, groupId, t],
  );
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
  const canEditRoster = edition.status === "draft" || edition.status === "open";
  const canEditEdition = canEditRoster && isAdmin;
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
      <Card className="gap-3 p-5">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="section">{t("editions.type")}</Text>
          <Badge
            label={t(`editions.status.${edition.status}`)}
            variant={
              edition.status === "drawn" || edition.status === "revealed"
                ? "success"
                : "neutral"
            }
          />
        </View>
        {edition.budgetCents !== null && edition.budgetCents !== undefined ? (
          <Text variant="caption">
            {t("editions.budgetLabel", {
              value: formatCurrency(edition.budgetCents, edition.currency),
            })}
          </Text>
        ) : null}
        {edition.eventDate ? (
          <Text variant="caption">
            {t("editions.eventDateLabel", {
              value: formatDate(edition.eventDate),
            })}
          </Text>
        ) : null}
      </Card>

      <Card className="gap-3 p-5">
        <View className="flex-row items-center gap-3">
          <Users color={palette.mint} size={22} />
          <View className="flex-1">
            <Text variant="cardTitle">{t("editions.roster")}</Text>
            <Text variant="caption">
              {t("editions.rosterCount", { count: participants.meta.total })}
            </Text>
          </View>
        </View>
        {canEditRoster && isAdmin ? (
          <Button
            label={t("editions.editRoster")}
            variant="light"
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]/editions/[editionId]/roster",
                params: routeParams,
              })
            }
          />
        ) : null}
      </Card>

      {isParticipant ? (
        <Card className="gap-3 p-5">
          <View className="flex-row items-center gap-3">
            <Heart color={palette.pink} size={22} />
            <View className="flex-1">
              <Text variant="cardTitle">{t("wishes.title")}</Text>
              <Text variant="caption">{t("wishes.editionHint")}</Text>
            </View>
          </View>
          <Button
            label={t("wishes.openMine")}
            variant="light"
            leftIcon={<List color={palette.mintDeep} size={18} />}
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]/editions/[editionId]/wishes",
                params: routeParams,
              })
            }
          />
        </Card>
      ) : null}

      {isParticipant &&
      (edition.status === "draft" || edition.status === "open") ? (
        <Card className="gap-3 p-5">
          <View className="flex-row items-center gap-3">
            <CreditCard color={palette.mintDeep} size={22} />
            <View className="flex-1">
              <Text variant="cardTitle">{t("orders.cardTitle")}</Text>
              <Text variant="caption">{t("orders.cardHint")}</Text>
            </View>
          </View>
          <Button
            label={t("orders.open")}
            variant="light"
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]/editions/[editionId]/pick",
                params: routeParams,
              })
            }
          />
        </Card>
      ) : null}

      {isParticipant ? (
        <Card className="gap-3 p-5">
          <View className="flex-row items-center gap-3">
            <MessageCircle color={palette.mintDeep} size={22} />
            <View className="flex-1">
              <Text variant="cardTitle">{t("chat.groupConversation")}</Text>
              <Text variant="caption">{t("chat.groupConversationHint")}</Text>
            </View>
          </View>
          <Button
            label={t("chat.open")}
            variant="light"
            onPress={() =>
              router.push({
                pathname:
                  "/groups/[groupId]/editions/[editionId]/conversations",
                params: routeParams,
              })
            }
          />
        </Card>
      ) : null}

      {(edition.status === "draft" || edition.status === "open") && isAdmin ? (
        <Card className="gap-3 p-5">
          <Text variant="section">{t("editions.drawArea")}</Text>
          <Button
            label={t("draw.constraints.manage")}
            variant="light"
            leftIcon={<Ban color={palette.mintDeep} size={18} />}
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]/editions/[editionId]/constraints",
                params: routeParams,
              })
            }
          />
          {edition.status === "draft" ? (
            <Button
              label={t("editions.open")}
              onPress={() =>
                confirm(
                  t("editions.openConfirmTitle"),
                  t("editions.openConfirmBody"),
                  () => openEdition(groupId!, editionId!),
                )
              }
              disabled={mutating}
            />
          ) : null}
          {edition.status === "open" ? (
            <Button
              label={t("editions.drawArea")}
              variant="pink"
              leftIcon={<Shuffle color={palette.white} size={18} />}
              onPress={() =>
                router.push({
                  pathname: "/groups/[groupId]/editions/[editionId]/draw",
                  params: routeParams,
                })
              }
            />
          ) : null}
        </Card>
      ) : null}

      {edition.status === "drawn" ||
      edition.status === "revealed" ||
      edition.status === "archived" ? (
        <Card className="gap-3 p-5">
          <Text variant="section">{t("editions.drawArea")}</Text>
          <Button
            label={t("editions.myAssignment")}
            leftIcon={<Gift color={palette.white} size={18} />}
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]/editions/[editionId]/assignment",
                params: routeParams,
              })
            }
          />
          {edition.status === "revealed" || edition.status === "archived" ? (
            <Button
              label={t("editions.allAssignments")}
              variant="light"
              leftIcon={<List color={palette.mintDeep} size={18} />}
              onPress={() =>
                router.push({
                  pathname:
                    "/groups/[groupId]/editions/[editionId]/assignments",
                  params: routeParams,
                })
              }
            />
          ) : null}
          {edition.status === "drawn" && isAdmin ? (
            <Button
              label={t("editions.reveal")}
              variant="pink"
              leftIcon={<Eye color={palette.white} size={18} />}
              onPress={() =>
                confirm(
                  t("editions.revealConfirmTitle"),
                  t("editions.revealConfirmBody"),
                  () => revealEdition(groupId!, editionId!),
                )
              }
              disabled={mutating}
            />
          ) : null}
          {edition.status === "revealed" && isAdmin ? (
            <Button
              label={t("editions.archive")}
              variant="light"
              onPress={() =>
                confirm(
                  t("editions.archiveConfirmTitle"),
                  t("editions.archiveConfirmBody"),
                  () => archiveEdition(groupId!, editionId!),
                )
              }
              disabled={mutating}
            />
          ) : null}
        </Card>
      ) : null}
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

import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarPlus, Pencil, Plus, Users } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Share, View } from "react-native";

import { useAuthSession } from "@/auth/auth-session";
import { getGroup } from "@/api/generated/groups/groups";
import {
  deactivateGroupMember,
  issueGroupInvitation,
  listGroupMembers,
  reactivateGroupMember,
} from "@/api/generated/group-members/group-members";
import { listEditions } from "@/api/generated/editions/editions";
import type {
  Edition,
  GroupMember,
  IssuedInvitation,
} from "@/api/generated/models";
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

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuthSession();
  const { groupId: rawGroupId } = useLocalSearchParams<{ groupId: string }>();
  const groupId = parseRouteId(rawGroupId);
  const [mutationError, setMutationError] = useState<unknown>();
  const [mutationId, setMutationId] = useState<number>();
  const [invitation, setInvitation] = useState<IssuedInvitation>();
  const mounted = useMountedRef();
  const load = async (signal: AbortSignal) => {
    if (!groupId) throw new Error(t("common.errors.notFound"));
    const [group, members, editions] = await Promise.all([
      getGroup(groupId, { signal }),
      listGroupMembers(groupId, { signal }),
      listEditions(groupId, { signal }),
    ]);
    return { group, members: members.data, editions: editions.data };
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

  async function changeMemberStatus(member: GroupMember): Promise<void> {
    if (!groupId || mutationId) return;
    setMutationId(member.id);
    setMutationError(undefined);
    try {
      const updated =
        member.status === "inactive"
          ? await reactivateGroupMember(groupId, member.id)
          : await deactivateGroupMember(groupId, member.id);
      if (!mounted.current) return;
      resource.setData((current) =>
        current
          ? {
              ...current,
              members: current.members.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
      resource.refresh();
    }
    if (mounted.current) setMutationId(undefined);
  }

  async function issueInvitation(member: GroupMember): Promise<void> {
    if (!groupId || mutationId) return;
    setMutationId(member.id);
    setMutationError(undefined);
    try {
      const issued = await issueGroupInvitation(groupId, member.id);
      if (!mounted.current) return;
      setInvitation(issued);
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
    }
    if (mounted.current) setMutationId(undefined);
  }

  async function shareInvitation(): Promise<void> {
    if (!invitation || !resource.data) return;
    try {
      const link = Linking.createURL(`/invites/${invitation.inviteToken}`);
      await Share.share({
        message: t("members.shareMessage", {
          name: invitation.member.displayName || t("common.notProvided"),
          group: resource.data.group.name,
          link,
        }),
      });
    } catch (exception) {
      if (mounted.current) setMutationError(exception);
    }
  }

  if (resource.isLoading && !resource.data) {
    return (
      <AppScreen title={t("groups.title")} back>
        <ScreenState kind="loading" title={t("common.loading")} />
      </AppScreen>
    );
  }

  if (!resource.data) {
    return (
      <AppScreen title={t("groups.title")} back>
        <ScreenState
          kind="error"
          title={t("groups.loadError")}
          message={apiErrorMessage(resource.error, t)}
          retryLabel={t("common.retry")}
          onRetry={resource.refresh}
        />
      </AppScreen>
    );
  }

  const { group, members, editions } = resource.data;
  return (
    <AppScreen
      title={group.name}
      subtitle={t("groups.detailSubtitle")}
      back
      action={
        isAdmin ? (
          <IconButton
            accessibilityLabel={t("groups.edit")}
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]/edit",
                params: { groupId: String(group.id) },
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
      <Card className="gap-2 p-5">
        <Text variant="section">{t("groups.about")}</Text>
        <Text variant="body" className="text-ink-soft">
          {group.description || t("groups.noDescription")}
        </Text>
      </Card>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="section">{t("groups.members")}</Text>
          {isAdmin ? (
            <Button
              size="sm"
              label={t("groups.addMember")}
              leftIcon={<Plus color={palette.white} size={17} />}
              onPress={() =>
                router.push({
                  pathname: "/groups/[groupId]/members/new",
                  params: { groupId: String(group.id) },
                })
              }
            />
          ) : null}
        </View>
        {members.length ? (
          members.map((member) => (
            <MemberSummary
              key={member.id}
              member={member}
              canEdit={isAdmin}
              canManage={isAdmin && member.userId !== user?.id}
              busy={mutationId === member.id}
              onEdit={() =>
                router.push({
                  pathname: "/groups/[groupId]/members/[memberId]/edit",
                  params: {
                    groupId: String(group.id),
                    memberId: String(member.id),
                  },
                })
              }
              onChangeStatus={() => void changeMemberStatus(member)}
              onIssueInvitation={() => void issueInvitation(member)}
            />
          ))
        ) : (
          <Text variant="caption">{t("groups.noMembers")}</Text>
        )}
        {invitation ? (
          <Card className="gap-3 border border-outline p-4">
            <Text variant="cardTitle">
              {t("members.inviteFor", {
                name: invitation.member.displayName || t("common.notProvided"),
              })}
            </Text>
            <Text variant="caption">{t("members.inviteHint")}</Text>
            <Text selectable variant="caption">
              {Linking.createURL(`/invites/${invitation.inviteToken}`)}
            </Text>
            <Button
              size="sm"
              label={t("members.share")}
              onPress={() => void shareInvitation()}
            />
          </Card>
        ) : null}
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="section">{t("groups.editions")}</Text>
          {isAdmin ? (
            <Button
              size="sm"
              label={t("groups.addEdition")}
              leftIcon={<CalendarPlus color={palette.white} size={17} />}
              onPress={() =>
                router.push({
                  pathname: "/groups/[groupId]/editions/new",
                  params: { groupId: String(group.id) },
                })
              }
            />
          ) : null}
        </View>
        {editions.length ? (
          editions.map((edition) => (
            <EditionSummary key={edition.id} edition={edition} />
          ))
        ) : (
          <Text variant="caption">{t("groups.noEditions")}</Text>
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

function MemberSummary({
  member,
  canEdit,
  canManage,
  busy,
  onEdit,
  onChangeStatus,
  onIssueInvitation,
}: {
  member: GroupMember;
  canEdit: boolean;
  canManage: boolean;
  busy: boolean;
  onEdit: () => void;
  onChangeStatus: () => void;
  onIssueInvitation: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <View className="h-11 w-11 items-center justify-center rounded-tile bg-mint-tint">
        <Users color={palette.mint} size={21} />
      </View>
      <View className="flex-1">
        <Text variant="cardTitle">
          {member.displayName || t("common.notProvided")}
        </Text>
        <Text variant="caption">
          {t(`groups.${member.role}`)} · {t(`groups.status.${member.status}`)}
        </Text>
      </View>
      {canEdit || canManage ? (
        <View className="items-end gap-2">
          {canEdit ? (
            <Button
              size="sm"
              label={t("common.edit")}
              variant="light"
              disabled={busy}
              onPress={onEdit}
            />
          ) : null}
          {member.status !== "active" ? (
            <Button
              size="sm"
              label={
                member.status === "invited"
                  ? t("members.rotateInvite")
                  : t("members.invite")
              }
              variant="light"
              disabled={busy}
              onPress={onIssueInvitation}
            />
          ) : null}
          <Button
            size="sm"
            label={
              member.status === "inactive"
                ? t("members.reactivate")
                : t("members.deactivate")
            }
            variant="light"
            disabled={busy}
            onPress={onChangeStatus}
          />
        </View>
      ) : (
        <Badge
          variant={member.status === "active" ? "success" : "neutral"}
          label={t(`groups.status.${member.status}`)}
        />
      )}
    </Card>
  );
}

function EditionSummary({ edition }: { edition: Edition }) {
  const { t } = useTranslation();
  const details = [
    formatDate(edition.eventDate),
    formatCurrency(edition.budgetCents, edition.currency),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      className="active:opacity-75"
      accessibilityRole="button"
      accessibilityLabel={edition.name}
      onPress={() =>
        router.push({
          pathname: "/groups/[groupId]/editions/[editionId]",
          params: {
            groupId: String(edition.groupId),
            editionId: String(edition.id),
          },
        })
      }
    >
      <Card className="gap-2 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="cardTitle" className="flex-1">
            {edition.name}
          </Text>
          <Badge
            label={t(`editions.status.${edition.status}`)}
            variant={
              edition.status === "drawn" || edition.status === "revealed"
                ? "success"
                : "neutral"
            }
          />
        </View>
        {details ? <Text variant="caption">{details}</Text> : null}
      </Card>
    </Pressable>
  );
}

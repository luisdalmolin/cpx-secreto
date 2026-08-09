import { router, useLocalSearchParams } from "expo-router";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { normalizeApiError } from "@/api/errors";
import {
  listGroupMembers,
  updateGroupMember,
} from "@/api/generated/group-members/group-members";
import type { GroupMember } from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { FormField } from "@/components/common/form-field";
import { ScreenState } from "@/components/common/screen-state";
import { Button, Card, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

interface MemberFormState {
  displayName: string;
  email: string;
  role: "member" | "admin";
}

function mergeMemberForm(
  state: MemberFormState,
  changes: Partial<MemberFormState>,
): MemberFormState {
  return { ...state, ...changes };
}

export default function EditMemberScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    groupId: string;
    memberId: string;
  }>();
  const groupId = parseRouteId(params.groupId);
  const memberId = parseRouteId(params.memberId);
  const resource = useFocusResource(async (signal: AbortSignal) => {
    if (!groupId || !memberId) {
      throw new Error(t("common.errors.notFound"));
    }
    const members = await listGroupMembers(groupId, { signal });
    const member = members.data.find((item) => item.id === memberId);
    if (!member) throw new Error(t("common.errors.notFound"));
    return member;
  });

  if (!resource.data || !groupId) {
    return (
      <AppScreen title={t("members.editTitle")} back>
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

  return (
    <EditMemberForm
      key={resource.data.id}
      groupId={groupId}
      member={resource.data}
    />
  );
}

function EditMemberForm({
  groupId,
  member,
}: {
  groupId: number;
  member: GroupMember;
}) {
  const { t } = useTranslation();
  const [form, updateForm] = useReducer(mergeMemberForm, {
    displayName: member.displayName ?? "",
    email: member.email ?? "",
    role: member.role,
  });
  const [error, setError] = useState<unknown>();
  const [mutation, setMutation] = useState<"idle" | "saving">("idle");
  const mounted = useMountedRef();
  const fields = normalizeApiError(error).fields;
  const saving = mutation === "saving";

  async function save(): Promise<void> {
    if (saving) return;
    setError(undefined);
    setMutation("saving");
    const result = await updateGroupMember(groupId, member.id, {
      displayName: form.displayName.trim() || null,
      email: form.email.trim() || null,
      role: form.role,
    }).then(
      () => ({ ok: true as const }),
      (exception: unknown) => ({ ok: false as const, exception }),
    );
    if (!mounted.current) return;
    setMutation("idle");
    if (!result.ok) {
      setError(result.exception);
      return;
    }
    router.back();
  }

  return (
    <AppScreen
      title={t("members.editTitle")}
      subtitle={t("members.editSubtitle")}
      back
    >
      <Card className="gap-4 p-5">
        <FormField
          label={t("members.displayName")}
          value={form.displayName}
          onChangeText={(displayName) => updateForm({ displayName })}
          autoCapitalize="words"
          error={fields?.displayName}
        />
        <FormField
          label={t("members.email")}
          value={form.email}
          onChangeText={(email) => updateForm({ email })}
          keyboardType="email-address"
          autoCapitalize="none"
          error={fields?.email}
        />
        <View className="gap-2">
          <Text variant="bodyBold">{t("members.role")}</Text>
          <View className="flex-row gap-2">
            <Button
              label={t("members.roleMember")}
              variant={form.role === "member" ? "primary" : "light"}
              accessibilityState={{ selected: form.role === "member" }}
              disabled={saving}
              onPress={() => updateForm({ role: "member" })}
            />
            <Button
              label={t("members.roleAdmin")}
              variant={form.role === "admin" ? "primary" : "light"}
              accessibilityState={{ selected: form.role === "admin" }}
              disabled={saving}
              onPress={() => updateForm({ role: "admin" })}
            />
          </View>
          <Text variant="caption">{t("members.roleHint")}</Text>
        </View>
        {error ? (
          <Text className="text-pink-deep" accessibilityRole="alert">
            {apiErrorMessage(error, t)}
          </Text>
        ) : null}
        <Button
          label={t("common.save")}
          disabled={saving}
          onPress={() => void save()}
          rightIcon={
            saving ? <ActivityIndicator color={palette.white} /> : undefined
          }
        />
      </Card>
    </AppScreen>
  );
}

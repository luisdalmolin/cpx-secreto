import { router, useLocalSearchParams } from "expo-router";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert } from "react-native";

import { normalizeApiError } from "@/api/errors";
import {
  deleteGroup,
  getGroup,
  updateGroup,
} from "@/api/generated/groups/groups";
import type { Group } from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { FormField } from "@/components/common/form-field";
import { ScreenState } from "@/components/common/screen-state";
import { Button, Card, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

interface GroupFormState {
  name: string;
  description: string;
}

function mergeGroupForm(
  state: GroupFormState,
  changes: Partial<GroupFormState>,
): GroupFormState {
  return { ...state, ...changes };
}

export default function EditGroupScreen() {
  const { t } = useTranslation();
  const { groupId: rawGroupId } = useLocalSearchParams<{ groupId: string }>();
  const groupId = parseRouteId(rawGroupId);
  const resource = useFocusResource((signal: AbortSignal) => {
    if (!groupId) throw new Error(t("common.errors.notFound"));
    return getGroup(groupId, { signal });
  });

  if (!resource.data) {
    return (
      <AppScreen title={t("groups.editTitle")} back>
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

  return <EditGroupForm key={resource.data.id} group={resource.data} />;
}

function EditGroupForm({ group }: { group: Group }) {
  const { t } = useTranslation();
  const [form, updateForm] = useReducer(mergeGroupForm, {
    name: group.name,
    description: group.description ?? "",
  });
  const [error, setError] = useState<unknown>();
  const [mutation, setMutation] = useState<"idle" | "saving" | "deleting">(
    "idle",
  );
  const mounted = useMountedRef();
  const fields = normalizeApiError(error).fields;
  const saving = mutation === "saving";
  const deleting = mutation === "deleting";
  const busy = mutation !== "idle";

  async function save(): Promise<void> {
    if (busy || !form.name.trim()) return;
    setError(undefined);
    setMutation("saving");
    const result = await updateGroup(group.id, {
      name: form.name.trim(),
      description: form.description.trim() || null,
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

  async function remove(): Promise<void> {
    if (busy) return;
    setError(undefined);
    setMutation("deleting");
    const result = await deleteGroup(group.id).then(
      () => ({ ok: true as const }),
      (exception: unknown) => ({ ok: false as const, exception }),
    );
    if (!mounted.current) return;
    setMutation("idle");
    if (!result.ok) {
      setError(result.exception);
      return;
    }
    router.dismissTo("/groups");
  }

  function confirmDelete(): void {
    Alert.alert(t("groups.deleteConfirmTitle"), t("groups.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => void remove(),
      },
    ]);
  }

  return (
    <AppScreen
      title={t("groups.editTitle")}
      subtitle={t("groups.editSubtitle")}
      back
    >
      <Card className="gap-4 p-5">
        <FormField
          label={t("groups.name")}
          value={form.name}
          onChangeText={(name) => updateForm({ name })}
          autoCapitalize="words"
          error={fields?.name}
        />
        <FormField
          label={t("groups.description")}
          value={form.description}
          onChangeText={(description) => updateForm({ description })}
          multiline
          numberOfLines={4}
          error={fields?.description}
        />
        {error ? (
          <Text className="text-pink-deep" accessibilityRole="alert">
            {apiErrorMessage(error, t)}
          </Text>
        ) : null}
        <Button
          label={t("common.save")}
          disabled={busy || !form.name.trim()}
          onPress={() => void save()}
          rightIcon={
            saving ? <ActivityIndicator color={palette.white} /> : undefined
          }
        />
      </Card>

      <Card className="gap-3 border border-pink-soft p-5">
        <Text variant="section">{t("groups.dangerTitle")}</Text>
        <Text variant="caption">{t("groups.dangerHint")}</Text>
        <Button
          label={deleting ? t("groups.deleting") : t("groups.delete")}
          variant="pink"
          disabled={busy}
          onPress={confirmDelete}
          rightIcon={
            deleting ? <ActivityIndicator color={palette.white} /> : undefined
          }
        />
      </Card>
    </AppScreen>
  );
}

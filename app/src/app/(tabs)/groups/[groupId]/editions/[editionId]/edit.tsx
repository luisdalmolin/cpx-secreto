import { router, useLocalSearchParams } from "expo-router";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert } from "react-native";

import { normalizeApiError } from "@/api/errors";
import {
  deleteEdition,
  getEdition,
  updateEdition,
} from "@/api/generated/editions/editions";
import type { Edition } from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { FormField } from "@/components/common/form-field";
import { ScreenState } from "@/components/common/screen-state";
import { Button, Card, Text } from "@/components/ui";
import {
  isValidIsoDate,
  parseBudgetCents,
} from "@/features/editions/presentation";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

interface EditionFormState {
  name: string;
  budget: string;
  eventDate: string;
}

function mergeEditionForm(
  state: EditionFormState,
  changes: Partial<EditionFormState>,
): EditionFormState {
  return { ...state, ...changes };
}

export default function EditEditionScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const resource = useFocusResource((signal: AbortSignal) => {
    if (!groupId || !editionId) {
      throw new Error(t("common.errors.notFound"));
    }
    return getEdition(groupId, editionId, { signal });
  });

  if (!resource.data || !groupId) {
    return (
      <AppScreen title={t("editions.editTitle")} back>
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
    <EditEditionForm
      key={resource.data.id}
      groupId={groupId}
      edition={resource.data}
    />
  );
}

function EditEditionForm({
  groupId,
  edition,
}: {
  groupId: number;
  edition: Edition;
}) {
  const { t } = useTranslation();
  const [form, updateForm] = useReducer(mergeEditionForm, {
    name: edition.name,
    budget: budgetInput(edition.budgetCents),
    eventDate: edition.eventDate ?? "",
  });
  const [budgetError, setBudgetError] = useState<string>();
  const [eventDateError, setEventDateError] = useState<string>();
  const [error, setError] = useState<unknown>();
  const [mutation, setMutation] = useState<"idle" | "saving" | "deleting">(
    "idle",
  );
  const mounted = useMountedRef();
  const fields = normalizeApiError(error).fields;
  const saving = mutation === "saving";
  const deleting = mutation === "deleting";
  const busy = mutation !== "idle";
  const canEdit = edition.status === "draft" || edition.status === "open";
  const canDelete = edition.status === "draft";

  async function save(): Promise<void> {
    if (busy || !canEdit || !form.name.trim()) return;
    const normalizedBudget = form.budget.trim();
    const budgetCents = parseBudgetCents(normalizedBudget);
    const normalizedEventDate = form.eventDate.trim();
    if (normalizedBudget && budgetCents === null) {
      setBudgetError(t("editions.invalidBudget"));
      return;
    }
    if (normalizedEventDate && !isValidIsoDate(normalizedEventDate)) {
      setEventDateError(t("editions.invalidEventDate"));
      return;
    }

    setBudgetError(undefined);
    setEventDateError(undefined);
    setError(undefined);
    setMutation("saving");
    const result = await updateEdition(groupId, edition.id, {
      name: form.name.trim(),
      budgetCents,
      eventDate: normalizedEventDate || null,
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
    if (busy || !canDelete) return;
    setError(undefined);
    setMutation("deleting");
    const result = await deleteEdition(groupId, edition.id).then(
      () => ({ ok: true as const }),
      (exception: unknown) => ({ ok: false as const, exception }),
    );
    if (!mounted.current) return;
    setMutation("idle");
    if (!result.ok) {
      setError(result.exception);
      return;
    }
    router.dismissTo({
      pathname: "/groups/[groupId]",
      params: { groupId: String(groupId) },
    });
  }

  function confirmDelete(): void {
    Alert.alert(
      t("editions.deleteConfirmTitle"),
      t("editions.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => void remove(),
        },
      ],
    );
  }

  return (
    <AppScreen
      title={t("editions.editTitle")}
      subtitle={t("editions.editSubtitle")}
      back
    >
      <Card className="gap-4 p-5">
        <FormField
          label={t("editions.name")}
          value={form.name}
          onChangeText={(name) => updateForm({ name })}
          autoCapitalize="words"
          editable={canEdit && !busy}
          error={fields?.name}
        />
        <FormField
          label={t("editions.budget")}
          value={form.budget}
          onChangeText={(value) => {
            updateForm({ budget: value });
            setBudgetError(undefined);
          }}
          keyboardType="decimal-pad"
          editable={canEdit && !busy}
          error={budgetError || fields?.budgetCents}
        />
        <FormField
          label={t("editions.eventDate")}
          value={form.eventDate}
          onChangeText={(value) => {
            updateForm({ eventDate: value });
            setEventDateError(undefined);
          }}
          keyboardType="numbers-and-punctuation"
          editable={canEdit && !busy}
          error={eventDateError || fields?.eventDate}
        />
        <Text variant="caption">{t("editions.type")}</Text>
        {!canEdit ? (
          <Text variant="caption">{t("editions.editLocked")}</Text>
        ) : null}
        {error ? (
          <Text className="text-pink-deep" accessibilityRole="alert">
            {apiErrorMessage(error, t)}
          </Text>
        ) : null}
        <Button
          label={t("common.save")}
          disabled={busy || !canEdit || !form.name.trim()}
          onPress={() => void save()}
          rightIcon={
            saving ? <ActivityIndicator color={palette.white} /> : undefined
          }
        />
      </Card>

      {canDelete ? (
        <Card className="gap-3 border border-pink-soft p-5">
          <Text variant="section">{t("editions.dangerTitle")}</Text>
          <Text variant="caption">{t("editions.dangerHint")}</Text>
          <Button
            label={deleting ? t("editions.deleting") : t("editions.delete")}
            variant="pink"
            disabled={busy}
            onPress={confirmDelete}
            rightIcon={
              deleting ? <ActivityIndicator color={palette.white} /> : undefined
            }
          />
        </Card>
      ) : null}
    </AppScreen>
  );
}

function budgetInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

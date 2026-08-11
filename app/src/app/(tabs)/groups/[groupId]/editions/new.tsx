import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";

import { createEdition } from "@/api/generated/editions/editions";
import { normalizeApiError } from "@/api/errors";
import { AppScreen } from "@/components/common/app-screen";
import { FormField } from "@/components/common/form-field";
import { Button, Card, Text } from "@/components/ui";
import {
  isValidIsoDate,
  parseBudgetCents,
} from "@/features/editions/presentation";
import { withLoading } from "@/features/shared/loading";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { palette } from "@/theme/tokens";

export default function NewEditionScreen() {
  const { t } = useTranslation();
  const { groupId: rawGroupId } = useLocalSearchParams<{ groupId: string }>();
  const groupId = parseRouteId(rawGroupId);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDateError, setEventDateError] = useState<string>();
  const [error, setError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const fields = normalizeApiError(error).fields;

  async function submit(): Promise<void> {
    if (!groupId) return;
    const normalizedEventDate = eventDate.trim();
    if (normalizedEventDate && !isValidIsoDate(normalizedEventDate)) {
      setEventDateError(t("editions.invalidEventDate"));
      return;
    }

    setEventDateError(undefined);
    setError(undefined);
    try {
      const edition = await withLoading(setSubmitting, () =>
        createEdition(groupId, {
          name: name.trim(),
          budgetCents: parseBudgetCents(budget),
          eventDate: normalizedEventDate || null,
        }),
      );
      router.replace({
        pathname: "/groups/[groupId]/editions/[editionId]",
        params: { groupId: String(groupId), editionId: String(edition.id) },
      });
    } catch (exception) {
      setError(exception);
    }
  }

  return (
    <AppScreen
      title={t("editions.newTitle")}
      subtitle={t("editions.newSubtitle")}
      back
    >
      <Card className="gap-4 p-5">
        <FormField
          label={t("editions.name")}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          error={fields?.name}
        />
        <FormField
          label={t("editions.budget")}
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
          error={fields?.budgetCents}
        />
        <FormField
          label={t("editions.eventDate")}
          value={eventDate}
          onChangeText={(value) => {
            setEventDate(value);
            setEventDateError(undefined);
          }}
          keyboardType="numbers-and-punctuation"
          error={eventDateError || fields?.eventDate}
        />
        <Text variant="caption">{t("editions.type")}</Text>
        {error ? (
          <Text className="text-pink-deep" accessibilityRole="alert">
            {apiErrorMessage(error, t)}
          </Text>
        ) : null}
        <Button
          label={t("editions.create")}
          disabled={submitting || !name.trim() || !groupId}
          onPress={() => void submit()}
          rightIcon={
            submitting ? <ActivityIndicator color={palette.white} /> : undefined
          }
        />
      </Card>
    </AppScreen>
  );
}

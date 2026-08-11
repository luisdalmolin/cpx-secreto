import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";

import { createGroup } from "@/api/generated/groups/groups";
import { normalizeApiError } from "@/api/errors";
import { AppScreen } from "@/components/common/app-screen";
import { FormField } from "@/components/common/form-field";
import { Button, Card, Text } from "@/components/ui";
import { withLoading } from "@/features/shared/loading";
import { apiErrorMessage } from "@/features/shared/presentation";
import { palette } from "@/theme/tokens";

export default function NewGroupScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const fields = normalizeApiError(error).fields;

  async function submit(): Promise<void> {
    setError(undefined);
    try {
      const group = await withLoading(setSubmitting, () =>
        createGroup({
          name: name.trim(),
          description: description.trim() || null,
        }),
      );
      router.replace({
        pathname: "/groups/[groupId]",
        params: { groupId: String(group.id) },
      });
    } catch (exception) {
      setError(exception);
    }
  }

  return (
    <AppScreen
      title={t("groups.newTitle")}
      subtitle={t("groups.newSubtitle")}
      back
    >
      <Card className="gap-4 p-5">
        <FormField
          label={t("groups.name")}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          error={fields?.name}
        />
        <FormField
          label={t("groups.description")}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          error={fields?.description}
        />
        {error ? <FormFieldError message={apiErrorMessage(error, t)} /> : null}
        <Button
          label={t("common.create")}
          disabled={submitting || !name.trim()}
          onPress={() => void submit()}
          rightIcon={
            submitting ? <ActivityIndicator color={palette.white} /> : undefined
          }
        />
      </Card>
    </AppScreen>
  );
}

function FormFieldError({ message }: { message: string }) {
  return (
    <Text className="text-center text-pink-deep" accessibilityRole="alert">
      {message}
    </Text>
  );
}

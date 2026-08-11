import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";

import { useAuthSession } from "@/auth/auth-session";
import { normalizeApiError } from "@/api/errors";
import { AppScreen } from "@/components/common/app-screen";
import { FormField } from "@/components/common/form-field";
import { Button, Card, Text } from "@/components/ui";
import { withLoading } from "@/features/shared/loading";
import { apiErrorMessage } from "@/features/shared/presentation";
import { i18n } from "@/i18n";
import { palette } from "@/theme/tokens";

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuthSession();
  const [name, setName] = useState(user?.name ?? "");
  const [error, setError] = useState<unknown>();
  const [saving, setSaving] = useState(false);
  const fields = normalizeApiError(error).fields;

  async function save(): Promise<void> {
    setError(undefined);
    try {
      await withLoading(setSaving, async () => {
        await updateProfile({ name: name.trim(), locale: "pt-BR" });
        await i18n.changeLanguage("pt-BR");
      });
      router.back();
    } catch (exception) {
      setError(exception);
    }
  }

  return (
    <AppScreen
      title={t("profile.editTitle")}
      subtitle={t("profile.editSubtitle")}
      back
    >
      <Card className="gap-4 p-5">
        <FormField
          label={t("profile.name")}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          error={fields?.name}
        />
        <FormField
          label={t("profile.locale")}
          value={t("profile.localeValue")}
          editable={false}
        />
        {error ? (
          <Text
            className="text-center text-pink-deep"
            accessibilityRole="alert"
          >
            {apiErrorMessage(error, t)}
          </Text>
        ) : null}
        <Button
          label={t("common.save")}
          disabled={saving || !name.trim()}
          onPress={() => void save()}
          rightIcon={
            saving ? <ActivityIndicator color={palette.white} /> : undefined
          }
        />
      </Card>
    </AppScreen>
  );
}

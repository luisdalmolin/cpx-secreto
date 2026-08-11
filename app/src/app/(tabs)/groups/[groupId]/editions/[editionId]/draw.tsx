import { router, useLocalSearchParams } from "expo-router";
import { Ban, CheckCircle, Shuffle } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

import { performDraw, preflightDraw } from "@/api/generated/draw/draw";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { Button, Card, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

export default function DrawScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const [mutationError, setMutationError] = useState<unknown>();
  const [drawing, setDrawing] = useState(false);
  const mounted = useMountedRef();
  const load = (signal: AbortSignal) => {
    if (!groupId || !editionId)
      return Promise.reject(new Error(t("common.errors.notFound")));
    return preflightDraw(groupId, editionId, { signal });
  };
  const resource = useFocusResource(load);

  async function draw(): Promise<void> {
    if (!groupId || !editionId || drawing) return;
    setMutationError(undefined);
    setDrawing(true);
    try {
      const receipt = await performDraw(groupId, editionId);
      if (!mounted.current) return;
      Alert.alert(t("draw.success", { count: receipt.participantCount }));
      setDrawing(false);
      router.replace({
        pathname: "/groups/[groupId]/editions/[editionId]/assignment",
        params: { groupId: String(groupId), editionId: String(editionId) },
      });
      return;
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
      resource.refresh();
    }
    if (mounted.current) setDrawing(false);
  }

  function confirmDraw(): void {
    Alert.alert(t("draw.confirmTitle"), t("draw.confirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("draw.run"), style: "destructive", onPress: () => void draw() },
    ]);
  }

  return (
    <AppScreen title={t("draw.title")} subtitle={t("draw.subtitle")} back>
      <Button
        label={t("draw.constraints.manage")}
        variant="light"
        leftIcon={<Ban color={palette.mintDeep} size={18} />}
        disabled={!groupId || !editionId || drawing}
        onPress={() =>
          router.push({
            pathname: "/groups/[groupId]/editions/[editionId]/constraints",
            params: {
              groupId: String(groupId),
              editionId: String(editionId),
            },
          })
        }
      />
      {resource.isLoading && !resource.data ? (
        <ScreenState kind="loading" title={t("draw.checking")} />
      ) : null}
      {resource.error && !resource.data ? (
        <ScreenState
          kind="error"
          title={t("draw.blocked")}
          message={apiErrorMessage(resource.error, t)}
          retryLabel={t("common.retry")}
          onRetry={resource.refresh}
        />
      ) : null}
      {resource.data ? (
        <Card className="items-center gap-4 p-6">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-mint-tint">
            {resource.data.ready ? (
              <CheckCircle color={palette.mint} size={34} />
            ) : (
              <Shuffle color={palette.pink} size={34} />
            )}
          </View>
          <Text variant="section" className="text-center">
            {t(resource.data.ready ? "draw.ready" : "draw.blocked")}
          </Text>
          <Text variant="caption" className="text-center">
            {resource.data.ready
              ? t("draw.readyHint", { count: resource.data.participantCount })
              : t("draw.blockedHint")}
          </Text>
          {mutationError ? (
            <Text
              className="text-center text-pink-deep"
              accessibilityRole="alert"
            >
              {apiErrorMessage(mutationError, t)}
            </Text>
          ) : null}
          <Button
            label={t("draw.run")}
            variant="pink"
            disabled={!resource.data.ready || drawing}
            onPress={confirmDraw}
          />
        </Card>
      ) : null}
    </AppScreen>
  );
}

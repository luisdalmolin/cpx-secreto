import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ExternalLink, Eye, Gift, Heart } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { getMyAssignment } from "@/api/generated/assignments/assignments";
import type { MyAssignment, Product } from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { ProductDetails } from "@/components/wishes/product-details";
import { Button, Card, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { openProduct } from "@/features/products/open-product";
import { palette } from "@/theme/tokens";

export default function MyAssignmentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const [assignment, setAssignment] = useState<MyAssignment>();
  const [error, setError] = useState<unknown>();
  const [revealing, setRevealing] = useState(false);
  const [productLinkError, setProductLinkError] = useState<string>();
  const requestRef = useRef<AbortController | undefined>(undefined);

  useFocusEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = undefined;
    setAssignment(undefined);
    setError(undefined);
    setRevealing(false);
    setProductLinkError(undefined);
  });

  async function reveal(): Promise<void> {
    if (!groupId || !editionId || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setError(undefined);
    setRevealing(true);
    try {
      // Privacy boundary: this is the only place that requests the receiver,
      // and it only runs after an explicit user gesture.
      const result = await getMyAssignment(groupId, editionId, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestRef.current !== controller)
        return;
      setAssignment(result);
    } catch (exception) {
      if (controller.signal.aborted || requestRef.current !== controller)
        return;
      setError(exception);
    }
    if (requestRef.current === controller) {
      requestRef.current = undefined;
      setRevealing(false);
    }
  }

  async function openProductLink(product: Product): Promise<void> {
    setProductLinkError(undefined);
    const opened = await openProduct(product);
    if (!opened) setProductLinkError(t("products.openError"));
  }

  return (
    <AppScreen title={t("editions.myAssignment")} back>
      <Card
        shadow="hero"
        className="items-center gap-4 overflow-hidden border border-hairline p-7"
      >
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-mint-tint">
          <Gift color={palette.mint} size={34} />
        </View>
        {assignment ? (
          <>
            <Text variant="eyebrow" className="text-mint">
              {t("assignments.youDrew")}
            </Text>
            <Text
              variant="hero"
              className="text-center"
              accessibilityLiveRegion="polite"
            >
              {assignment.receiver.displayName}
            </Text>
            <Text variant="caption" className="text-center">
              {t("assignments.privateHint")}
            </Text>
          </>
        ) : (
          <>
            <Text variant="section" className="text-center">
              {t("assignments.sealedTitle")}
            </Text>
            <Text variant="caption" className="text-center">
              {t("assignments.sealedBody")}
            </Text>
            <Button
              label={
                revealing
                  ? t("assignments.revealing")
                  : t("assignments.revealMine")
              }
              leftIcon={
                revealing ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <Eye color={palette.white} size={18} />
                )
              }
              disabled={revealing || !groupId || !editionId}
              onPress={() => void reveal()}
              accessibilityHint={t("assignments.sealedBody")}
            />
          </>
        )}
        {error ? (
          <Text
            className="text-center text-pink-deep"
            accessibilityRole="alert"
          >
            {apiErrorMessage(error, t)}
          </Text>
        ) : null}
      </Card>
      {assignment ? (
        <>
          <View className="flex-row items-center gap-2">
            <Heart color={palette.pink} size={20} />
            <Text variant="section">
              {t("assignments.wishesTitle", {
                name: assignment.receiver.displayName,
              })}
            </Text>
          </View>
          {assignment.wishes.length === 0 ? (
            <ScreenState kind="empty" title={t("assignments.wishesEmpty")} />
          ) : (
            <View className="gap-3">
              {assignment.wishes.map((wish, index) => {
                const product = wish.product;

                return (
                  <Card key={wish.id} className="gap-3 p-4">
                    <View className="flex-row items-start gap-3">
                      <View className="h-7 w-7 items-center justify-center rounded-full bg-mint-tint">
                        <Text variant="label" className="text-mint-deep">
                          {index + 1}
                        </Text>
                      </View>
                      <Text className="flex-1">{wish.description}</Text>
                    </View>
                    {product ? (
                      <View className="gap-3 rounded-tile bg-cloud/70 p-3">
                        <ProductDetails product={product} />
                        <Button
                          label={t("products.open")}
                          variant="light"
                          size="sm"
                          leftIcon={
                            <ExternalLink color={palette.mintDeep} size={16} />
                          }
                          onPress={() => void openProductLink(product)}
                        />
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
          {productLinkError ? (
            <Text className="text-pink-deep" accessibilityRole="alert">
              {productLinkError}
            </Text>
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}

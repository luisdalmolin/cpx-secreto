import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { Order } from "@/api/generated/models";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { Badge, Button, Card, Text } from "@/components/ui";
import { pollOrder } from "@/features/orders/payment";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { palette } from "@/theme/tokens";

export default function PaymentReturnScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    result: string;
    orderId?: string;
  }>();
  const orderId = parseRouteId(params.orderId);
  const load = async (signal: AbortSignal) => {
    if (!orderId) throw new Error(t("orders.return.invalid"));
    return pollOrder(orderId, signal);
  };
  const resource = useFocusResource(load);

  if (!resource.data) {
    return (
      <AppScreen title={t("orders.return.title")}>
        <ScreenState
          kind={resource.isLoading ? "loading" : "error"}
          title={
            resource.isLoading
              ? t("orders.return.verifying")
              : t("orders.return.loadError")
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
    <AppScreen
      title={t("orders.return.title")}
      subtitle={t("orders.return.authoritativeHint")}
      refreshing={resource.isRefreshing}
      onRefresh={resource.refresh}
    >
      <PaymentResult order={resource.data} />
      <Button
        label={t("orders.return.refresh")}
        variant="light"
        leftIcon={<RefreshCw color={palette.mintDeep} size={18} />}
        onPress={resource.refresh}
      />
      <Button
        label={t("orders.return.home")}
        onPress={() => router.replace("/")}
      />
    </AppScreen>
  );
}

function PaymentResult({ order }: { order: Order }) {
  const { t } = useTranslation();
  const Icon =
    order.status === "paid"
      ? CheckCircle2
      : order.status === "pending"
        ? Clock3
        : XCircle;

  return (
    <Card
      className="items-center gap-3 border border-hairline p-6"
      accessibilityLiveRegion="polite"
    >
      <Icon
        color={order.status === "paid" ? palette.mint : palette.pink}
        size={34}
      />
      <View className="items-center gap-2">
        <Badge
          label={t(`orders.status.${order.status}`)}
          variant={order.status === "paid" ? "success" : "neutral"}
        />
        <Text variant="cardTitle" className="text-center">
          {t(`orders.return.statusTitle.${order.status}`)}
        </Text>
        <Text variant="caption" className="text-center">
          {t(`orders.statusBody.${order.status}`)}
        </Text>
      </View>
    </Card>
  );
}

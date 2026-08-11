import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  CheckCircle2,
  CreditCard,
  RefreshCw,
  RotateCcw,
} from "lucide-react-native";
import { useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, AppState, View } from "react-native";

import { listEditionParticipants } from "@/api/generated/edition-participants/edition-participants";
import { getEdition } from "@/api/generated/editions/editions";
import type { EditionParticipant, Order } from "@/api/generated/models";
import {
  createPickOrder,
  getOrder,
  listOrders,
  refundOrder,
} from "@/api/generated/orders/orders";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { ParticipantChoice } from "@/components/draw";
import { Badge, Button, Card, Text } from "@/components/ui";
import { isSafeCheckoutUrl } from "@/features/orders/payment-return";
import { parsePaymentReturnUrl, pollOrder } from "@/features/orders/payment";
import {
  apiErrorMessage,
  formatCurrency,
  parseRouteId,
} from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

type Mutation = "creating" | "opening" | "refreshing" | "refunding";

export default function PickPurchaseScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const [selectedReceiverId, setSelectedReceiverId] = useState<number>();
  const [mutation, setMutation] = useState<Mutation>();
  const [mutationError, setMutationError] = useState<unknown>();
  const [checkoutUrlError, setCheckoutUrlError] = useState(false);
  const mounted = useMountedRef();
  const load = async (signal: AbortSignal) => {
    if (!groupId || !editionId) throw new Error(t("common.errors.notFound"));
    const [edition, participants, orders] = await Promise.all([
      getEdition(groupId, editionId, { signal }),
      listEditionParticipants(groupId, editionId, { signal }),
      listOrders({ "filter[edition_id]": editionId }, { signal }),
    ]);
    const order = orders.data.find(
      (item) => item.editionId === editionId && item.type === "pick_purchase",
    );

    return { edition, participants, order };
  };
  const resource = useFocusResource(load);
  const order = resource.data?.order;
  const receiverParticipantId =
    selectedReceiverId ?? order?.receiverParticipantId ?? undefined;
  const setResourceData = resource.setData;

  function updateOrder(updated: Order): void {
    if (!mounted.current) return;
    setResourceData((current) =>
      current ? { ...current, order: updated } : current,
    );
  }

  async function refreshAuthoritativeOrder(
    orderId: number,
    poll = false,
  ): Promise<void> {
    try {
      const updated = poll ? await pollOrder(orderId) : await getOrder(orderId);
      updateOrder(updated);
    } catch (error) {
      if (mounted.current) setMutationError(error);
    }
  }

  const onPaymentReturn = useEffectEvent((url: string) => {
    const paymentReturn = parsePaymentReturnUrl(url);

    if (!order || paymentReturn?.orderId !== order.id) return;
    void WebBrowser.dismissBrowser().catch(() => undefined);
    void refreshAuthoritativeOrder(order.id, true);
  });

  const onAppStateChange = useEffectEvent((state: string) => {
    if (state === "active" && order?.status === "pending") {
      void refreshAuthoritativeOrder(order.id, true);
    }
  });

  useEffect(() => {
    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      onPaymentReturn(url);
    });
    const appStateSubscription = AppState.addEventListener(
      "change",
      onAppStateChange,
    );

    return () => {
      linkingSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  async function openCheckout(checkoutOrder: Order): Promise<void> {
    if (!checkoutOrder.checkoutUrl || mutation) return;
    if (!isSafeCheckoutUrl(checkoutOrder.checkoutUrl)) {
      setCheckoutUrlError(true);
      return;
    }
    setMutation("opening");
    setMutationError(undefined);
    setCheckoutUrlError(false);
    try {
      await WebBrowser.openBrowserAsync(checkoutOrder.checkoutUrl, {
        dismissButtonStyle: "close",
        showTitle: true,
      });
      await refreshAuthoritativeOrder(checkoutOrder.id, true);
    } catch (error) {
      if (mounted.current) setMutationError(error);
    }
    if (mounted.current) setMutation(undefined);
  }

  async function createCheckout(): Promise<void> {
    if (!groupId || !editionId || !receiverParticipantId || mutation) return;
    setMutation("creating");
    setMutationError(undefined);
    setCheckoutUrlError(false);
    try {
      const created = await createPickOrder(groupId, editionId, {
        receiverParticipantId,
      });
      updateOrder(created);
      if (mounted.current) setMutation(undefined);
      await openCheckout(created);
      return;
    } catch (error) {
      if (mounted.current) setMutationError(error);
    }
    if (mounted.current) setMutation(undefined);
  }

  function confirmPurchase(): void {
    const receiver = receiverName(
      resource.data?.participants.data ?? [],
      receiverParticipantId,
    );

    Alert.alert(
      t("orders.confirmTitle"),
      t("orders.confirmBody", {
        receiver,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("orders.continueToPayment"),
          onPress: () => void createCheckout(),
        },
      ],
    );
  }

  async function refreshPayment(): Promise<void> {
    if (!order || mutation) return;
    setMutation("refreshing");
    setMutationError(undefined);
    setCheckoutUrlError(false);
    await refreshAuthoritativeOrder(order.id, true);
    if (mounted.current) setMutation(undefined);
  }

  function confirmRefund(): void {
    if (!order) return;
    Alert.alert(t("orders.refundConfirmTitle"), t("orders.refundConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("orders.refund"),
        style: "destructive",
        onPress: () => void runRefund(order.id),
      },
    ]);
  }

  async function runRefund(orderId: number): Promise<void> {
    if (mutation) return;
    setMutation("refunding");
    setMutationError(undefined);
    setCheckoutUrlError(false);
    try {
      updateOrder(await refundOrder(orderId));
    } catch (error) {
      if (mounted.current) setMutationError(error);
    }
    if (mounted.current) setMutation(undefined);
  }

  if (!resource.data) {
    return (
      <AppScreen title={t("orders.title")} back>
        <ScreenState
          kind={resource.isLoading ? "loading" : "error"}
          title={
            resource.isLoading ? t("orders.loading") : t("orders.loadError")
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

  const { edition, participants } = resource.data;
  const editable = edition.status === "draft" || edition.status === "open";
  const receivers = participants.data.filter(
    (participant) => participant.id !== participants.currentParticipantId,
  );
  const canChoose = editable && (!order || order.status === "failed");

  return (
    <AppScreen
      title={t("orders.title")}
      subtitle={t("orders.subtitle")}
      back
      refreshing={resource.isRefreshing}
      onRefresh={resource.refresh}
    >
      <Card className="gap-3 border border-hairline p-5">
        <View className="flex-row items-center gap-3">
          <CreditCard color={palette.mintDeep} size={22} />
          <View className="flex-1 gap-1">
            <Text variant="cardTitle">{t("orders.howItWorksTitle")}</Text>
            <Text variant="caption">{t("orders.howItWorksBody")}</Text>
          </View>
        </View>
        <Text variant="bodyBold">
          {order
            ? t("orders.price", {
                value: formatCurrency(order.amountCents, order.currency),
              })
            : t("orders.priceServerConfirmed")}
        </Text>
      </Card>

      {order ? (
        <OrderStatusCard
          order={order}
          receiverName={receiverName(
            participants.data,
            order.receiverParticipantId ?? undefined,
          )}
          editable={editable}
          mutation={mutation}
          onOpenCheckout={() => void openCheckout(order)}
          onRefresh={() => void refreshPayment()}
          onRefund={confirmRefund}
        />
      ) : null}

      {canChoose ? (
        <Card className="gap-3 border border-hairline p-5">
          <View className="gap-1">
            <Text variant="section">{t("orders.chooseReceiver")}</Text>
            <Text variant="caption">
              {order?.status === "failed"
                ? t("orders.failedReceiverHint")
                : t("orders.chooseReceiverHint")}
            </Text>
          </View>
          {receivers.map((participant) => (
            <ParticipantChoice
              key={participant.id}
              label={participant.groupMember.displayName ?? t("orders.person")}
              selected={receiverParticipantId === participant.id}
              disabled={Boolean(mutation)}
              onPress={() => setSelectedReceiverId(participant.id)}
            />
          ))}
          <Button
            label={t("orders.buy")}
            leftIcon={
              mutation === "creating" ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <CheckCircle2 color={palette.white} size={18} />
              )
            }
            disabled={!receiverParticipantId || Boolean(mutation)}
            onPress={confirmPurchase}
          />
        </Card>
      ) : null}

      {!editable ? (
        <Card className="gap-2 border border-hairline p-5">
          <Text variant="cardTitle">{t("orders.lockedTitle")}</Text>
          <Text variant="caption">{t("orders.lockedBody")}</Text>
        </Card>
      ) : null}

      {mutationError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {apiErrorMessage(mutationError, t)}
        </Text>
      ) : null}
      {checkoutUrlError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {t("orders.invalidCheckoutUrl")}
        </Text>
      ) : null}
    </AppScreen>
  );
}

interface OrderStatusCardProps {
  order: Order;
  receiverName: string;
  editable: boolean;
  mutation?: Mutation;
  onOpenCheckout: () => void;
  onRefresh: () => void;
  onRefund: () => void;
}

function OrderStatusCard({
  order,
  receiverName,
  editable,
  mutation,
  onOpenCheckout,
  onRefresh,
  onRefund,
}: OrderStatusCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3 border border-hairline p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="section">{t("orders.current")}</Text>
        <Badge
          label={t(`orders.status.${order.status}`)}
          variant={order.status === "paid" ? "success" : "neutral"}
        />
      </View>
      {receiverName ? (
        <Text variant="bodyBold">
          {t("orders.receiver", { name: receiverName })}
        </Text>
      ) : null}
      <Text variant="caption">{t(`orders.statusBody.${order.status}`)}</Text>
      <Text variant="bodyBold">
        {t("orders.price", {
          value: formatCurrency(order.amountCents, order.currency),
        })}
      </Text>
      {order.status === "pending" && order.checkoutUrl ? (
        <Button
          label={t("orders.openCheckout")}
          leftIcon={
            mutation === "opening" ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <CreditCard color={palette.white} size={18} />
            )
          }
          disabled={Boolean(mutation)}
          onPress={onOpenCheckout}
        />
      ) : null}
      {order.status === "pending" ? (
        <Button
          label={t("orders.refresh")}
          variant="light"
          leftIcon={
            mutation === "refreshing" ? (
              <ActivityIndicator color={palette.mintDeep} />
            ) : (
              <RefreshCw color={palette.mintDeep} size={18} />
            )
          }
          disabled={Boolean(mutation)}
          onPress={onRefresh}
        />
      ) : null}
      {order.status === "paid" && editable ? (
        <Button
          label={t("orders.refund")}
          variant="light"
          leftIcon={
            mutation === "refunding" ? (
              <ActivityIndicator color={palette.mintDeep} />
            ) : (
              <RotateCcw color={palette.mintDeep} size={18} />
            )
          }
          disabled={Boolean(mutation)}
          onPress={onRefund}
        />
      ) : null}
    </Card>
  );
}

function receiverName(
  participants: EditionParticipant[],
  receiverId?: number,
): string {
  return (
    participants.find((participant) => participant.id === receiverId)
      ?.groupMember.displayName ?? ""
  );
}

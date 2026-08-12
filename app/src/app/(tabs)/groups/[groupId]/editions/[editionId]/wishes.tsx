import { useLocalSearchParams } from "expo-router";
import { Archive } from "lucide-react-native";
import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

import { normalizeApiError } from "@/api/errors";
import { getEdition } from "@/api/generated/editions/editions";
import type { Product, Wish } from "@/api/generated/models";
import { searchProducts } from "@/api/generated/products/products";
import {
  createWish,
  deleteWish,
  getMyWishes,
  reorderWishes,
  updateWish,
} from "@/api/generated/wishes/wishes";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { CreateWishCard } from "@/components/wishes/create-wish-card";
import { WishListSection } from "@/components/wishes/wish-list-section";
import { ProductSearchPanel } from "@/components/wishes/product-search-panel";
import { Card, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { openProduct } from "@/features/products/open-product";
import {
  initialWishEditorState,
  reorderWishList,
  wishEditorReducer,
} from "@/features/wishes/editor-state";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

export default function WishesScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const [state, dispatch] = useReducer(
    wishEditorReducer,
    initialWishEditorState,
  );
  const mounted = useMountedRef();
  const load = (signal: AbortSignal) =>
    loadWishResource(groupId, editionId, t("common.errors.notFound"), signal);
  const resource = useFocusResource(load);
  const fieldError =
    state.localFieldError ??
    normalizeApiError(state.mutationError).fields?.description;
  const normalizedProductError = normalizeApiError(state.productSearch.error);
  const productSearchMessage =
    state.productSearch.fieldError ??
    normalizedProductError.fields?.q ??
    (state.productSearch.error
      ? apiErrorMessage(state.productSearch.error, t)
      : undefined);

  async function searchForProduct(): Promise<void> {
    if (!groupId || !editionId || state.productSearch.searching) return;
    const query = state.productSearch.query.trim();

    if (query.length < 2) {
      dispatch({
        type: "productSearchValidationFailed",
        error: t("products.queryRequired"),
      });
      return;
    }

    dispatch({ type: "productSearchRequested" });
    try {
      const result = await searchProducts(groupId, editionId, {
        q: query,
        limit: 10,
      });
      if (!mounted.current) return;
      dispatch({ type: "productSearchSucceeded", results: result.data });
    } catch (exception) {
      if (!mounted.current) return;
      dispatch({ type: "productSearchFailed", error: exception });
    }
  }

  function selectProduct(selected: Product): void {
    dispatch({ type: "productSelected", product: selected });
  }

  async function openProductLink(selected: Product): Promise<void> {
    dispatch({ type: "productLinkStarted" });
    const opened = await openProduct(selected);
    if (mounted.current && !opened) {
      dispatch({
        type: "productLinkFailed",
        error: t("products.openError"),
      });
    }
  }

  async function create(): Promise<void> {
    if (!groupId || !editionId || state.mutation) return;
    const value = state.description.trim();
    const validationError = value ? undefined : t("wishes.required");
    if (validationError) {
      dispatch({ type: "validationFailed", error: validationError });
      return;
    }

    dispatch({ type: "mutationStarted", mutation: { type: "create" } });
    try {
      const wish = await createWish(groupId, editionId, {
        description: value,
        productId: state.product?.id ?? null,
      });
      if (!mounted.current) return;
      resource.setData((current) =>
        current ? { ...current, wishes: [...current.wishes, wish] } : current,
      );
      dispatch({ type: "createSucceeded" });
    } catch (exception) {
      if (!mounted.current) return;
      dispatch({ type: "mutationFailed", error: exception });
      resource.refresh();
    }
  }

  function beginEdit(wish: Wish): void {
    dispatch({ type: "editStarted", wish });
  }

  function cancelEdit(): void {
    dispatch({ type: "editCancelled" });
  }

  async function saveEdit(wishId: number): Promise<void> {
    if (!groupId || !editionId || state.mutation) return;
    const value = state.editingDescription.trim();
    const validationError = value ? undefined : t("wishes.required");
    if (validationError) {
      dispatch({ type: "validationFailed", error: validationError });
      return;
    }

    dispatch({
      type: "mutationStarted",
      mutation: { type: "update", wishId },
    });
    try {
      const updated = await updateWish(groupId, editionId, wishId, {
        description: value,
        productId: state.editingProduct?.id ?? null,
      });
      if (!mounted.current) return;
      resource.setData((current) =>
        current
          ? {
              ...current,
              wishes: current.wishes.map((wish) =>
                wish.id === wishId ? updated : wish,
              ),
            }
          : current,
      );
      dispatch({ type: "updateSucceeded" });
    } catch (exception) {
      if (!mounted.current) return;
      dispatch({ type: "mutationFailed", error: exception });
      resource.refresh();
    }
  }

  function confirmDelete(wish: Wish): void {
    Alert.alert(t("wishes.deleteConfirmTitle"), t("wishes.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("wishes.delete"),
        style: "destructive",
        onPress: () => void remove(wish.id),
      },
    ]);
  }

  async function remove(wishId: number): Promise<void> {
    if (!groupId || !editionId || state.mutation) return;
    dispatch({
      type: "mutationStarted",
      mutation: { type: "delete", wishId },
    });
    try {
      await deleteWish(groupId, editionId, wishId);
      if (!mounted.current) return;
      resource.setData((current) =>
        current
          ? {
              ...current,
              wishes: current.wishes.filter((wish) => wish.id !== wishId),
            }
          : current,
      );
      dispatch({ type: "mutationFinished" });
    } catch (exception) {
      if (!mounted.current) return;
      dispatch({ type: "mutationFailed", error: exception });
      resource.refresh();
    }
  }

  async function move(wishId: number, offset: -1 | 1): Promise<void> {
    if (!groupId || !editionId || state.mutation || !resource.data) return;
    const reordered = reorderWishList(resource.data.wishes, wishId, offset);
    if (!reordered) return;

    dispatch({
      type: "mutationStarted",
      mutation: { type: "reorder", wishId, offset },
    });
    try {
      const wishes = await reorderWishes(groupId, editionId, {
        wishIds: reordered.map((wish) => wish.id),
      });
      if (!mounted.current) return;
      resource.setData((current) =>
        current ? { ...current, wishes: wishes.data } : current,
      );
      dispatch({ type: "mutationFinished" });
    } catch (exception) {
      if (!mounted.current) return;
      dispatch({ type: "mutationFailed", error: exception });
      resource.refresh();
    }
  }

  if (!resource.data) {
    return (
      <AppScreen title={t("wishes.title")} back>
        <ScreenState
          kind={resource.isLoading ? "loading" : "error"}
          title={
            resource.isLoading ? t("common.loading") : t("wishes.loadError")
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

  const locked = resource.data.edition.status === "archived";
  const controlsDisabled =
    Boolean(state.mutation) || state.editingId !== undefined;
  const productSearchPanel = (
    <ProductSearchPanel
      query={state.productSearch.query}
      results={state.productSearch.results}
      searching={state.productSearch.searching}
      searched={state.productSearch.searched}
      error={productSearchMessage}
      onQueryChange={(value) =>
        dispatch({ type: "productQueryChanged", value })
      }
      onSearch={() => void searchForProduct()}
      onSelect={selectProduct}
      onCancel={() => dispatch({ type: "productSearchCancelled" })}
    />
  );

  return (
    <AppScreen
      title={t("wishes.title")}
      subtitle={t("wishes.subtitle")}
      back
      refreshing={resource.isRefreshing}
      onRefresh={state.mutation ? undefined : resource.refresh}
    >
      {locked ? (
        <ArchivedEditionNotice />
      ) : (
        <CreateWishCard
          description={state.description}
          product={state.product}
          fieldError={fieldError}
          disabled={Boolean(state.mutation)}
          creating={state.mutation?.type === "create"}
          editing={state.editingId !== undefined}
          productSearchPanel={
            state.productSearch.target === "create"
              ? productSearchPanel
              : undefined
          }
          onDescriptionChange={(value) =>
            dispatch({ type: "descriptionChanged", value })
          }
          onChooseProduct={() =>
            dispatch({ type: "productSearchStarted", target: "create" })
          }
          onRemoveProduct={() => dispatch({ type: "productRemoved" })}
          onOpenProduct={(selected) => void openProductLink(selected)}
          onCreate={() => void create()}
        />
      )}

      <WishListSection
        wishes={resource.data.wishes}
        state={state}
        locked={locked}
        fieldError={fieldError}
        controlsDisabled={controlsDisabled}
        productSearchPanel={productSearchPanel}
        resourceError={resource.error}
        onEditingDescriptionChange={(value) =>
          dispatch({ type: "editingDescriptionChanged", value })
        }
        onChooseProduct={(wishId) =>
          dispatch({ type: "productSearchStarted", target: wishId })
        }
        onRemoveEditingProduct={() =>
          dispatch({ type: "editingProductRemoved" })
        }
        onOpenProduct={(selected) => void openProductLink(selected)}
        onBeginEdit={beginEdit}
        onCancelEdit={cancelEdit}
        onSaveEdit={(wishId) => void saveEdit(wishId)}
        onDelete={confirmDelete}
        onMove={(wishId, offset) => void move(wishId, offset)}
      />
    </AppScreen>
  );
}

async function loadWishResource(
  groupId: number | undefined,
  editionId: number | undefined,
  notFoundMessage: string,
  signal: AbortSignal,
) {
  if (!groupId || !editionId) throw new Error(notFoundMessage);
  const [edition, wishes] = await Promise.all([
    getEdition(groupId, editionId, { signal }),
    getMyWishes(groupId, editionId, { signal }),
  ]);
  return { edition, wishes: wishes.data };
}

function ArchivedEditionNotice() {
  const { t } = useTranslation();

  return (
    <Card className="flex-row gap-3 p-5">
      <Archive color={palette.mint} size={22} />
      <View className="flex-1 gap-1">
        <Text variant="cardTitle">{t("wishes.readOnlyTitle")}</Text>
        <Text variant="caption">{t("wishes.readOnlyBody")}</Text>
      </View>
    </Card>
  );
}

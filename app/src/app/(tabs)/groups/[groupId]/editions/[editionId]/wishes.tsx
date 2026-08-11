import { useLocalSearchParams } from "expo-router";
import { Archive, ExternalLink, Plus, Search, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, View } from "react-native";

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
import { FormField } from "@/components/common/form-field";
import { ScreenState } from "@/components/common/screen-state";
import { WishListItem } from "@/components/wishes/wish-list-item";
import { ProductDetails } from "@/components/wishes/product-details";
import { ProductSearchPanel } from "@/components/wishes/product-search-panel";
import { Button, Card, Text } from "@/components/ui";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { openProduct } from "@/features/products/open-product";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

type Mutation =
  | { type: "create" }
  | { type: "update"; wishId: number }
  | { type: "delete"; wishId: number }
  | { type: "reorder"; wishId: number; offset: -1 | 1 };

type ProductPickerTarget = "create" | number;

export default function WishesScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ groupId: string; editionId: string }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const [description, setDescription] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [editingId, setEditingId] = useState<number>();
  const [editingDescription, setEditingDescription] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productPickerTarget, setProductPickerTarget] =
    useState<ProductPickerTarget>();
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [productSearched, setProductSearched] = useState(false);
  const [productSearchError, setProductSearchError] = useState<unknown>();
  const [productFieldError, setProductFieldError] = useState<string>();
  const [productLinkError, setProductLinkError] = useState<string>();
  const [mutation, setMutation] = useState<Mutation>();
  const [mutationError, setMutationError] = useState<unknown>();
  const [localFieldError, setLocalFieldError] = useState<string>();
  const mounted = useMountedRef();
  const load = async (signal: AbortSignal) => {
    if (!groupId || !editionId) throw new Error(t("common.errors.notFound"));
    const [edition, wishes] = await Promise.all([
      getEdition(groupId, editionId, { signal }),
      getMyWishes(groupId, editionId, { signal }),
    ]);
    return { edition, wishes: wishes.data };
  };
  const resource = useFocusResource(load);
  const fieldError =
    localFieldError ?? normalizeApiError(mutationError).fields?.description;
  const normalizedProductError = normalizeApiError(productSearchError);
  const productSearchMessage =
    productFieldError ??
    normalizedProductError.fields?.q ??
    (productSearchError ? apiErrorMessage(productSearchError, t) : undefined);

  function clearErrors(): void {
    setLocalFieldError(undefined);
    setMutationError(undefined);
    setProductLinkError(undefined);
  }

  function resetProductSearch(): void {
    setProductPickerTarget(undefined);
    setProductQuery("");
    setProductResults([]);
    setProductSearching(false);
    setProductSearched(false);
    setProductSearchError(undefined);
    setProductFieldError(undefined);
  }

  function beginProductSearch(target: ProductPickerTarget): void {
    clearErrors();
    setProductPickerTarget(target);
    setProductQuery("");
    setProductResults([]);
    setProductSearched(false);
    setProductSearchError(undefined);
    setProductFieldError(undefined);
  }

  async function searchForProduct(): Promise<void> {
    if (!groupId || !editionId || productSearching) return;
    const query = productQuery.trim();

    if (query.length < 2) {
      setProductFieldError(t("products.queryRequired"));
      return;
    }

    setProductSearching(true);
    setProductSearched(false);
    setProductSearchError(undefined);
    setProductFieldError(undefined);
    try {
      const result = await searchProducts(groupId, editionId, {
        q: query,
        limit: 10,
      });
      if (!mounted.current) return;
      setProductResults(result.data);
      setProductSearched(true);
    } catch (exception) {
      if (!mounted.current) return;
      setProductSearchError(exception);
    }
    if (mounted.current) setProductSearching(false);
  }

  function selectProduct(selected: Product): void {
    if (productPickerTarget === "create") setProduct(selected);
    else if (typeof productPickerTarget === "number")
      setEditingProduct(selected);
    resetProductSearch();
  }

  async function openProductLink(selected: Product): Promise<void> {
    setProductLinkError(undefined);
    const opened = await openProduct(selected);
    if (mounted.current && !opened)
      setProductLinkError(t("products.openError"));
  }

  function validate(value: string): string | undefined {
    return value.trim() ? undefined : t("wishes.required");
  }

  async function create(): Promise<void> {
    if (!groupId || !editionId || mutation) return;
    const value = description.trim();
    const validationError = validate(value);
    if (validationError) {
      setLocalFieldError(validationError);
      return;
    }

    clearErrors();
    setMutation({ type: "create" });
    try {
      const wish = await createWish(groupId, editionId, {
        description: value,
        productId: product?.id ?? null,
      });
      if (!mounted.current) return;
      resource.setData((current) =>
        current ? { ...current, wishes: [...current.wishes, wish] } : current,
      );
      setDescription("");
      setProduct(null);
      resetProductSearch();
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
      resource.refresh();
    }
    if (mounted.current) setMutation(undefined);
  }

  function beginEdit(wish: Wish): void {
    clearErrors();
    setEditingId(wish.id);
    setEditingDescription(wish.description);
    setEditingProduct(wish.product);
    resetProductSearch();
  }

  function cancelEdit(): void {
    clearErrors();
    setEditingId(undefined);
    setEditingDescription("");
    setEditingProduct(null);
    resetProductSearch();
  }

  async function saveEdit(wishId: number): Promise<void> {
    if (!groupId || !editionId || mutation) return;
    const value = editingDescription.trim();
    const validationError = validate(value);
    if (validationError) {
      setLocalFieldError(validationError);
      return;
    }

    clearErrors();
    setMutation({ type: "update", wishId });
    try {
      const updated = await updateWish(groupId, editionId, wishId, {
        description: value,
        productId: editingProduct?.id ?? null,
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
      setEditingId(undefined);
      setEditingDescription("");
      setEditingProduct(null);
      resetProductSearch();
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
      resource.refresh();
    }
    if (mounted.current) setMutation(undefined);
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
    if (!groupId || !editionId || mutation) return;
    clearErrors();
    setMutation({ type: "delete", wishId });
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
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
      resource.refresh();
    }
    if (mounted.current) setMutation(undefined);
  }

  async function move(wishId: number, offset: -1 | 1): Promise<void> {
    if (!groupId || !editionId || mutation || !resource.data) return;
    const index = resource.data.wishes.findIndex((wish) => wish.id === wishId);
    const targetIndex = index + offset;
    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= resource.data.wishes.length
    )
      return;

    const reordered = [...resource.data.wishes];
    const target = reordered[targetIndex];
    if (!target) return;
    reordered[targetIndex] = reordered[index]!;
    reordered[index] = target;

    clearErrors();
    setMutation({ type: "reorder", wishId, offset });
    try {
      const wishes = await reorderWishes(groupId, editionId, {
        wishIds: reordered.map((wish) => wish.id),
      });
      if (!mounted.current) return;
      resource.setData((current) =>
        current ? { ...current, wishes: wishes.data } : current,
      );
    } catch (exception) {
      if (!mounted.current) return;
      setMutationError(exception);
      resource.refresh();
    }
    if (mounted.current) setMutation(undefined);
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
  const controlsDisabled = Boolean(mutation) || editingId !== undefined;

  return (
    <AppScreen
      title={t("wishes.title")}
      subtitle={t("wishes.subtitle")}
      back
      refreshing={resource.isRefreshing}
      onRefresh={mutation ? undefined : resource.refresh}
    >
      {locked ? (
        <ArchivedEditionNotice />
      ) : (
        <Card className="gap-3 p-5">
          <FormField
            label={t("wishes.field")}
            placeholder={t("wishes.placeholder")}
            value={description}
            onChangeText={(value) => {
              setDescription(value);
              clearErrors();
            }}
            maxLength={500}
            multiline
            editable={!mutation}
            error={editingId === undefined ? fieldError : undefined}
          />
          <Text variant="bodyBold">{t("products.optional")}</Text>
          {product ? (
            <View className="gap-3 rounded-tile border border-hairline p-3">
              <ProductDetails product={product} />
              <View className="flex-row flex-wrap gap-2">
                <Button
                  className="flex-1"
                  label={t("products.change")}
                  variant="light"
                  size="sm"
                  leftIcon={<Search color={palette.mintDeep} size={16} />}
                  disabled={Boolean(mutation)}
                  onPress={() => beginProductSearch("create")}
                />
                <Button
                  label={t("products.open")}
                  variant="light"
                  size="sm"
                  leftIcon={<ExternalLink color={palette.mintDeep} size={16} />}
                  disabled={Boolean(mutation)}
                  onPress={() => void openProductLink(product)}
                />
                <Button
                  label={t("products.remove")}
                  variant="light"
                  size="sm"
                  leftIcon={<X color={palette.pink} size={16} />}
                  disabled={Boolean(mutation)}
                  onPress={() => {
                    setProduct(null);
                    resetProductSearch();
                  }}
                />
              </View>
            </View>
          ) : (
            <Button
              label={t("products.addOptional")}
              variant="light"
              size="sm"
              leftIcon={<Search color={palette.mintDeep} size={16} />}
              disabled={Boolean(mutation)}
              onPress={() => beginProductSearch("create")}
            />
          )}
          {productPickerTarget === "create" ? (
            <ProductSearchPanel
              query={productQuery}
              results={productResults}
              searching={productSearching}
              searched={productSearched}
              error={productSearchMessage}
              onQueryChange={(value) => {
                setProductQuery(value);
                setProductFieldError(undefined);
                setProductSearchError(undefined);
              }}
              onSearch={() => void searchForProduct()}
              onSelect={selectProduct}
              onCancel={resetProductSearch}
            />
          ) : null}
          <Button
            label={
              mutation?.type === "create" ? t("wishes.adding") : t("wishes.add")
            }
            leftIcon={
              mutation?.type === "create" ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Plus color={palette.white} size={18} />
              )
            }
            disabled={Boolean(mutation) || editingId !== undefined}
            onPress={() => void create()}
          />
        </Card>
      )}

      <Text variant="section">{t("wishes.listTitle")}</Text>

      {resource.data.wishes.length === 0 ? (
        <ScreenState
          kind="empty"
          title={t("wishes.empty")}
          message={locked ? undefined : t("wishes.emptyHint")}
        />
      ) : (
        <View className="gap-3">
          {resource.data.wishes.map((wish, index) => (
            <WishListItem
              key={wish.id}
              wish={wish}
              index={index}
              count={resource.data!.wishes.length}
              locked={locked}
              editing={editingId === wish.id}
              editingDescription={editingDescription}
              editingProduct={editingProduct}
              productSearchPanel={
                productPickerTarget === wish.id ? (
                  <ProductSearchPanel
                    query={productQuery}
                    results={productResults}
                    searching={productSearching}
                    searched={productSearched}
                    error={productSearchMessage}
                    onQueryChange={(value) => {
                      setProductQuery(value);
                      setProductFieldError(undefined);
                      setProductSearchError(undefined);
                    }}
                    onSearch={() => void searchForProduct()}
                    onSelect={selectProduct}
                    onCancel={resetProductSearch}
                  />
                ) : undefined
              }
              fieldError={fieldError}
              controlsDisabled={controlsDisabled}
              busy={busyState(mutation, wish.id)}
              onEditingDescriptionChange={(value) => {
                setEditingDescription(value);
                clearErrors();
              }}
              onChooseProduct={() => beginProductSearch(wish.id)}
              onRemoveEditingProduct={() => {
                setEditingProduct(null);
                resetProductSearch();
              }}
              onOpenProduct={(selected) => void openProductLink(selected)}
              onBeginEdit={() => beginEdit(wish)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => void saveEdit(wish.id)}
              onDelete={() => confirmDelete(wish)}
              onMoveUp={() => void move(wish.id, -1)}
              onMoveDown={() => void move(wish.id, 1)}
            />
          ))}
        </View>
      )}

      {mutationError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {apiErrorMessage(mutationError, t)}
        </Text>
      ) : null}
      {productLinkError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {productLinkError}
        </Text>
      ) : null}
      {resource.error ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {apiErrorMessage(resource.error, t)}
        </Text>
      ) : null}
    </AppScreen>
  );
}

function busyState(
  mutation: Mutation | undefined,
  wishId: number,
): "up" | "down" | "update" | "delete" | undefined {
  if (!mutation || !("wishId" in mutation) || mutation.wishId !== wishId)
    return undefined;
  if (mutation.type === "reorder")
    return mutation.offset === -1 ? "up" : "down";
  return mutation.type;
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

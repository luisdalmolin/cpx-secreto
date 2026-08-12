import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { Product, Wish } from "@/api/generated/models";
import { ScreenState } from "@/components/common/screen-state";
import { Text } from "@/components/ui";
import { apiErrorMessage } from "@/features/shared/presentation";
import {
  type WishEditorState,
  wishBusyState,
} from "@/features/wishes/editor-state";

import { WishListItem } from "./wish-list-item";

interface WishListSectionProps {
  wishes: Wish[];
  state: WishEditorState;
  locked: boolean;
  fieldError?: string;
  controlsDisabled: boolean;
  productSearchPanel: ReactNode;
  resourceError: unknown;
  onEditingDescriptionChange(value: string): void;
  onChooseProduct(wishId: number): void;
  onRemoveEditingProduct(): void;
  onOpenProduct(product: Product): void;
  onBeginEdit(wish: Wish): void;
  onCancelEdit(): void;
  onSaveEdit(wishId: number): void;
  onDelete(wish: Wish): void;
  onMove(wishId: number, offset: -1 | 1): void;
}

export function WishListSection({
  wishes,
  state,
  locked,
  fieldError,
  controlsDisabled,
  productSearchPanel,
  resourceError,
  onEditingDescriptionChange,
  onChooseProduct,
  onRemoveEditingProduct,
  onOpenProduct,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onMove,
}: WishListSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <Text variant="section">{t("wishes.listTitle")}</Text>
      {wishes.length === 0 ? (
        <ScreenState
          kind="empty"
          title={t("wishes.empty")}
          message={locked ? undefined : t("wishes.emptyHint")}
        />
      ) : (
        <View className="gap-3">
          {wishes.map((wish, index) => (
            <WishListItem
              key={wish.id}
              wish={wish}
              index={index}
              count={wishes.length}
              locked={locked}
              editing={state.editingId === wish.id}
              editingDescription={state.editingDescription}
              editingProduct={state.editingProduct}
              productSearchPanel={
                state.productSearch.target === wish.id
                  ? productSearchPanel
                  : undefined
              }
              fieldError={fieldError}
              controlsDisabled={controlsDisabled}
              busy={wishBusyState(state.mutation, wish.id)}
              onEditingDescriptionChange={onEditingDescriptionChange}
              onChooseProduct={() => onChooseProduct(wish.id)}
              onRemoveEditingProduct={onRemoveEditingProduct}
              onOpenProduct={onOpenProduct}
              onBeginEdit={() => onBeginEdit(wish)}
              onCancelEdit={onCancelEdit}
              onSaveEdit={() => onSaveEdit(wish.id)}
              onDelete={() => onDelete(wish)}
              onMoveUp={() => onMove(wish.id, -1)}
              onMoveDown={() => onMove(wish.id, 1)}
            />
          ))}
        </View>
      )}
      {state.mutationError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {apiErrorMessage(state.mutationError, t)}
        </Text>
      ) : null}
      {state.productLinkError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {state.productLinkError}
        </Text>
      ) : null}
      {resourceError ? (
        <Text className="text-pink-deep" accessibilityRole="alert">
          {apiErrorMessage(resourceError, t)}
        </Text>
      ) : null}
    </>
  );
}

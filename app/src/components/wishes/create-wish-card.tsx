import { ExternalLink, Plus, Search, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import type { Product } from "@/api/generated/models";
import { FormField } from "@/components/common/form-field";
import { Button, Card, Text } from "@/components/ui";
import { palette } from "@/theme/tokens";

import { ProductDetails } from "./product-details";

interface CreateWishCardProps {
  description: string;
  product: Product | null;
  fieldError?: string;
  disabled: boolean;
  creating: boolean;
  editing: boolean;
  productSearchPanel?: ReactNode;
  onDescriptionChange(value: string): void;
  onChooseProduct(): void;
  onRemoveProduct(): void;
  onOpenProduct(product: Product): void;
  onCreate(): void;
}

export function CreateWishCard({
  description,
  product,
  fieldError,
  disabled,
  creating,
  editing,
  productSearchPanel,
  onDescriptionChange,
  onChooseProduct,
  onRemoveProduct,
  onOpenProduct,
  onCreate,
}: CreateWishCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3 p-5">
      <FormField
        label={t("wishes.field")}
        placeholder={t("wishes.placeholder")}
        value={description}
        onChangeText={onDescriptionChange}
        maxLength={500}
        multiline
        editable={!disabled}
        error={!editing ? fieldError : undefined}
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
              disabled={disabled}
              onPress={onChooseProduct}
            />
            <Button
              label={t("products.open")}
              variant="light"
              size="sm"
              leftIcon={<ExternalLink color={palette.mintDeep} size={16} />}
              disabled={disabled}
              onPress={() => onOpenProduct(product)}
            />
            <Button
              label={t("products.remove")}
              variant="light"
              size="sm"
              leftIcon={<X color={palette.pink} size={16} />}
              disabled={disabled}
              onPress={onRemoveProduct}
            />
          </View>
        </View>
      ) : (
        <Button
          label={t("products.addOptional")}
          variant="light"
          size="sm"
          leftIcon={<Search color={palette.mintDeep} size={16} />}
          disabled={disabled}
          onPress={onChooseProduct}
        />
      )}
      {productSearchPanel}
      <Button
        label={creating ? t("wishes.adding") : t("wishes.add")}
        leftIcon={
          creating ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Plus color={palette.white} size={18} />
          )
        }
        disabled={disabled || editing}
        onPress={onCreate}
      />
    </Card>
  );
}

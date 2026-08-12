import type { Product, Wish } from "@/api/generated/models";

export type WishMutation =
  | { type: "create" }
  | { type: "update"; wishId: number }
  | { type: "delete"; wishId: number }
  | { type: "reorder"; wishId: number; offset: -1 | 1 };

export type ProductPickerTarget = "create" | number;

interface ProductSearchState {
  target?: ProductPickerTarget;
  query: string;
  results: Product[];
  searching: boolean;
  searched: boolean;
  error?: unknown;
  fieldError?: string;
}

export interface WishEditorState {
  description: string;
  product: Product | null;
  editingId?: number;
  editingDescription: string;
  editingProduct: Product | null;
  productSearch: ProductSearchState;
  productLinkError?: string;
  mutation?: WishMutation;
  mutationError?: unknown;
  localFieldError?: string;
}

export type WishEditorAction =
  | { type: "descriptionChanged"; value: string }
  | { type: "productRemoved" }
  | { type: "editStarted"; wish: Wish }
  | { type: "editCancelled" }
  | { type: "editingDescriptionChanged"; value: string }
  | { type: "editingProductRemoved" }
  | { type: "productSearchStarted"; target: ProductPickerTarget }
  | { type: "productQueryChanged"; value: string }
  | { type: "productSearchValidationFailed"; error: string }
  | { type: "productSearchRequested" }
  | { type: "productSearchSucceeded"; results: Product[] }
  | { type: "productSearchFailed"; error: unknown }
  | { type: "productSelected"; product: Product }
  | { type: "productSearchCancelled" }
  | { type: "productLinkStarted" }
  | { type: "productLinkFailed"; error: string }
  | { type: "validationFailed"; error: string }
  | { type: "mutationStarted"; mutation: WishMutation }
  | { type: "mutationFailed"; error: unknown }
  | { type: "mutationFinished" }
  | { type: "createSucceeded" }
  | { type: "updateSucceeded" };

function emptyProductSearch(target?: ProductPickerTarget): ProductSearchState {
  return {
    target,
    query: "",
    results: [],
    searching: false,
    searched: false,
  };
}

export const initialWishEditorState: WishEditorState = {
  description: "",
  product: null,
  editingDescription: "",
  editingProduct: null,
  productSearch: emptyProductSearch(),
};

function withoutErrors(state: WishEditorState): WishEditorState {
  return {
    ...state,
    localFieldError: undefined,
    mutationError: undefined,
    productLinkError: undefined,
  };
}

export function wishEditorReducer(
  state: WishEditorState,
  action: WishEditorAction,
): WishEditorState {
  switch (action.type) {
    case "descriptionChanged":
      return { ...withoutErrors(state), description: action.value };
    case "productRemoved":
      return {
        ...state,
        product: null,
        productSearch: emptyProductSearch(),
      };
    case "editStarted":
      return {
        ...withoutErrors(state),
        editingId: action.wish.id,
        editingDescription: action.wish.description,
        editingProduct: action.wish.product,
        productSearch: emptyProductSearch(),
      };
    case "editCancelled":
      return {
        ...withoutErrors(state),
        editingId: undefined,
        editingDescription: "",
        editingProduct: null,
        productSearch: emptyProductSearch(),
      };
    case "editingDescriptionChanged":
      return {
        ...withoutErrors(state),
        editingDescription: action.value,
      };
    case "editingProductRemoved":
      return {
        ...state,
        editingProduct: null,
        productSearch: emptyProductSearch(),
      };
    case "productSearchStarted":
      return {
        ...withoutErrors(state),
        productSearch: emptyProductSearch(action.target),
      };
    case "productQueryChanged":
      return {
        ...state,
        productSearch: {
          ...state.productSearch,
          query: action.value,
          error: undefined,
          fieldError: undefined,
        },
      };
    case "productSearchValidationFailed":
      return {
        ...state,
        productSearch: {
          ...state.productSearch,
          fieldError: action.error,
        },
      };
    case "productSearchRequested":
      return {
        ...state,
        productSearch: {
          ...state.productSearch,
          searching: true,
          searched: false,
          error: undefined,
          fieldError: undefined,
        },
      };
    case "productSearchSucceeded":
      return {
        ...state,
        productSearch: {
          ...state.productSearch,
          results: action.results,
          searching: false,
          searched: true,
        },
      };
    case "productSearchFailed":
      return {
        ...state,
        productSearch: {
          ...state.productSearch,
          searching: false,
          error: action.error,
        },
      };
    case "productSelected":
      return {
        ...state,
        product:
          state.productSearch.target === "create"
            ? action.product
            : state.product,
        editingProduct:
          typeof state.productSearch.target === "number"
            ? action.product
            : state.editingProduct,
        productSearch: emptyProductSearch(),
      };
    case "productSearchCancelled":
      return { ...state, productSearch: emptyProductSearch() };
    case "productLinkStarted":
      return { ...state, productLinkError: undefined };
    case "productLinkFailed":
      return { ...state, productLinkError: action.error };
    case "validationFailed":
      return { ...state, localFieldError: action.error };
    case "mutationStarted":
      return {
        ...withoutErrors(state),
        mutation: action.mutation,
      };
    case "mutationFailed":
      return {
        ...state,
        mutation: undefined,
        mutationError: action.error,
      };
    case "mutationFinished":
      return { ...state, mutation: undefined };
    case "createSucceeded":
      return {
        ...state,
        description: "",
        product: null,
        mutation: undefined,
        productSearch: emptyProductSearch(),
      };
    case "updateSucceeded":
      return {
        ...state,
        editingId: undefined,
        editingDescription: "",
        editingProduct: null,
        mutation: undefined,
        productSearch: emptyProductSearch(),
      };
  }
}

export function wishBusyState(
  mutation: WishMutation | undefined,
  wishId: number,
): "up" | "down" | "update" | "delete" | undefined {
  if (!mutation || !("wishId" in mutation) || mutation.wishId !== wishId) {
    return undefined;
  }
  if (mutation.type === "reorder") {
    return mutation.offset === -1 ? "up" : "down";
  }
  return mutation.type;
}

export function reorderWishList(
  wishes: Wish[],
  wishId: number,
  offset: -1 | 1,
): Wish[] | undefined {
  const index = wishes.findIndex((wish) => wish.id === wishId);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= wishes.length) {
    return undefined;
  }

  const reordered = [...wishes];
  const target = reordered[targetIndex];
  if (!target) return undefined;
  reordered[targetIndex] = reordered[index]!;
  reordered[index] = target;
  return reordered;
}

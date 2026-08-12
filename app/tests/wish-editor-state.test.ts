import type { Product, Wish } from "@/api/generated/models";
import {
  initialWishEditorState,
  reorderWishList,
  wishBusyState,
  wishEditorReducer,
} from "@/features/wishes/editor-state";

const product = { id: 7, title: "Livro" } as Product;
const wish = {
  id: 12,
  description: "Um livro",
  product,
} as Wish;

describe("wish editor state", () => {
  test("selects a product for the active create form", () => {
    const searching = wishEditorReducer(initialWishEditorState, {
      type: "productSearchStarted",
      target: "create",
    });
    const selected = wishEditorReducer(searching, {
      type: "productSelected",
      product,
    });

    expect(selected.product).toBe(product);
    expect(selected.productSearch.target).toBeUndefined();
  });

  test("starts and clears all linked edit values together", () => {
    const editing = wishEditorReducer(initialWishEditorState, {
      type: "editStarted",
      wish,
    });
    const cancelled = wishEditorReducer(editing, { type: "editCancelled" });

    expect(editing).toMatchObject({
      editingId: 12,
      editingDescription: "Um livro",
      editingProduct: product,
    });
    expect(cancelled).toMatchObject({
      editingId: undefined,
      editingDescription: "",
      editingProduct: null,
    });
  });

  test("clears mutation state after failures and successful creation", () => {
    const mutating = wishEditorReducer(initialWishEditorState, {
      type: "mutationStarted",
      mutation: { type: "create" },
    });
    const failed = wishEditorReducer(mutating, {
      type: "mutationFailed",
      error: "failed",
    });

    expect(failed.mutation).toBeUndefined();
    expect(failed.mutationError).toBe("failed");

    const succeeded = wishEditorReducer(
      { ...mutating, description: "Presente", product },
      { type: "createSucceeded" },
    );
    expect(succeeded).toMatchObject({
      description: "",
      product: null,
      mutation: undefined,
    });
  });

  test("maps reorder mutations to item busy states", () => {
    expect(wishBusyState({ type: "reorder", wishId: 12, offset: -1 }, 12)).toBe(
      "up",
    );
    expect(wishBusyState({ type: "delete", wishId: 12 }, 12)).toBe("delete");
    expect(wishBusyState({ type: "delete", wishId: 13 }, 12)).toBeUndefined();
  });

  test("moves a wish only within list boundaries", () => {
    const otherWish = { ...wish, id: 13 };

    expect(
      reorderWishList([wish, otherWish], 12, 1)?.map(({ id }) => id),
    ).toEqual([13, 12]);
    expect(reorderWishList([wish, otherWish], 12, -1)).toBeUndefined();
    expect(reorderWishList([wish, otherWish], 99, 1)).toBeUndefined();
  });
});

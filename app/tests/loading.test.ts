import { withLoading } from "@/features/shared/loading";

describe("withLoading", () => {
  test("sets and clears the loading state around a successful operation", async () => {
    const states: boolean[] = [];

    const result = await withLoading(
      (loading) => states.push(loading),
      async () => "done",
    );

    expect(result).toBe("done");
    expect(states).toEqual([true, false]);
  });

  test("clears the loading state when the operation fails", async () => {
    const states: boolean[] = [];
    const error = new Error("failed");

    await expect(
      withLoading(
        (loading) => states.push(loading),
        async () => {
          throw error;
        },
      ),
    ).rejects.toBe(error);
    expect(states).toEqual([true, false]);
  });
});

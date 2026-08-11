type LoadingSetter = (loading: boolean) => void;

export async function withLoading<T>(
  setLoading: LoadingSetter,
  operation: () => Promise<T>,
): Promise<T> {
  setLoading(true);

  try {
    return await operation();
  } finally {
    setLoading(false);
  }
}

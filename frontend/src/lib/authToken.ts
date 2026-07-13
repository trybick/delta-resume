type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export const registerTokenGetter = (getter: TokenGetter | null): void => {
  tokenGetter = getter;
};

export const getAuthToken = async (): Promise<string | null> => {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
};

export {};

declare global {
  interface Window {
    freighterApi?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string) => Promise<string>;
      isConnected?: () => Promise<boolean>;
    };
  }
}
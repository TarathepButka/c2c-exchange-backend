export const PERMISSIONS = {
  USERS_READ: "users:read",
  USERS_KYC_VERIFY: "users:kyc:verify",
  ASSETS_READ: "assets:read",
  WALLET_READ: "wallet:read",
  WALLET_TRANSFER_CREATE: "wallet:transfer:create",
  WALLET_WITHDRAW_CREATE: "wallet:withdraw:create",
  WALLET_WITHDRAW_MANAGE: "wallet:withdraw:manage",
  P2P_AD_CREATE: "p2p:ad:create",
  P2P_AD_READ: "p2p:ad:read",
  P2P_AD_CANCEL: "p2p:ad:cancel",
  P2P_TRADE_CREATE: "p2p:trade:create",
  P2P_TRADE_READ: "p2p:trade:read",
  P2P_TRADE_PAY: "p2p:trade:pay",
  P2P_TRADE_RELEASE: "p2p:trade:release",
  P2P_TRADE_CANCEL: "p2p:trade:cancel",
  P2P_TRADE_DISPUTE: "p2p:trade:dispute",
  P2P_DISPUTE_RESOLVE: "p2p:dispute:resolve",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

import { PrismaClient } from "@prisma/client";
import { ids } from "./seed-data";
import { d } from "./seed-utils";

export async function seedAssetsAndFiat(prisma: PrismaClient) {
  const assets = [
    { id: ids.assets.BTC, symbol: "BTC", name: "Bitcoin", precision: 8 },
    { id: ids.assets.ETH, symbol: "ETH", name: "Ethereum", precision: 8 },
    { id: ids.assets.XRP, symbol: "XRP", name: "Ripple", precision: 6 },
    { id: ids.assets.DOGE, symbol: "DOGE", name: "Dogecoin", precision: 8 },
    { id: ids.assets.USDT, symbol: "USDT", name: "Tether USD", precision: 6 },
  ];

  for (const asset of assets) {
    await prisma.cryptoAsset.upsert({
      where: { symbol: asset.symbol },
      update: {
        name: asset.name,
        precision: asset.precision,
        isActive: true,
      },
      create: {
        ...asset,
        isActive: true,
      },
    });
  }

  const withdrawalNetworks = [
    {
      id: ids.withdrawalNetworks.btcBtc,
      assetId: ids.assets.BTC,
      network: "BTC",
      name: "Bitcoin",
      withdrawFee: "0.0005",
      withdrawMin: "0.001",
      withdrawMax: "10",
      addressRegex: "^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$",
      requiresTag: false,
    },
    {
      id: ids.withdrawalNetworks.ethEth,
      assetId: ids.assets.ETH,
      network: "ETH",
      name: "Ethereum (ERC20)",
      withdrawFee: "0.002",
      withdrawMin: "0.01",
      withdrawMax: "100",
      addressRegex: "^0x[a-fA-F0-9]{40}$",
      requiresTag: false,
    },
    {
      id: ids.withdrawalNetworks.xrpXrp,
      assetId: ids.assets.XRP,
      network: "XRP",
      name: "Ripple",
      withdrawFee: "0.25",
      withdrawMin: "20",
      withdrawMax: "1000000",
      addressRegex: "^r[1-9A-HJ-NP-Za-km-z]{25,34}$",
      requiresTag: true,
    },
    {
      id: ids.withdrawalNetworks.dogeDoge,
      assetId: ids.assets.DOGE,
      network: "DOGE",
      name: "Dogecoin",
      withdrawFee: "5",
      withdrawMin: "50",
      withdrawMax: "1000000",
      addressRegex: "^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$",
      requiresTag: false,
    },
    {
      id: ids.withdrawalNetworks.usdtTrx,
      assetId: ids.assets.USDT,
      network: "TRX",
      name: "TRON (TRC20)",
      withdrawFee: "1",
      withdrawMin: "10",
      withdrawMax: "100000",
      addressRegex: "^T[1-9A-HJ-NP-Za-km-z]{33}$",
      requiresTag: false,
    },
    {
      id: ids.withdrawalNetworks.usdtEth,
      assetId: ids.assets.USDT,
      network: "ETH",
      name: "Ethereum (ERC20)",
      withdrawFee: "10",
      withdrawMin: "50",
      withdrawMax: "100000",
      addressRegex: "^0x[a-fA-F0-9]{40}$",
      requiresTag: false,
    },
    {
      id: ids.withdrawalNetworks.usdtBsc,
      assetId: ids.assets.USDT,
      network: "BSC",
      name: "BNB Smart Chain (BEP20)",
      withdrawFee: "0.5",
      withdrawMin: "10",
      withdrawMax: "100000",
      addressRegex: "^0x[a-fA-F0-9]{40}$",
      requiresTag: false,
    },
  ];

  for (const network of withdrawalNetworks) {
    await prisma.withdrawalNetwork.upsert({
      where: {
        assetId_network: {
          assetId: network.assetId,
          network: network.network,
        },
      },
      update: {
        name: network.name,
        withdrawFee: d(network.withdrawFee),
        withdrawMin: d(network.withdrawMin),
        withdrawMax: d(network.withdrawMax),
        addressRegex: network.addressRegex,
        requiresTag: network.requiresTag,
        isActive: true,
      },
      create: {
        id: network.id,
        assetId: network.assetId,
        network: network.network,
        name: network.name,
        withdrawFee: d(network.withdrawFee),
        withdrawMin: d(network.withdrawMin),
        withdrawMax: d(network.withdrawMax),
        addressRegex: network.addressRegex,
        requiresTag: network.requiresTag,
        isActive: true,
      },
    });
  }

  const fiatCurrencies = [
    { id: ids.fiat.THB, code: "THB", name: "Thai Baht", precision: 2 },
    { id: ids.fiat.USD, code: "USD", name: "US Dollar", precision: 2 },
  ];

  for (const fiat of fiatCurrencies) {
    await prisma.fiatCurrency.upsert({
      where: { code: fiat.code },
      update: {
        name: fiat.name,
        precision: fiat.precision,
      },
      create: fiat,
    });
  }
}

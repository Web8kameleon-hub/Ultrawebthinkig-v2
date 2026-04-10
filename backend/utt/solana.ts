// backend/utt/solana.ts
import {
  Connection, Keypair, PublicKey, clusterApiUrl, SystemProgram, sendAndConfirmTransaction
} from "@solana/web3.js";
// @solana/spl-token v0.1.8 — API e vjetër (AccountLayout, MintLayout, Token)
import {
  AccountLayout, MintLayout, Token,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";

// ─── Adapters për API moderne ────────────────────────────────────────────────
async function getAssociatedTokenAddress(
  mint: PublicKey, owner: PublicKey,
  _allowOwnerOffCurve = false,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  return Token.getAssociatedTokenAddress(associatedTokenProgramId, programId, mint, owner);
}

async function getAccount(connection: Connection, address: PublicKey) {
  const info = await connection.getAccountInfo(address);
  if (!info) throw new Error('Account not found');
  const decoded = AccountLayout.decode(info.data);
  return { address, mint: new PublicKey(decoded.mint), owner: new PublicKey(decoded.owner), amount: decoded.amount };
}

async function getMint(connection: Connection, address: PublicKey) {
  const info = await connection.getAccountInfo(address);
  if (!info) throw new Error('Mint not found');
  const decoded = MintLayout.decode(info.data);
  return { address, decimals: decoded.decimals, supply: decoded.supply };
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey,
  programId = TOKEN_PROGRAM_ID, associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
) {
  return Token.createAssociatedTokenAccountInstruction(
    associatedTokenProgramId, programId, mint, ata, owner, payer
  );
}

function createTransferInstruction(
  source: PublicKey, destination: PublicKey, owner: PublicKey,
  amount: bigint | number, multiSigners: any[] = [], programId = TOKEN_PROGRAM_ID
) {
  return Token.createTransferInstruction(
    programId, source, destination, owner, multiSigners, Number(amount)
  );
}
import bs58 from "bs58";
import * as fs from "node:fs";

export type SolanaCfg = {
  rpc?: string;
  network: "mainnet-beta"|"devnet"|"testnet";
  mint: string;
  decimals: number;
};

export function getConnection(cfg: SolanaCfg): Connection {
  const endpoint = cfg.rpc?.trim() || clusterApiUrl(cfg.network);
  return new Connection(endpoint, "confirmed");
}

export async function loadBridgeKeypair(): Promise<Keypair> {
  const b58 = process.env.SOLANA_BRIDGE_KEYPAIR_B58?.trim();
  const pth = process.env.SOLANA_BRIDGE_KEYPAIR_PATH?.trim();
  if (b58) {
    const secret = bs58.decode(b58);
    return Keypair.fromSecretKey(secret);
  }
  if (pth) {
    const raw = JSON.parse(fs.readFileSync(pth, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  throw new Error("Bridge keypair missing. Set SOLANA_BRIDGE_KEYPAIR_B58 or SOLANA_BRIDGE_KEYPAIR_PATH");
}

export function mintPubkey(cfg: SolanaCfg): PublicKey {
  return new PublicKey(cfg.mint);
}

export function toUnits(amountTokens: number, decimals: number): bigint {
  return BigInt(Math.round(amountTokens * 10 ** decimals));
}

export function fromUnits(amountRaw: bigint, decimals: number): number {
  return Number(amountRaw) / 10 ** decimals;
}

export async function ensureATA(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  payer: Keypair
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  try {
    await getAccount(connection, ata);
    return ata;
  } catch {
    const ix = createAssociatedTokenAccountInstruction(
      payer.publicKey, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const tx = await sendAndConfirmTransaction(connection, { feePayer: payer.publicKey, instructions: [ix] } as any, [payer]);
    console.log('ATA created:', tx);
    return ata;
  }
}

export async function getMintInfo(connection: Connection, mint: PublicKey) {
  const mi = await getMint(connection, mint);
  return { supply: fromUnits(mi.supply, mi.decimals), decimals: mi.decimals, isInitialized: mi.isInitialized };
}

export async function getBalance(
  connection: Connection, owner: PublicKey, mint: PublicKey, decimals: number
): Promise<number> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  try {
    const acc = await getAccount(connection, ata);
    return fromUnits(acc.amount, decimals);
  } catch {
    return 0;
  }
}

export async function transferTokens(params: {
  connection: Connection;
  mint: PublicKey;
  decimals: number;
  from: Keypair;             // bridge or user signer
  toOwner: PublicKey;        // receiver wallet
  amountTokens: number;      // human units (e.g., 1.5 ALB)
}) {
  const { connection, mint, from, toOwner, amountTokens, decimals } = params;
  const fromAta = await ensureATA(connection, from.publicKey, mint, from);
  const toAta = await ensureATA(connection, toOwner, mint, from);
  const raw = toUnits(amountTokens, decimals);
  const ix = createTransferInstruction(fromAta, toAta, from.publicKey, raw, [], TOKEN_PROGRAM_ID);
  const sig = await sendAndConfirmTransaction(connection, { feePayer: from.publicKey, instructions: [ix] } as any, [from]);
  return sig;
}

export function readCfg(): SolanaCfg {
  const network = (process.env.SOLANA_NETWORK || "mainnet-beta") as SolanaCfg["network"];
  const rpc = process.env.SOLANA_RPC || "";
  const mint = process.env.ALB_MINT_ADDRESS || "";
  const decimals = Number(process.env.ALB_DECIMALS || "6");
  // Nuk hedhim exception në module-level;
  // thirrja reale do t'a kap në runtime nqsë mint mungon.
  return { network, rpc, mint: mint || 'PLACEHOLDER_MINT', decimals };
}

export function albEurValue(): number {
  return Number(process.env.ALB_EUR_VALUE || "1000");
}

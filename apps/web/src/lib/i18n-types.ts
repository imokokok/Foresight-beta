import en from "../../messages/en.json";
import zhCN from "../../messages/zh-CN.json";
import { Locale } from "../i18n-config";

export type Messages = typeof en;

export type MessageValue = string | number | boolean | null | undefined;

type DeepKeys<T, Prefix = ""> = T extends MessageValue
  ? Prefix
  : {
      [K in keyof T & string]: T[K] extends MessageValue
        ? Prefix extends ""
          ? K
          : `${Prefix}.${K}`
        : T[K] extends Record<string, unknown>
          ? Prefix extends ""
            ? DeepKeys<T[K], K>
            : DeepKeys<T[K], `${Prefix}.${K}`>
          : never;
    }[keyof T & string];

export type MessageKey = DeepKeys<Messages>;

export type Namespace = keyof Messages;

export function createNamespace<K extends Namespace>(namespace: K): K {
  return namespace;
}

export type PluralKey<N extends string> =
  | `${N}.zero`
  | `${N}.one`
  | `${N}.two`
  | `${N}.few`
  | `${N}.many`
  | `${N}.other`;

export function createPluralKey<N extends string>(namespace: N): PluralKey<N> {
  return `${namespace}.other` as PluralKey<N>;
}

export type TypedTFunction<N extends Namespace = never> = N extends never
  ? (key: MessageKey, params?: Record<string, string | number>) => string
  : (key: `${N}.${string}`, params?: Record<string, string | number>) => string;

export type UseTranslationsReturn<N extends Namespace> = {
  (key: keyof Messages[N] & string, params?: Record<string, string | number>): string;
  (key: `${N}.${string}`, params?: Record<string, string | number>): string;
};

export function assertNever(_value: never): never {
  throw new Error("Unexpected value");
}

export type FormatParams<T extends string> = T extends `{${infer Key}}`
  ? { [K in Key]?: string | number }
  : never;

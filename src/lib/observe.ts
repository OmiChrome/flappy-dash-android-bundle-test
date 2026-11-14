// Expo Observe (app metrics) is a native module that Expo Go does not include.
// Load it only in real builds so the app also runs in Expo Go.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { ComponentType } from 'react';

type ObserveLib = typeof import('expo-observe');

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let lib: ObserveLib | null = null;
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy for Expo Go
    lib = require('expo-observe') as ObserveLib;
  } catch {
    lib = null;
  }
}

export function wrapRoot<P extends object>(C: ComponentType<P>): ComponentType<P> {
  return lib ? (lib.ObserveRoot.wrap(C as unknown as ComponentType<Record<string, unknown>>) as unknown as ComponentType<P>) : C;
}

const noop = () => {};
/** Returns markInteractive(); a no-op where Observe is unavailable. */
export const useMarkInteractive: () => () => void = lib
  ? () => lib!.useObserve().markInteractive
  : () => noop;

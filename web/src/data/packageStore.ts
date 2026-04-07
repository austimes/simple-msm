import { create } from 'zustand';
import type { PackageData } from './types';
import { loadPackage } from './packageLoader';

interface PackageStore extends PackageData {
  loaded: boolean;
}

export const usePackageStore = create<PackageStore>(() => {
  const pkg = loadPackage();
  return {
    ...pkg,
    loaded: true,
  };
});

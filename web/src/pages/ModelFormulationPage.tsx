import React, { useMemo } from 'react';
import { usePackageStore } from '../data/packageStore';
import ModelFormulationPageContent from './ModelFormulationPageContent.tsx';
import { buildModelFormulationViewModel } from './modelFormulationModel.ts';

export default function ModelFormulationPage(): React.JSX.Element {
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const appConfig = usePackageStore((state) => state.appConfig);
  const currentConfiguration = usePackageStore((state) => state.currentConfiguration);
  const residualOverlays2025 = usePackageStore((state) => state.residualOverlays2025);
  const commodityBalance2025 = usePackageStore((state) => state.commodityBalance2025);
  const emissionsBalance2025 = usePackageStore((state) => state.emissionsBalance2025);

  const model = useMemo(
    () =>
      buildModelFormulationViewModel({
        sectorStates,
        appConfig,
        currentConfiguration,
        residualOverlays2025,
        commodityBalance2025,
        emissionsBalance2025,
      }),
    [
      appConfig,
      commodityBalance2025,
      currentConfiguration,
      emissionsBalance2025,
      residualOverlays2025,
      sectorStates,
    ],
  );

  return <ModelFormulationPageContent model={model} />;
}

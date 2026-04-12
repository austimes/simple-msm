import { usePackageStore } from '../data/packageStore';
import StateSchemaPageContent from './StateSchemaPageContent';

export default function StateSchemaPage() {
  const schema = usePackageStore((state) => state.enrichment.sectorStatesSchema);
  const sectorStates = usePackageStore((state) => state.sectorStates);

  return <StateSchemaPageContent schema={schema} sectorStates={sectorStates} />;
}

import { getCachedFieldWorkers, getCachedVillages } from './db';

export function useHierarchy(blockLeadEmail: string, selectedWorker: string) {
  return {
    fieldWorkers: getCachedFieldWorkers(blockLeadEmail),
    villages: selectedWorker ? getCachedVillages(blockLeadEmail, selectedWorker) : [],
  };
}
